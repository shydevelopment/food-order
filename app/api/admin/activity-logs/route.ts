import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { getAccountRoleMeta } from '@/lib/roles'

interface RestaurantRow {
  id: string
  name: string
  owner_id: string | null
  email?: string | null
}

interface OrderRow {
  id: string
  order_no: number | null
  restaurant_id: string
  total_price: number | string | null
  status: string | null
  created_at: string | null
  cancellation_reason?: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  username: string | null
  role: string | null
  email: string | null
  created_at: string | null
}

interface MenuRow {
  id: string
  name: string
  price: number | string | null
  restaurant_id: string
  created_at: string | null
  restaurants?: { name: string | null } | { name: string | null }[] | null
}

const parseTimestamp = (value: string | null) => value || new Date(0).toISOString()

const getRestaurantName = (menu: MenuRow, restaurantsById: Map<string, string>) => {
  const relation = Array.isArray(menu.restaurants) ? menu.restaurants[0] : menu.restaurants
  return relation?.name || restaurantsById.get(menu.restaurant_id) || null
}

export async function GET(req: NextRequest) {
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
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูประวัติกิจกรรม' }, { status: 403 })
    }

    const selectedRestaurantId = req.nextUrl.searchParams.get('restaurantId')
    const ownerFilters = [`owner_id.eq.${user.id}`]

    if (profile.email) {
      ownerFilters.push(`email.eq.${profile.email}`)
    }

    const [{ data: allRestaurants }, { data: ownedRestaurants }, { data: restaurantMembers }] = await Promise.all([
      profile.role === 'admin'
        ? supabaseAdmin
          .from('restaurants')
          .select('id, name, owner_id, email')
          .order('name', { ascending: true })
        : Promise.resolve({ data: [] }),
      profile.role === 'restaurant'
        ? supabaseAdmin
          .from('restaurants')
          .select('id, name, owner_id, email')
          .or(ownerFilters.join(','))
        : Promise.resolve({ data: [] }),
      profile.role === 'restaurant'
        ? supabaseAdmin
          .from('restaurant_members')
          .select('restaurant_id, restaurants(id, name, owner_id, email)')
          .eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    const memberRestaurants = ((restaurantMembers || []) as {
      restaurant_id: string
      restaurants?: RestaurantRow | RestaurantRow[] | null
    }[]).map((member) => {
      const relation = Array.isArray(member.restaurants) ? member.restaurants[0] : member.restaurants
      return relation || null
    }).filter((restaurant): restaurant is RestaurantRow => Boolean(restaurant))

    const allowedRestaurants = profile.role === 'admin'
      ? ((allRestaurants || []) as RestaurantRow[])
      : Array.from(
        new Map(
          [...((ownedRestaurants || []) as RestaurantRow[]), ...memberRestaurants]
            .map((restaurant) => [restaurant.id, restaurant])
        ).values()
      )

    const allowedRestaurantIds = allowedRestaurants.map((restaurant) => restaurant.id)
    const canUseSelectedRestaurant = Boolean(
      selectedRestaurantId &&
      allowedRestaurantIds.includes(selectedRestaurantId)
    )
    const scopedRestaurantIds = canUseSelectedRestaurant
      ? [selectedRestaurantId!]
      : profile.role === 'restaurant'
        ? allowedRestaurantIds
        : []

    if (profile.role === 'restaurant' && scopedRestaurantIds.length === 0) {
      return NextResponse.json({
        role: profile.role,
        restaurants: [],
        selectedRestaurantId: null,
        activities: [],
      })
    }

    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('id, order_no, restaurant_id, total_price, status, created_at, cancellation_reason')
      .order('created_at', { ascending: false })
      .limit(40)

    let menusQuery = supabaseAdmin
      .from('menus')
      .select('id, name, price, restaurant_id, created_at, restaurants(name)')
      .order('created_at', { ascending: false })
      .limit(40)

    let restaurantsQuery = supabaseAdmin
      .from('restaurants')
      .select('id, name, owner_id, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (scopedRestaurantIds.length > 0) {
      ordersQuery = ordersQuery.in('restaurant_id', scopedRestaurantIds)
      menusQuery = menusQuery.in('restaurant_id', scopedRestaurantIds)
      restaurantsQuery = restaurantsQuery.in('id', scopedRestaurantIds)
    }

    const [
      { data: latestOrders },
      { data: latestMenus },
      { data: latestRestaurants },
      { data: latestUsers },
    ] = await Promise.all([
      ordersQuery,
      menusQuery,
      restaurantsQuery,
      profile.role === 'admin' && !selectedRestaurantId
        ? supabaseAdmin
          .from('profiles')
          .select('id, full_name, username, role, email, created_at')
          .order('created_at', { ascending: false })
          .limit(25)
        : Promise.resolve({ data: [] }),
    ])

    const restaurantsById = new Map(
      allowedRestaurants.map((restaurant) => [restaurant.id, restaurant.name])
    )

    const formattedOrders = ((latestOrders || []) as OrderRow[]).map((order) => {
      const restaurantName = restaurantsById.get(order.restaurant_id) || 'ไม่พบชื่อร้าน'
      const orderLabel = order.order_no ? `#${order.order_no}` : `#${order.id.slice(0, 8)}`
      const isCancelled = order.status === 'cancelled'

      return {
        id: `order-${order.id}`,
        type: 'order',
        restaurantId: order.restaurant_id,
        restaurantName,
        title: isCancelled ? `ออเดอร์ถูกยกเลิก ${orderLabel}` : `คำสั่งซื้อ ${orderLabel}`,
        detail: `ร้าน ${restaurantName} • ยอด ฿${Number(order.total_price || 0).toLocaleString('th-TH')} • สถานะ: ${order.status || 'รอดำเนินการ'}${isCancelled && order.cancellation_reason ? ` • เหตุผล: ${order.cancellation_reason}` : ''}`,
        timestamp: parseTimestamp(order.created_at),
        icon: isCancelled ? '⚠️' : '🛒',
        colorClass: isCancelled
          ? 'bg-red-500/10 text-red-400 border-red-500/20'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      }
    })

    const formattedMenus = ((latestMenus || []) as MenuRow[]).map((menu) => {
      const restaurantName = getRestaurantName(menu, restaurantsById) || 'ไม่พบชื่อร้าน'

      return {
        id: `menu-${menu.id}`,
        type: 'menu',
        restaurantId: menu.restaurant_id,
        restaurantName,
        title: 'เพิ่มเมนูอาหารใหม่',
        detail: `ร้าน ${restaurantName} • เมนู "${menu.name}" (฿${Number(menu.price || 0).toLocaleString('th-TH')})`,
        timestamp: parseTimestamp(menu.created_at),
        icon: '🍽️',
        colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      }
    })

    const formattedRestaurants = ((latestRestaurants || []) as (RestaurantRow & { created_at: string | null })[]).map((restaurant) => ({
      id: `rest-${restaurant.id}`,
      type: 'restaurant',
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      title: 'ร้านอาหารในระบบ',
      detail: `ร้าน "${restaurant.name}" ${restaurant.owner_id ? `• owner_id: ${restaurant.owner_id.slice(0, 8)}` : '• ยังไม่มี Owner'}`,
      timestamp: parseTimestamp(restaurant.created_at),
      icon: '🏪',
      colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    }))

    const formattedUsers = ((latestUsers || []) as ProfileRow[]).map((row) => ({
      id: `user-${row.id}`,
      type: 'user',
      restaurantId: null,
      restaurantName: null,
      title: 'สมาชิกในระบบ',
      detail: `${row.full_name || row.username || 'สมาชิก'} (@${row.username || 'ผู้ใช้'}) • Role: ${getAccountRoleMeta(row.role)?.thaiLabel || 'Customer'}`,
      timestamp: parseTimestamp(row.created_at),
      icon: '👤',
      colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    }))

    const activities = [
      ...formattedOrders,
      ...formattedMenus,
      ...formattedRestaurants,
      ...formattedUsers,
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100)

    return NextResponse.json({
      role: profile.role,
      restaurants: allowedRestaurants.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
      })),
      selectedRestaurantId: canUseSelectedRestaurant ? selectedRestaurantId : null,
      activities,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดประวัติกิจกรรม'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
