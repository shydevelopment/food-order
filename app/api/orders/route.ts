import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { validateThaiPhone } from '@/lib/phone'
import { getBangkokDayIndex, isMenuAvailableOnDay } from '@/lib/menu-days'

interface OrderItemInput {
  menuId?: string
  quantity: number
  customName?: string
  isSpecial?: boolean
  itemNote?: string
}

interface RestaurantMemberRow {
  user_id: string
}

interface ProfileRow {
  id: string
}

interface CustomerProfileRow {
  phone: string | null
  full_name: string | null
  username: string | null
  email: string | null
}

const paymentMethodLabels = {
  cash: 'เงินสด จ่ายหน้าร้าน',
} as const

type PaymentMethod = keyof typeof paymentMethodLabels

const createOrderNotifications = async (params: {
  supabaseAdmin: SupabaseClient
  customerId: string
  restaurantId: string
  restaurantName: string
  restaurantOwnerId: string | null
  restaurantEmail: string | null
  orderId: string
  orderNo: number | null
  totalPrice: number
  pickupTime: string
  paymentMethodLabel: string
  customerName: string
}) => {
  const {
    supabaseAdmin,
    customerId,
    restaurantId,
    restaurantName,
    restaurantOwnerId,
    restaurantEmail,
    orderId,
    orderNo,
    totalPrice,
    pickupTime,
    paymentMethodLabel,
    customerName,
  } = params

  const [{ data: restaurantMembers }, { data: emailOwners }] = await Promise.all([
    supabaseAdmin
      .from('restaurant_members')
      .select('user_id')
      .eq('restaurant_id', restaurantId),
    restaurantEmail
      ? supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', restaurantEmail)
        .in('role', ['restaurant', 'admin'])
      : Promise.resolve({ data: [] }),
  ])

  const restaurantUserIds = Array.from(new Set([
    restaurantOwnerId,
    ...((restaurantMembers || []) as RestaurantMemberRow[]).map((member) => member.user_id),
    ...((emailOwners || []) as ProfileRow[]).map((profile) => profile.id),
  ].filter((id): id is string => Boolean(id))))

  const orderLabel = `Order #${orderNo || orderId.slice(0, 8)}`
  const now = new Date().toISOString()
  const notifications = [
    {
      user_id: customerId,
      item_key: `order-${orderId}`,
      type: 'order',
      title: orderLabel,
      detail: `สั่งอาหารจาก ${restaurantName} แล้ว · รับเวลา ${pickupTime} · ชำระเงิน ${paymentMethodLabel}`,
      href: `/trackorderPage?order=${orderId}`,
      tone: 'orange',
      source_created_at: now,
      updated_at: now,
    },
    ...restaurantUserIds
      .filter((ownerId) => ownerId !== customerId)
      .map((ownerId) => ({
        user_id: ownerId,
        item_key: `order-${orderId}`,
        type: 'order',
        title: `${orderLabel} เข้าใหม่`,
        detail: `ลูกค้า ${customerName} · ${restaurantName} · ยอดรวม ฿${totalPrice.toLocaleString('th-TH')} · รับเวลา ${pickupTime} · ชำระเงิน ${paymentMethodLabel}`,
        href: `/admin/orders?restaurantId=${restaurantId}`,
        tone: 'orange',
        source_created_at: now,
        updated_at: now,
      })),
  ]

  const { error } = await supabaseAdmin
    .from('notifications')
    .upsert(notifications, { onConflict: 'user_id,item_key' })

  if (error) {
    console.error('Error creating order notifications:', error.message)
  }
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
    const pickupTime = String(body.pickupTime || '').trim()
    const pickupNote = String(body.pickupNote || '').trim().slice(0, 200)
    const paymentMethod = String(body.paymentMethod || 'cash') as PaymentMethod
    const items = Array.isArray(body.items) ? body.items as OrderItemInput[] : []

    if (!restaurantId || items.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกรายการอาหารก่อนสั่งซื้อ' }, { status: 400 })
    }

    if (!(paymentMethod in paymentMethodLabels)) {
      return NextResponse.json({ error: 'วิธีชำระเงินนี้ยังไม่พร้อมใช้งาน' }, { status: 400 })
    }

    const paymentMethodLabel = paymentMethodLabels[paymentMethod]

    const [pickupHour, pickupMinute] = pickupTime.split(':').map((value) => Number(value))

    if (
      !/^\d{2}:\d{2}$/.test(pickupTime)
      || !Number.isInteger(pickupHour)
      || !Number.isInteger(pickupMinute)
      || pickupHour < 0
      || pickupHour > 23
      || pickupMinute < 0
      || pickupMinute > 59
    ) {
      return NextResponse.json({ error: 'กรุณาเลือกเวลาไปรับอาหาร' }, { status: 400 })
    }

    const normalizedItems = items
      .map((item) => ({
        menuId: String(item.menuId || ''),
        quantity: Number(item.quantity || 0),
        customName: String(item.customName || '').trim().slice(0, 120),
        isSpecial: Boolean(item.isSpecial),
        itemNote: String(item.itemNote || '').trim().slice(0, 160),
      }))
      .filter((item) => (item.menuId || item.customName) && Number.isInteger(item.quantity) && item.quantity > 0)

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: 'จำนวนอาหารไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: customerProfile, error: customerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('phone, full_name, username, email')
      .eq('id', user.id)
      .single<CustomerProfileRow>()

    const phoneValidation = validateThaiPhone(customerProfile?.phone || '')
    const customerDisplayName = customerProfile?.full_name || customerProfile?.username || customerProfile?.email || user.email || 'ลูกค้า'

    if (customerProfileError || !phoneValidation.success) {
      return NextResponse.json({
        code: 'PROFILE_PHONE_REQUIRED',
        error: 'บัญชีนี้ยังไม่มีเบอร์โทรศัพท์ กรุณาไปแก้ไขโปรไฟล์และเพิ่มเบอร์โทรก่อนสั่งอาหาร',
      }, { status: 400 })
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, email, owner_id, status, restaurant_type, unavailable_ingredients')
      .eq('id', restaurantId)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'ไม่พบร้านอาหารที่เลือก' }, { status: 404 })
    }

    if (restaurant.status !== 'open') {
      return NextResponse.json({ error: 'ร้านอาหารนี้ยังไม่เปิดรับออร์เดอร์' }, { status: 400 })
    }

    const customItems = normalizedItems.filter((item) => item.customName && !item.menuId)
    if (customItems.length > 0 && restaurant.restaurant_type !== 'made_to_order') {
      return NextResponse.json({ error: 'ร้านนี้ไม่รองรับการเขียนเมนูเอง' }, { status: 400 })
    }

    const unavailableIngredients = Array.isArray(restaurant.unavailable_ingredients)
      ? restaurant.unavailable_ingredients.map((item) => String(item).trim()).filter(Boolean)
      : []

    for (const item of customItems) {
      const text = `${item.customName} ${item.itemNote}`.toLowerCase()
      const unavailableIngredient = unavailableIngredients.find((ingredient) => text.includes(ingredient.toLowerCase()))

      if (unavailableIngredient) {
        return NextResponse.json({ error: `วัตถุดิบ "${unavailableIngredient}" หมด กรุณาเลือกเมนูอื่น` }, { status: 400 })
      }
    }

    const menuIds = Array.from(new Set(normalizedItems.map((item) => item.menuId).filter(Boolean)))
    const { data: menus, error: menusError } = menuIds.length > 0
      ? await supabaseAdmin
        .from('menus')
        .select('id, restaurant_id, price, is_available, available_days')
        .in('id', menuIds)
      : { data: [], error: null }

    if (menusError) {
      if (menusError.message?.includes('schema cache') || menusError.message?.includes('available_days')) {
        return NextResponse.json({
          error: 'ฐานข้อมูลยังไม่มีคอลัมน์จัดการอาหารรายวัน กรุณารันไฟล์ supabase/sql/menu_daily_availability.sql ใน Supabase SQL Editor ก่อน',
        }, { status: 400 })
      }

      return NextResponse.json({ error: menusError.message }, { status: 400 })
    }

    if (!menus || menus.length !== menuIds.length) {
      return NextResponse.json({ error: 'มีเมนูบางรายการไม่พบในระบบ' }, { status: 400 })
    }

    const menusById = new Map(menus.map((menu) => [menu.id, menu]))
    const todayIndex = getBangkokDayIndex()
    let totalPrice = 0

    for (const item of normalizedItems) {
      if (!item.menuId && item.customName) {
        continue
      }

      const menu = menusById.get(item.menuId)

      if (!menu || menu.restaurant_id !== restaurantId) {
        return NextResponse.json({ error: 'รายการของออเดอร์นี้มีเมนูจากร้านไม่ตรงกัน กรุณากลับไปตรวจตะกร้าอีกครั้ง' }, { status: 400 })
      }

      if (!menu.is_available) {
        return NextResponse.json({ error: 'มีเมนูบางรายการหมดหรือไม่พร้อมขาย' }, { status: 400 })
      }

      if (!isMenuAvailableOnDay(menu.available_days, todayIndex)) {
        return NextResponse.json({ error: 'มีเมนูบางรายการไม่ได้ขายในวันนี้ กรุณาเลือกเมนูใหม่' }, { status: 400 })
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
        delivery_address: deliveryAddress || 'รับอาหารที่ร้าน',
        pickup_time: pickupTime,
        pickup_note: pickupNote || null,
        needs_cutlery: false,
      })
      .select('id, order_no')
      .single()

    if (orderError?.message?.includes('schema cache')) {
      return NextResponse.json({
        error: 'ฐานข้อมูลยังไม่มีคอลัมน์เวลารับอาหาร กรุณารันไฟล์ supabase/sql/order_pickup_options.sql ใน Supabase SQL Editor ก่อน',
      }, { status: 400 })
    }

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'ไม่สามารถสร้างออร์เดอร์ได้' }, { status: 400 })
    }

    const orderItems = normalizedItems.map((item) => {
      const menu = item.menuId ? menusById.get(item.menuId) : null

      return {
        order_id: order.id,
        menu_id: item.menuId || null,
        custom_name: item.customName || null,
        is_special: item.isSpecial,
        item_note: item.itemNote || null,
        quantity: item.quantity,
        price: menu ? Number(menu.price) : 0,
      }
    })

    const { error: orderItemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (orderItemsError) {
      if (orderItemsError.message?.includes('schema cache') || orderItemsError.message?.includes('custom_name')) {
        return NextResponse.json({
          error: 'ฐานข้อมูลยังไม่มีคอลัมน์สำหรับรูปแบบร้าน/เมนูเขียนเอง กรุณารันไฟล์ supabase/sql/restaurant_order_types.sql ใน Supabase SQL Editor ก่อน',
        }, { status: 400 })
      }

      return NextResponse.json({ error: orderItemsError.message }, { status: 400 })
    }

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'order_created',
        title: 'สร้างคำสั่งซื้อใหม่',
        detail: `Order #${order.order_no || String(order.id).slice(0, 8)} ยอดรวม ฿${totalPrice.toLocaleString('th-TH')} รับเวลา ${pickupTime} ชำระเงิน ${paymentMethodLabel}`,
      })

    await createOrderNotifications({
      supabaseAdmin,
      customerId: user.id,
      restaurantId,
      restaurantName: restaurant.name || 'ร้านอาหาร',
      restaurantOwnerId: restaurant.owner_id || null,
      restaurantEmail: restaurant.email || null,
      orderId: order.id,
      orderNo: order.order_no,
      totalPrice,
      pickupTime,
      paymentMethodLabel,
      customerName: customerDisplayName,
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNo: order.order_no,
      totalPrice,
      paymentMethod,
      paymentMethodLabel,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในระบบสั่งอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
