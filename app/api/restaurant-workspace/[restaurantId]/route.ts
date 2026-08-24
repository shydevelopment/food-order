import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { DEFAULT_RESTAURANT_TYPE, RESTAURANT_TYPE_VALUES } from '@/lib/restaurant-types'
import { ALL_WEEKDAY_VALUES, normalizeMenuAvailableDays } from '@/lib/menu-days'

const getAdminClient = () => createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RestaurantRow {
  id: string
  name: string
  owner_id: string | null
  email: string | null
}

interface ProfileRow {
  id: string
  role: string | null
  email: string | null
}

const getWorkspaceAuth = async (restaurantId: string) => {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) }
  }

  const supabaseAdmin = getAdminClient()

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !['admin', 'restaurant'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าพื้นที่ร้านอาหาร' }, { status: 403 }) }
  }

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, owner_id, email')
    .eq('id', restaurantId)
    .single()

  if (restaurantError || !restaurant) {
    return { error: NextResponse.json({ error: 'ไม่พบร้านอาหารนี้' }, { status: 404 }) }
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('restaurant_members')
    .select('id, access_level')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    console.error('Error checking restaurant member access:', memberError.message)
  }

  const restaurantRow = restaurant as RestaurantRow
  const profileRow = profile as ProfileRow
  const isAdmin = profileRow.role === 'admin'
  const isOwner = Boolean(
    isAdmin ||
    restaurantRow.owner_id === user.id ||
    (profileRow.email && restaurantRow.email === profileRow.email) ||
    member?.access_level === 'owner'
  )
  const canView = Boolean(isOwner || member)

  if (profileRow.role === 'restaurant' && !canView) {
    return { error: NextResponse.json({ error: 'คุณเข้าถึงได้เฉพาะร้านที่ได้รับสิทธิ์เท่านั้น' }, { status: 403 }) }
  }

  return {
    supabaseAdmin,
    user,
    profile: profileRow,
    restaurant: restaurantRow,
    accessLevel: isOwner ? 'owner' : member?.access_level || 'staff',
    canManage: isOwner,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const { restaurantId } = await params
    const auth = await getWorkspaceAuth(restaurantId)
    if (auth.error) return auth.error

    const { supabaseAdmin, user, canManage, accessLevel } = auth

    const [restaurantResult, menusResult, categoriesResult, membersResult] = await Promise.all([
      supabaseAdmin
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single(),
      supabaseAdmin
        .from('menus')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('menu_categories')
        .select('id, restaurant_id, name, created_at')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('restaurant_members')
        .select('id, restaurant_id, user_id, access_level, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }),
    ])

    if (restaurantResult.error) {
      return NextResponse.json({ error: restaurantResult.error.message }, { status: 400 })
    }

    const memberRows = membersResult.data || []
    const userIds = Array.from(new Set([
      restaurantResult.data?.owner_id,
      canManage ? user.id : null,
      ...memberRows.map((member) => member.user_id),
    ].filter(Boolean)))

    const { data: profileRows } = userIds.length > 0
      ? await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, email, phone, avatar_url, role')
        .in('id', userIds)
      : { data: [] }

    const accessByUserId = new Map(memberRows.map((member) => [member.user_id, member]))
    const members = (profileRows || []).map((profile) => {
      const access = accessByUserId.get(profile.id)

      return {
        ...profile,
        member_id: access?.id || null,
        access_level: access?.access_level || (restaurantResult.data?.owner_id === profile.id ? 'owner' : profile.role),
      }
    })

    return NextResponse.json({
      restaurant: restaurantResult.data,
      menus: menusResult.data || [],
      categories: categoriesResult.error ? [] : categoriesResult.data || [],
      members,
      canManage,
      accessLevel,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลร้าน'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const { restaurantId } = await params
    const auth = await getWorkspaceAuth(restaurantId)
    if (auth.error) return auth.error

    if (!auth.canManage) {
      return NextResponse.json({ error: 'เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขข้อมูลร้านได้' }, { status: 403 })
    }

    const body = await req.json()
    const restaurantType = RESTAURANT_TYPE_VALUES.includes(body.restaurant_type)
      ? body.restaurant_type
      : DEFAULT_RESTAURANT_TYPE
    const unavailableIngredients = Array.isArray(body.unavailable_ingredients)
      ? body.unavailable_ingredients.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 50)
      : []

    const { error, data } = await auth.supabaseAdmin
      .from('restaurants')
      .update({
        name: body.name,
        description: body.description || null,
        address: body.address || null,
        phone: body.phone || null,
        email: body.email || null,
        open_time: body.open_time,
        close_time: body.close_time,
        image_url: body.image_url || null,
        restaurant_type: restaurantType,
        unavailable_ingredients: unavailableIngredients,
      })
      .eq('id', restaurantId)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ restaurant: data?.[0] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการแก้ไขร้าน'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const { restaurantId } = await params
    const auth = await getWorkspaceAuth(restaurantId)
    if (auth.error) return auth.error

    if (!auth.canManage) {
      return NextResponse.json({ error: 'เฉพาะเจ้าของร้านเท่านั้นที่จัดการร้านได้' }, { status: 403 })
    }

    const body = await req.json()

    if (body.action === 'menu_availability') {
      const { data, error } = await auth.supabaseAdmin
        .from('menus')
        .update({ is_available: Boolean(body.is_available) })
        .eq('id', body.menuId)
        .eq('restaurant_id', restaurantId)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ menu: data?.[0] })
    }

    if (body.action === 'menu_daily_availability') {
      const availableDays = normalizeMenuAvailableDays(body.available_days, [])

      const { data, error } = await auth.supabaseAdmin
        .from('menus')
        .update({ available_days: availableDays })
        .eq('id', body.menuId)
        .eq('restaurant_id', restaurantId)
        .select()

      if (error) {
        if (error.message?.includes('schema cache') || error.message?.includes('available_days')) {
          return NextResponse.json({
            error: 'ฐานข้อมูลยังไม่มีคอลัมน์จัดการอาหารรายวัน กรุณารันไฟล์ supabase/sql/menu_daily_availability.sql ใน Supabase SQL Editor ก่อน',
          }, { status: 400 })
        }

        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ menu: data?.[0] })
    }

    if (body.action === 'menu_category') {
      const name = String(body.name || '').trim().slice(0, 40)

      if (!name) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อหมวดเมนู' }, { status: 400 })
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
          }, { status: 400 })
        }

        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ category: data })
    }

    if (body.action === 'menu') {
      const availableDays = normalizeMenuAvailableDays(body.available_days, ALL_WEEKDAY_VALUES)
      const categoryId = typeof body.category_id === 'string' && body.category_id.trim()
        ? body.category_id.trim()
        : null

      if (categoryId) {
        const { data: category, error: categoryError } = await auth.supabaseAdmin
          .from('menu_categories')
          .select('id')
          .eq('id', categoryId)
          .eq('restaurant_id', restaurantId)
          .maybeSingle()

        if (categoryError) {
          if (categoryError.message?.includes('schema cache') || categoryError.message?.includes('menu_categories')) {
            return NextResponse.json({
              error: 'ฐานข้อมูลยังไม่มีตารางหมวดเมนู กรุณารันไฟล์ supabase/sql/menu_categories_tags.sql ใน Supabase SQL Editor ก่อน',
            }, { status: 400 })
          }

          return NextResponse.json({ error: categoryError.message }, { status: 400 })
        }

        if (!category) {
          return NextResponse.json({ error: 'หมวดเมนูนี้ไม่ได้อยู่ในร้านนี้' }, { status: 400 })
        }
      }

      const { data, error } = await auth.supabaseAdmin
        .from('menus')
        .insert({
          restaurant_id: restaurantId,
          name: body.name,
          price: Number(body.price),
          description: body.description || null,
          image_url: body.image_url || null,
          is_available: Boolean(body.is_available),
          available_days: availableDays,
          category_id: categoryId,
        })
        .select()

      if (error) {
        if (error.message?.includes('schema cache') || error.message?.includes('category_id')) {
          return NextResponse.json({
            error: 'ฐานข้อมูลยังไม่มีคอลัมน์หมวดเมนู กรุณารันไฟล์ supabase/sql/menu_categories_tags.sql ใน Supabase SQL Editor ก่อน',
          }, { status: 400 })
        }

        if (error.message?.includes('schema cache') || error.message?.includes('available_days')) {
          return NextResponse.json({
            error: 'ฐานข้อมูลยังไม่มีคอลัมน์จัดการอาหารรายวัน กรุณารันไฟล์ supabase/sql/menu_daily_availability.sql ใน Supabase SQL Editor ก่อน',
          }, { status: 400 })
        }

        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ menu: data?.[0] })
    }

    if (body.action === 'member') {
      const identifier = String(body.identifier || '').trim()
      if (!identifier) {
        return NextResponse.json({ error: 'กรุณากรอก username ของลูกน้อง' }, { status: 400 })
      }

      if (identifier.includes('@')) {
        return NextResponse.json({ error: 'ช่องนี้รับเฉพาะ username ไม่รับอีเมล' }, { status: 400 })
      }

      const { data: targetProfile } = await auth.supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, email, role')
        .eq('username', identifier)
        .maybeSingle()

      if (!targetProfile) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้งานนี้' }, { status: 404 })
      }

      if (!['restaurant', 'admin'].includes(targetProfile.role || '')) {
        return NextResponse.json(
          { error: `พบ username นี้แล้ว แต่ role ตอนนี้คือ ${targetProfile.role || 'ไม่มี role'} ต้องเป็น restaurant หรือ admin ก่อน` },
          { status: 400 }
        )
      }

      if (targetProfile.id === auth.user.id) {
        return NextResponse.json({ error: 'บัญชีนี้เป็นผู้จัดการร้านอยู่แล้ว' }, { status: 400 })
      }

      const { error } = await auth.supabaseAdmin
        .from('restaurant_members')
        .upsert(
          {
            restaurant_id: restaurantId,
            user_id: targetProfile.id,
            access_level: 'staff',
          },
          { onConflict: 'restaurant_id,user_id' }
        )

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลร้าน'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const { restaurantId } = await params
    const auth = await getWorkspaceAuth(restaurantId)
    if (auth.error) return auth.error

    if (!auth.canManage) {
      return NextResponse.json({ error: 'เฉพาะเจ้าของร้านเท่านั้นที่ลบข้อมูลนี้ได้' }, { status: 403 })
    }

    const body = await req.json()

    if (body.action === 'menu') {
      const { error } = await auth.supabaseAdmin
        .from('menus')
        .delete()
        .eq('id', body.menuId)
        .eq('restaurant_id', restaurantId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    if (body.action === 'member') {
      const { data: member } = await auth.supabaseAdmin
        .from('restaurant_members')
        .select('id, user_id, access_level')
        .eq('id', body.memberId)
        .eq('restaurant_id', restaurantId)
        .single()

      if (!member) {
        return NextResponse.json({ error: 'ไม่พบสิทธิ์ลูกน้องรายการนี้' }, { status: 404 })
      }

      if (member.access_level === 'owner') {
        return NextResponse.json({ error: 'ไม่สามารถลบเจ้าของร้านจากหน้านี้ได้' }, { status: 400 })
      }

      const { error } = await auth.supabaseAdmin
        .from('restaurant_members')
        .delete()
        .eq('id', body.memberId)
        .eq('restaurant_id', restaurantId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบข้อมูลร้าน'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
