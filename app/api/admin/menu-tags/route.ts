import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

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
    return { error: NextResponse.json({ error: 'เฉพาะ admin เท่านั้นที่จัดการ tag เมนูได้' }, { status: 403 }) }
  }

  return { supabaseAdmin, userId: user.id }
}

export async function GET() {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const [restaurantsResult, categoriesResult] = await Promise.all([
      auth.supabaseAdmin
        .from('restaurants')
        .select('id, name, restaurant_type')
        .order('name', { ascending: true }),
      auth.supabaseAdmin
        .from('menu_categories')
        .select('id, restaurant_id, name, created_at')
        .order('name', { ascending: true }),
    ])

    if (restaurantsResult.error) {
      return NextResponse.json({ error: restaurantsResult.error.message }, { status: 400 })
    }

    if (categoriesResult.error) {
      if (categoriesResult.error.message?.includes('schema cache') || categoriesResult.error.message?.includes('menu_categories')) {
        return NextResponse.json({
          error: 'ฐานข้อมูลยังไม่มีตารางหมวดเมนู กรุณารันไฟล์ supabase/sql/menu_categories_tags.sql ใน Supabase SQL Editor ก่อน',
          setupRequired: true,
        }, { status: 400 })
      }

      return NextResponse.json({ error: categoriesResult.error.message }, { status: 400 })
    }

    return NextResponse.json({
      restaurants: restaurantsResult.data || [],
      categories: categoriesResult.data || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลด tag เมนู'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const restaurantId = String(body.restaurant_id || '').trim()
    const name = String(body.name || '').trim().slice(0, 40)

    if (!restaurantId) {
      return NextResponse.json({ error: 'กรุณาเลือกร้านอาหาร' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อ tag เมนู' }, { status: 400 })
    }

    const { data: restaurant } = await auth.supabaseAdmin
      .from('restaurants')
      .select('id, name')
      .eq('id', restaurantId)
      .maybeSingle()

    if (!restaurant) {
      return NextResponse.json({ error: 'ไม่พบร้านอาหารนี้' }, { status: 404 })
    }

    const { data, error } = await auth.supabaseAdmin
      .from('menu_categories')
      .upsert(
        {
          restaurant_id: restaurantId,
          name,
        },
        { onConflict: 'restaurant_id,name' }
      )
      .select()
      .single()

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('menu_categories')) {
        return NextResponse.json({
          error: 'ฐานข้อมูลยังไม่มีตารางหมวดเมนู กรุณารันไฟล์ supabase/sql/menu_categories_tags.sql ใน Supabase SQL Editor ก่อน',
          setupRequired: true,
        }, { status: 400 })
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await auth.supabaseAdmin.from('activity_logs').insert({
      user_id: auth.userId,
      action_type: 'menu_category_created',
      title: 'เพิ่ม Tag เมนู',
      detail: `เพิ่ม tag "${name}" ให้ร้าน "${restaurant.name}"`,
      restaurant_id: restaurantId,
    })

    return NextResponse.json({ category: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเพิ่ม tag เมนู'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const categoryId = String(body.id || '').trim()

    if (!categoryId) {
      return NextResponse.json({ error: 'ไม่พบ tag ที่ต้องการลบ' }, { status: 400 })
    }

    const { data: category } = await auth.supabaseAdmin
      .from('menu_categories')
      .select('id, restaurant_id, name')
      .eq('id', categoryId)
      .maybeSingle()

    if (!category) {
      return NextResponse.json({ error: 'ไม่พบ tag นี้' }, { status: 404 })
    }

    const { error } = await auth.supabaseAdmin
      .from('menu_categories')
      .delete()
      .eq('id', categoryId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await auth.supabaseAdmin.from('activity_logs').insert({
      user_id: auth.userId,
      action_type: 'menu_category_deleted',
      title: 'ลบ Tag เมนู',
      detail: `ลบ tag "${category.name}"`,
      restaurant_id: category.restaurant_id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบ tag เมนู'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
