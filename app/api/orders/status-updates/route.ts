import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

interface OrderRow {
  id: string
  order_no: number | null
  restaurant_id: string
  total_price: number | string
  status: string | null
  pickup_time: string | null
  cancellation_reason: string | null
  created_at: string
}

interface RestaurantRow {
  id: string
  name: string
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

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id, order_no, restaurant_id, total_price, status, pickup_time, cancellation_reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 400 })
    }

    const orderRows = (orders || []) as OrderRow[]
    const restaurantIds = Array.from(new Set(orderRows.map((order) => order.restaurant_id)))
    const { data: restaurants } = restaurantIds.length > 0
      ? await supabaseAdmin
        .from('restaurants')
        .select('id, name')
        .in('id', restaurantIds)
      : { data: [] }

    const restaurantsById = new Map(
      ((restaurants || []) as RestaurantRow[]).map((restaurant) => [restaurant.id, restaurant.name])
    )

    return NextResponse.json({
      orders: orderRows.map((order) => ({
        ...order,
        restaurant_name: restaurantsById.get(order.restaurant_id) || null,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดสถานะออเดอร์'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
