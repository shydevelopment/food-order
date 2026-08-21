import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

interface OrderItemInput {
  menuId: string
  quantity: number
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนสั่งอาหาร' }, { status: 401 })
    }

    const body = await req.json()
    const restaurantId = String(body.restaurantId || '')
    const deliveryAddress = String(body.deliveryAddress || '').trim()
    const items = Array.isArray(body.items) ? body.items as OrderItemInput[] : []

    if (!restaurantId || items.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกรายการอาหารก่อนสั่งซื้อ' }, { status: 400 })
    }

    if (!deliveryAddress) {
      return NextResponse.json({ error: 'กรุณากรอกที่อยู่สำหรับจัดส่ง' }, { status: 400 })
    }

    const normalizedItems = items
      .map((item) => ({
        menuId: String(item.menuId || ''),
        quantity: Number(item.quantity || 0),
      }))
      .filter((item) => item.menuId && Number.isInteger(item.quantity) && item.quantity > 0)

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: 'จำนวนอาหารไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id, status')
      .eq('id', restaurantId)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'ไม่พบร้านอาหารที่เลือก' }, { status: 404 })
    }

    if (restaurant.status !== 'open') {
      return NextResponse.json({ error: 'ร้านอาหารนี้ยังไม่เปิดรับออร์เดอร์' }, { status: 400 })
    }

    const menuIds = Array.from(new Set(normalizedItems.map((item) => item.menuId)))
    const { data: menus, error: menusError } = await supabaseAdmin
      .from('menus')
      .select('id, restaurant_id, price, is_available')
      .in('id', menuIds)

    if (menusError) {
      return NextResponse.json({ error: menusError.message }, { status: 400 })
    }

    if (!menus || menus.length !== menuIds.length) {
      return NextResponse.json({ error: 'มีเมนูบางรายการไม่พบในระบบ' }, { status: 400 })
    }

    const menusById = new Map(menus.map((menu) => [menu.id, menu]))
    let totalPrice = 0

    for (const item of normalizedItems) {
      const menu = menusById.get(item.menuId)

      if (!menu || menu.restaurant_id !== restaurantId) {
        return NextResponse.json({ error: 'ตะกร้ามีเมนูจากคนละร้าน กรุณาสั่งทีละร้าน' }, { status: 400 })
      }

      if (!menu.is_available) {
        return NextResponse.json({ error: 'มีเมนูบางรายการหมดหรือไม่พร้อมขาย' }, { status: 400 })
      }

      totalPrice += Number(menu.price) * item.quantity
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        restaurant_id: restaurantId,
        total_price: totalPrice,
        status: 'pending',
        delivery_address: deliveryAddress,
      })
      .select('id, order_no')
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'ไม่สามารถสร้างออร์เดอร์ได้' }, { status: 400 })
    }

    const orderItems = normalizedItems.map((item) => {
      const menu = menusById.get(item.menuId)!

      return {
        order_id: order.id,
        menu_id: item.menuId,
        quantity: item.quantity,
        price: Number(menu.price),
      }
    })

    const { error: orderItemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (orderItemsError) {
      return NextResponse.json({ error: orderItemsError.message }, { status: 400 })
    }

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'order_created',
        title: 'สร้างคำสั่งซื้อใหม่',
        detail: `Order #${order.order_no || String(order.id).slice(0, 8)} ยอดรวม ฿${totalPrice.toLocaleString('th-TH')}`,
      })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNo: order.order_no,
      totalPrice,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในระบบสั่งอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
