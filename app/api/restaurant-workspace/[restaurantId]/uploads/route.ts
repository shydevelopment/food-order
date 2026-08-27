import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

const BUCKET_NAME = 'menu-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const getAdminClient = () => createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RestaurantRow = {
  id: string
  owner_id: string | null
  email: string | null
}

type ProfileRow = {
  id: string
  role: string | null
  email: string | null
}

const verifyRestaurantManager = async (restaurantId: string) => {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) }
  }

  const supabaseAdmin = getAdminClient()
  const [profileResult, restaurantResult, memberResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, role, email')
      .eq('id', user.id)
      .single(),
    supabaseAdmin
      .from('restaurants')
      .select('id, owner_id, email')
      .eq('id', restaurantId)
      .single(),
    supabaseAdmin
      .from('restaurant_members')
      .select('id, access_level')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const profile = profileResult.data as ProfileRow | null
  const restaurant = restaurantResult.data as RestaurantRow | null

  if (profileResult.error || !profile || !['admin', 'restaurant'].includes(profile.role || '')) {
    return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าพื้นที่ร้านอาหาร' }, { status: 403 }) }
  }

  if (restaurantResult.error || !restaurant) {
    return { error: NextResponse.json({ error: 'ไม่พบร้านอาหารนี้' }, { status: 404 }) }
  }

  if (memberResult.error) {
    console.error('Error checking restaurant upload access:', memberResult.error.message)
  }

  const member = memberResult.data
  const canManage = Boolean(
    profile.role === 'admin' ||
    restaurant.owner_id === user.id ||
    (profile.email && restaurant.email === profile.email) ||
    member?.access_level === 'owner'
  )

  if (!canManage) {
    return { error: NextResponse.json({ error: 'เฉพาะ Owner เท่านั้นที่อัปโหลดรูปภาพได้' }, { status: 403 }) }
  }

  return { supabaseAdmin }
}

const sanitizePathPart = (value: string) => {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'uploads'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const { restaurantId } = await params
    const auth = await verifyRestaurantManager(restaurantId)
    if (auth.error) return auth.error

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'กรุณาเลือกรูปภาพก่อนอัปโหลด' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพเท่านั้น' }, { status: 400 })
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'รูปภาพต้องมีขนาดไม่เกิน 5MB' }, { status: 400 })
    }

    const folder = sanitizePathPart(String(formData.get('folder') || 'menus'))
    const safeRestaurantId = sanitizePathPart(restaurantId)
    const extension = sanitizePathPart(file.name.split('.').pop() || 'jpg').toLowerCase()
    const storagePath = `${folder}/${safeRestaurantId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
    const fileBody = await file.arrayBuffer()

    const { error: uploadError } = await auth.supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBody, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data } = auth.supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)

    return NextResponse.json({
      publicUrl: data.publicUrl,
      storagePath,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
