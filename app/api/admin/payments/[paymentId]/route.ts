import {
  createClient as createSupabaseAdminClient,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isPaymentStatus, type PaymentMethod } from '@/lib/payments'
import { createClient } from '@/supabase/service'

const canAccessRestaurant = async (params: {
  supabaseAdmin: SupabaseClient
  userId: string
  userEmail: string | null
  restaurantId: string
}) => {
  const { supabaseAdmin, userId, userEmail, restaurantId } = params
  const ownerFilters = [`owner_id.eq.${userId}`]

  if (userEmail) {
    ownerFilters.push(`email.eq.${userEmail}`)
  }

  const [{ data: restaurant }, { data: member }] = await Promise.all([
    supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .or(ownerFilters.join(','))
      .maybeSingle(),
    supabaseAdmin
      .from('restaurant_members')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  return Boolean(restaurant || member)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }

    const body = await req.json()
    const nextStatus = String(body.status || '')
    if (!isPaymentStatus(nextStatus)) {
      return NextResponse.json(
        { error: 'สถานะการชำระเงินไม่ถูกต้อง' },
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
        { error: 'ไม่มีสิทธิ์จัดการรายการชำระเงิน' },
        { status: 403 },
      )
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, order_id, restaurant_id, method, status, amount')
      .eq('id', paymentId)
      .maybeSingle()

    if (paymentError?.message.includes('payments')) {
      return NextResponse.json(
        { error: 'ยังไม่ได้ติดตั้งตาราง Payment กรุณารัน supabase/sql/payments_dashboard.sql' },
        { status: 400 },
      )
    }

    if (!payment) {
      return NextResponse.json({ error: 'ไม่พบรายการชำระเงิน' }, { status: 404 })
    }

    const isAdmin = profile.role === 'admin'
    if (!isAdmin) {
      const canAccess = await canAccessRestaurant({
        supabaseAdmin,
        userId: user.id,
        userEmail: profile.email,
        restaurantId: payment.restaurant_id,
      })

      if (!canAccess) {
        return NextResponse.json(
          { error: 'คุณจัดการได้เฉพาะรายการของร้านตัวเอง' },
          { status: 403 },
        )
      }

      if ((payment.method as PaymentMethod) !== 'cash') {
        return NextResponse.json(
          { error: 'รายการ QR และบัตรเครดิตรอการยืนยันจากผู้ให้บริการชำระเงิน' },
          { status: 403 },
        )
      }
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: nextStatus,
        paid_at: nextStatus === 'paid' ? now : null,
        updated_at: now,
      })
      .eq('id', payment.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    const statusLabel = {
      paid: 'ยืนยันชำระแล้ว',
      failed: 'บันทึกว่าชำระไม่สำเร็จ',
      cancelled: 'ยกเลิกรายการชำระเงิน',
      refunded: 'บันทึกคืนเงินแล้ว',
      pending: 'ตั้งเป็นรอชำระ',
    }[nextStatus]

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      restaurant_id: payment.restaurant_id,
      order_id: payment.order_id,
      action_type: 'payment_status_updated',
      title: 'อัปเดตสถานะการชำระเงิน',
      detail: `ยอด ฿${Number(payment.amount).toLocaleString('th-TH')} · ${statusLabel}`,
    })

    return NextResponse.json({ success: true, status: nextStatus })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'ไม่สามารถอัปเดตสถานะการชำระเงินได้'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
