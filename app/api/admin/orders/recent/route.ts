import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

interface RestaurantMember {
  restaurant_id: string
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }

    const sinceParam = req.nextUrl.searchParams.get('since')
    const sinceDate = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 15000)
    const checkedAt = new Date().toISOString()

    if (Number.isNaN(sinceDate.getTime())) {
      return NextResponse.json({ error: 'รูปแบบเวลาไม่ถูกต้อง' }, { status: 400 })
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

    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('id, order_no, restaurant_id, total_price, created_at')
      .gt('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(20)

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
        console.error('Error fetching recent order restaurant members:', restaurantMembersError.message)
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

    return NextResponse.json({
      checkedAt,
      orders: orders || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดออเดอร์ใหม่'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
