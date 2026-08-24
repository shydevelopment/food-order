import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

const BUCKET_NAME = 'menu-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const getAdminClient = () => createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์อัปโหลดรูปภาพร้าน' }, { status: 403 }) }
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

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin()
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

    const folder = sanitizePathPart(String(formData.get('folder') || 'admin'))
    const extension = sanitizePathPart(file.name.split('.').pop() || 'jpg').toLowerCase()
    const storagePath = `${folder}/${Date.now()}-${crypto.randomUUID()}.${extension}`
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
