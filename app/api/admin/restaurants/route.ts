import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { DEFAULT_RESTAURANT_TYPE, RESTAURANT_TYPE_VALUES } from '@/lib/restaurant-types'
import { validateThaiPhone } from '@/lib/phone'

const getAdminClient = () => createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_PATTERN = /^\d{2}:\d{2}(?::\d{2})?$/

const verifyAdmin = async () => {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) }
  }

  const supabaseAdmin = getAdminClient()
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการร้านอาหาร' }, { status: 403 }) }
  }

  return { supabaseAdmin, userId: user.id }
}

const normalizeRestaurantPayload = (body: Record<string, unknown>) => {
  const requestedRestaurantType = String(body.restaurant_type || '')
  const restaurantType = RESTAURANT_TYPE_VALUES.includes(requestedRestaurantType as typeof RESTAURANT_TYPE_VALUES[number])
    ? requestedRestaurantType
    : DEFAULT_RESTAURANT_TYPE

  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim() || null,
    phone: String(body.phone || '').trim() || null,
    address: String(body.address || '').trim() || null,
    status: String(body.status || 'open'),
    image_url: String(body.image_url || '').trim() || null,
    description: String(body.description || '').trim() || null,
    open_time: String(body.open_time || '08:00:00'),
    close_time: String(body.close_time || '20:00:00'),
    restaurant_type: restaurantType,
  }
}

const validateRestaurantPayload = (payload: ReturnType<typeof normalizeRestaurantPayload>, options: { requireImage: boolean }) => {
  if (!payload.name) return 'กรุณากรอกชื่อร้านอาหาร'
  if (!payload.email) return 'กรุณากรอกอีเมลร้านอาหาร'
  if (!EMAIL_PATTERN.test(payload.email)) return 'กรุณากรอกรูปแบบอีเมลร้านอาหารให้ถูกต้อง'

  const phoneValidation = validateThaiPhone(payload.phone)
  if (!phoneValidation.success) return phoneValidation.message
  payload.phone = phoneValidation.phone

  if (!payload.description) return 'กรุณากรอกคำอธิบายรายละเอียดร้าน'
  if (!payload.address) return 'กรุณากรอกที่อยู่ร้านอาหาร'
  if (!payload.open_time || !TIME_PATTERN.test(payload.open_time)) return 'กรุณากรอกเวลาเปิดทำการ'
  if (!payload.close_time || !TIME_PATTERN.test(payload.close_time)) return 'กรุณากรอกเวลาปิดทำการ'
  if (!['open', 'closed'].includes(payload.status)) return 'กรุณาเลือกสถานะร้านค้า'
  if (options.requireImage && !payload.image_url) return 'กรุณาอัปโหลดรูปภาพโลโก้หน้าร้าน'
  if (!payload.restaurant_type) return 'กรุณาเลือกรูปแบบร้าน'

  return null
}

export async function GET() {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const { data, error } = await auth.supabaseAdmin
      .from('restaurants')
      .select('id, name, image_url, email, phone, address, status, description, open_time, close_time, restaurant_type')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ restaurants: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดร้านอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const payload = normalizeRestaurantPayload(body)
    const validationError = validateRestaurantPayload(payload, { requireImage: true })

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { data, error } = await auth.supabaseAdmin
      .from('restaurants')
      .insert(payload)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await auth.supabaseAdmin.from('activity_logs').insert({
      user_id: auth.userId,
      action_type: 'restaurant_created',
      title: 'เพิ่มร้านอาหารใหม่',
      detail: `เพิ่มร้าน "${payload.name}" เข้าสู่ระบบ`,
    })

    return NextResponse.json({ restaurant: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเพิ่มร้านอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const restaurantId = String(body.id || '').trim()
    const payload = normalizeRestaurantPayload(body)

    if (!restaurantId) {
      return NextResponse.json({ error: 'ไม่พบรหัสร้านอาหารที่ต้องการแก้ไข' }, { status: 400 })
    }

    if (!payload.name) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อร้านอาหาร' }, { status: 400 })
    }

    const { data, error } = await auth.supabaseAdmin
      .from('restaurants')
      .update(payload)
      .eq('id', restaurantId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await auth.supabaseAdmin.from('activity_logs').insert({
      user_id: auth.userId,
      action_type: 'restaurant_updated',
      title: 'แก้ไขข้อมูลร้านอาหาร',
      detail: `แก้ไขร้าน "${payload.name}"`,
    })

    return NextResponse.json({ restaurant: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการแก้ไขร้านอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const { id, name } = await req.json()
    const restaurantId = String(id || '').trim()
    const restaurantName = String(name || '').trim()

    if (!restaurantId) {
      return NextResponse.json({ error: 'ไม่พบรหัสร้านอาหารที่ต้องการลบ' }, { status: 400 })
    }

    const { error } = await auth.supabaseAdmin
      .from('restaurants')
      .delete()
      .eq('id', restaurantId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await auth.supabaseAdmin.from('activity_logs').insert({
      user_id: auth.userId,
      action_type: 'restaurant_deleted',
      title: 'ลบร้านอาหาร',
      detail: `ลบร้าน "${restaurantName || restaurantId}"`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบร้านอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
