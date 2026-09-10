import 'server-only'
import { createAdminClient } from '@/supabase/admin'
import { PaymentError } from '@/lib/kgp'

interface RestaurantMemberRow {
  user_id: string
}

interface ProfileRow {
  id: string
}

export async function requestCustomerOrderCancellation(orderId: string, userId: string, reason: string) {
  const cleanedReason = reason.trim()
  if (cleanedReason.length < 3 || cleanedReason.length > 200) {
    throw new PaymentError('กรุณาระบุเหตุผลการยกเลิก 3-200 ตัวอักษร', 400)
  }
  const db = createAdminClient()
  const { data: order, error } = await db.from('orders').select('id, order_no, restaurant_id, status, cancellation_requested_at')
    .eq('id', orderId).eq('user_id', userId).maybeSingle()
  if (error) throw new PaymentError('ไม่สามารถอ่านข้อมูลออเดอร์ได้', 503)
  if (!order) throw new PaymentError('ไม่พบออเดอร์นี้', 404)
  const { data: payment, error: paymentError } = await db.from('payments')
    .select('id, order_id, customer_id, amount, status, method, paid_at, provider_reference')
    .eq('order_id', orderId).eq('customer_id', userId).maybeSingle()
  if (paymentError) throw new PaymentError('ไม่สามารถตรวจสอบการชำระเงินได้', 503)
  if (!payment) throw new PaymentError('ไม่พบข้อมูลชำระเงิน กรุณาติดต่อผู้ดูแลระบบ', 409)
  if (!['pending', 'failed', 'cancelled'].includes(payment.status) || payment.paid_at || payment.provider_reference) {
    throw new PaymentError('ออเดอร์นี้ชำระเงินแล้ว ไม่สามารถยกเลิกได้', 409)
  }
  if (order.status === 'cancelled') throw new PaymentError('ออเดอร์นี้ถูกยกเลิกแล้ว', 409)
  if (!['pending', 'preparing', 'delivering'].includes(order.status || 'pending')) {
    throw new PaymentError('ออเดอร์นี้ไม่สามารถยกเลิกได้', 409)
  }
  if (!['cash', 'qr'].includes(payment.method)) throw new PaymentError('กรุณาติดต่อร้านเพื่อยกเลิกช่องทางชำระเงินนี้', 409)
  if (order.cancellation_requested_at) return { orderId, status: 'cancellation_requested' }

  const now = new Date().toISOString()
  const { error: requestError } = await db.from('orders').update({
    cancellation_requested_at: now,
    cancellation_request_reason: cleanedReason,
  }).eq('id', orderId).eq('user_id', userId)
  if (requestError) throw new PaymentError('ไม่สามารถส่งคำขอยกเลิกได้ กรุณาลองอีกครั้ง', 503)

  const { data: restaurant } = await db.from('restaurants')
    .select('name, owner_id, email').eq('id', order.restaurant_id).maybeSingle()
  const [{ data: restaurantMembers }, { data: emailOwners }] = await Promise.all([
    db.from('restaurant_members').select('user_id').eq('restaurant_id', order.restaurant_id),
    restaurant?.email
      ? db.from('profiles').select('id').eq('email', restaurant.email).in('role', ['restaurant', 'admin'])
      : Promise.resolve({ data: [] }),
  ])
  const restaurantUserIds = Array.from(new Set([
    restaurant?.owner_id,
    ...((restaurantMembers || []) as RestaurantMemberRow[]).map((member) => member.user_id),
    ...((emailOwners || []) as ProfileRow[]).map((profile) => profile.id),
  ].filter((id): id is string => Boolean(id) && id !== userId)))

  const orderLabel = `Order #${order.order_no || orderId.slice(0, 8)}`
  const { error: notificationError } = await db.from('notifications').upsert(
    restaurantUserIds.map((ownerId) => ({
      user_id: ownerId,
      order_id: orderId,
      item_key: `order-cancellation-request-${orderId}`,
      type: 'order',
      title: `${orderLabel} · ลูกค้าขอยกเลิก`,
      detail: `ลูกค้าส่งคำขอยกเลิกออเดอร์: ${cleanedReason}`,
      href: `/admin/orders?restaurantId=${order.restaurant_id}`,
      tone: 'orange',
      is_read: false,
      source_created_at: now,
      updated_at: now,
    })),
    { onConflict: 'user_id,item_key' },
  )
  if (notificationError) {
    console.error('Error creating cancellation request notification:', notificationError.message)
  }

  await db.from('activity_logs').insert({
    user_id: userId,
    action_type: 'order_cancellation_requested',
    title: 'ส่งคำขอยกเลิกออเดอร์',
    detail: `${orderLabel} · ${cleanedReason}`,
  })

  return { orderId, status: 'cancellation_requested' }
}
