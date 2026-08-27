import {
  createClient as createSupabaseAdminClient,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import {
  allowedOrderStatuses,
  getOrderStatusDetail,
  getOrderStatusNotificationKey,
  getOrderStatusNotificationLabel,
  getOrderStatusTone,
  type OrderStatus,
} from '@/lib/order-status'

const createCustomerStatusNotification = async (params: {
  supabaseAdmin: SupabaseClient
  order: {
    id: string
    order_no: number | null
    user_id: string
    restaurant_id: string
    total_price: number | string
    pickup_time: string | null
  }
  status: OrderStatus
  cancellationReason: string
}) => {
  const { supabaseAdmin, order, status, cancellationReason } = params
  const now = new Date().toISOString()
  const orderLabel = `Order #${order.order_no || order.id.slice(0, 8)}`

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('name')
    .eq('id', order.restaurant_id)
    .maybeSingle<{ name: string | null }>()

  const restaurantName = restaurant?.name || 'ร้านอาหาร'
  const pickupTime = order.pickup_time ? order.pickup_time.slice(0, 5) : null
  const detailParts = [
    getOrderStatusDetail(status),
    `ร้าน ${restaurantName}`,
    pickupTime ? `รับเวลา ${pickupTime}` : null,
    status === 'cancelled' && cancellationReason
      ? `เหตุผล: ${cancellationReason}`
      : null,
  ].filter((part): part is string => Boolean(part))

  const { error } = await supabaseAdmin.from('notifications').upsert(
    {
      user_id: order.user_id,
      item_key: getOrderStatusNotificationKey(order.id, status),
      type: 'order',
      title: `${orderLabel} · ${getOrderStatusNotificationLabel(status)}`,
      detail: detailParts.join(' ·'),
      href: `/trackorderPage?order=${order.id}`,
      tone: getOrderStatusTone(status),
      is_read: false,
      source_created_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,item_key' },
  )

  if (error) {
    console.error('Error creating customer status notification:', error.message)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อน' },
        { status: 401 },
      )
    }

    const { orderId, status, cancellationReason } = await req.json()
    const nextStatus = String(status || '') as OrderStatus

    if (!orderId || !allowedOrderStatuses.includes(nextStatus)) {
      return NextResponse.json(
        { error: 'ข้อมูลสถานะออร์เดอร์ไม่ถูกต้อง' },
        { status: 400 },
      )
    }

    const cleanedCancellationReason = String(cancellationReason || '')
      .trim()
      .slice(0, 300)
    if (nextStatus === 'cancelled' && cleanedCancellationReason.length < 3) {
      return NextResponse.json(
        { error: 'กรุณากรอกเหตุผลการยกเลิกอย่างน้อย 3 ตัวอักษร' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (
      profileError ||
      !profile ||
      !['admin', 'restaurant'].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์จัดการออร์เดอร์' },
        { status: 403 },
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_no, user_id, restaurant_id, total_price, pickup_time')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'ไม่พบออร์เดอร์นี้' }, { status: 404 })
    }

    if (profile.role === 'restaurant') {
      const ownerFilters = [`owner_id.eq.${user.id}`]

      if (profile.email) {
        ownerFilters.push(`email.eq.${profile.email}`)
      }

      const { data: restaurant, error: restaurantError } = await supabaseAdmin
        .from('restaurants')
        .select('id')
        .eq('id', order.restaurant_id)
        .or(ownerFilters.join(','))
        .maybeSingle()

      const { data: restaurantMember, error: restaurantMemberError } =
        await supabaseAdmin
          .from('restaurant_members')
          .select('id')
          .eq('restaurant_id', order.restaurant_id)
          .eq('user_id', user.id)
          .maybeSingle()

      if (restaurantMemberError) {
        console.error(
          'Error checking restaurant member access:',
          restaurantMemberError.message,
        )
      }

      if (restaurantError || (!restaurant && !restaurantMember)) {
        return NextResponse.json(
          { error: 'คุณเห็นได้เฉพาะออร์เดอร์ของร้านตัวเอง' },
          { status: 403 },
        )
      }
    }

    const updatePayload =
      nextStatus === 'cancelled'
        ? {
            status: nextStatus,
            cancellation_reason: cleanedCancellationReason,
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
          }
        : { status: nextStatus }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await Promise.all([
      supabaseAdmin.from('activity_logs').insert({
        user_id: user.id,
        action_type: 'order_status_updated',
        title: 'อัปเดตสถานะออร์เดอร์',
        detail:
          nextStatus === 'cancelled'
            ? `Order #${order.order_no || String(orderId).slice(0, 8)} ถูกยกเลิก: ${cleanedCancellationReason}`
            : `Order #${order.order_no || String(orderId).slice(0, 8)} เปลี่ยนสถานะเป็น ${getOrderStatusNotificationLabel(nextStatus)}`,
      }),
      createCustomerStatusNotification({
        supabaseAdmin,
        order,
        status: nextStatus,
        cancellationReason: cleanedCancellationReason,
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปเดตสถานะ'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
