import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

interface RestaurantMember {
  restaurant_id: string
}

interface OrderRow {
  id: string
  order_no: number | null
  restaurant_id: string
  total_price: number | string
  pickup_time: string | null
}

const reminderWindowMinutes = 30
const overdueGraceMinutes = 10

const getPickupDate = (pickupTime: string) => {
  const [hour, minute] = pickupTime.split(':').map((value) => Number(value))
  const pickupDate = new Date()
  pickupDate.setHours(hour, minute, 0, 0)
  return pickupDate
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
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
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูแจ้งเตือนออร์เดอร์' }, { status: 403 })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('id, order_no, restaurant_id, total_price, pickup_time')
      .not('pickup_time', 'is', null)
      .in('status', ['pending', 'preparing'])
      .gte('created_at', todayStart.toISOString())
      .order('pickup_time', { ascending: true })

    if (profile.role === 'restaurant') {
      const ownerFilters = [`owner_id.eq.${user.id}`]

      if (profile.email) {
        ownerFilters.push(`email.eq.${profile.email}`)
      }

      const { data: ownerRestaurants } = await supabaseAdmin
        .from('restaurants')
        .select('id')
        .or(ownerFilters.join(','))

      const { data: restaurantMembers, error: restaurantMembersError } = await supabaseAdmin
        .from('restaurant_members')
        .select('restaurant_id')
        .eq('user_id', user.id)

      if (restaurantMembersError) {
        console.error('Error fetching pickup reminder restaurant members:', restaurantMembersError.message)
      }

      const ownerRestaurantIds = (ownerRestaurants || []).map((restaurant) => restaurant.id)
      const memberRestaurantIds = ((restaurantMembers || []) as RestaurantMember[]).map((member) => member.restaurant_id)
      const allowedRestaurantIds = Array.from(new Set([...ownerRestaurantIds, ...memberRestaurantIds]))

      ordersQuery = allowedRestaurantIds.length > 0
        ? ordersQuery.in('restaurant_id', allowedRestaurantIds)
        : ordersQuery.in('restaurant_id', ['00000000-0000-0000-0000-000000000000'])
    }

    const { data: orders, error: ordersError } = await ordersQuery

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 400 })
    }

    const now = new Date()
    const reminders = ((orders || []) as OrderRow[])
      .filter((order) => order.pickup_time)
      .map((order) => {
        const pickupDate = getPickupDate(order.pickup_time!)
        const minutesUntilPickup = Math.round((pickupDate.getTime() - now.getTime()) / 60000)

        return {
          ...order,
          pickup_time: order.pickup_time!.slice(0, 5),
          minutes_until_pickup: minutesUntilPickup,
        }
      })
      .filter((order) => (
        order.minutes_until_pickup <= reminderWindowMinutes
        && order.minutes_until_pickup >= -overdueGraceMinutes
      ))

    return NextResponse.json({ reminders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดแจ้งเตือนเวลารับอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
