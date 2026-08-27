import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { getNotificationFeed } from '@/lib/notification-feed'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อน' },
        { status: 401 },
      )
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const feed = await getNotificationFeed(supabaseAdmin, user.id)

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      items: feed.items,
      count: feed.items.filter((item) => !item.is_read || item.is_active_order)
        .length,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดในการโหลดแจ้งเตือน'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อน' },
        { status: 401 },
      )
    }

    const body = await req.json()
    const itemKey = String(body.id || '').trim()

    if (!itemKey) {
      return NextResponse.json(
        { error: 'ไม่พบแจ้งเตือนที่ต้องการอัปเดต' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('item_key', itemKey)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดในการอ่านแจ้งเตือน'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
