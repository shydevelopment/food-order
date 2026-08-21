import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

const allowedStatuses = ['pending', 'preparing', 'delivering', 'completed', 'cancelled']

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }

    const { orderId, status } = await req.json()

    if (!orderId || !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'ข้อมูลสถานะออร์เดอร์ไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !['admin', 'restaurant'].includes(profile.role)) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการออร์เดอร์' }, { status: 403 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_no, restaurant_id')
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

      const { data: restaurantMember, error: restaurantMemberError } = await supabaseAdmin
        .from('restaurant_members')
        .select('id')
        .eq('restaurant_id', order.restaurant_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (restaurantMemberError) {
        console.error('Error checking restaurant member access:', restaurantMemberError.message)
      }

      if (restaurantError || (!restaurant && !restaurantMember)) {
        return NextResponse.json({ error: 'คุณเห็นได้เฉพาะออร์เดอร์ของร้านตัวเอง' }, { status: 403 })
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', orderId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'order_status_updated',
        title: 'อัปเดตสถานะออร์เดอร์',
        detail: `Order #${order.order_no || String(orderId).slice(0, 8)} เปลี่ยนสถานะเป็น ${status}`,
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปเดตสถานะ'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
