import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { RESTAURANT_ACCESS_LEVEL_VALUES } from '@/lib/roles'

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
    return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการสิทธิ์ร้านอาหาร' }, { status: 403 }) }
  }

  return { supabaseAdmin, userId: user.id }
}

export async function GET() {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const { supabaseAdmin } = auth

    const [
      profilesResult,
      restaurantsResult,
      membersResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, email, phone, avatar_url, role')
        .order('username', { ascending: true }),
      supabaseAdmin
        .from('restaurants')
        .select('id, name, owner_id')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('restaurant_members')
        .select('id, restaurant_id, user_id, access_level, created_at')
        .order('created_at', { ascending: false }),
    ])

    if (profilesResult.error || restaurantsResult.error) {
      return NextResponse.json(
        { error: profilesResult.error?.message || restaurantsResult.error?.message },
        { status: 400 }
      )
    }

    if (membersResult.error) {
      return NextResponse.json(
        {
          error: membersResult.error.message,
          setupRequired: true,
          message: 'ยังไม่มีตาราง restaurant_members กรุณารัน SQL ที่ supabase/sql/restaurant_members.sql ก่อน',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      profiles: profilesResult.data || [],
      restaurants: restaurantsResult.data || [],
      members: membersResult.data || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดสิทธิ์ร้านอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const { supabaseAdmin, userId: adminUserId } = auth
    const { restaurantId, userId, accessLevel } = await req.json()

    if (!restaurantId || !userId || !RESTAURANT_ACCESS_LEVEL_VALUES.includes(accessLevel)) {
      return NextResponse.json({ error: 'กรุณาเลือกร้าน ผู้ใช้ และระดับสิทธิ์ให้ครบ' }, { status: 400 })
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, role')
      .eq('id', userId)
      .single()

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้งานนี้' }, { status: 404 })
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name')
      .eq('id', restaurantId)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'ไม่พบร้านอาหารนี้' }, { status: 404 })
    }

    if (accessLevel === 'owner') {
      await supabaseAdmin
        .from('restaurant_members')
        .update({ access_level: 'staff' })
        .eq('restaurant_id', restaurantId)
        .eq('access_level', 'owner')

      const { error: ownerUpdateError } = await supabaseAdmin
        .from('restaurants')
        .update({ owner_id: userId })
        .eq('id', restaurantId)

      if (ownerUpdateError) {
        return NextResponse.json({ error: ownerUpdateError.message }, { status: 400 })
      }
    }

    const nextAccountRole = targetProfile.role === 'admin' ? 'admin' : 'restaurant'
    if (targetProfile.role !== nextAccountRole) {
      const { error: roleUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: nextAccountRole })
        .eq('id', userId)

      if (roleUpdateError) {
        return NextResponse.json({ error: roleUpdateError.message }, { status: 400 })
      }
    }

    const { error: upsertError } = await supabaseAdmin
      .from('restaurant_members')
      .upsert(
        {
          restaurant_id: restaurantId,
          user_id: userId,
          access_level: accessLevel,
        },
        { onConflict: 'restaurant_id,user_id' }
      )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: adminUserId,
        action_type: 'restaurant_access_updated',
        title: 'จัดสิทธิ์ร้านอาหาร',
        detail: `${targetProfile.full_name || targetProfile.username || userId} เป็น ${accessLevel} ของร้าน ${restaurant.name} และ role เป็น ${nextAccountRole}`,
      })

    return NextResponse.json({ success: true, role: nextAccountRole })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเพิ่มสิทธิ์ร้านอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const { supabaseAdmin, userId: adminUserId } = auth
    const { memberId } = await req.json()

    if (!memberId) {
      return NextResponse.json({ error: 'กรุณาระบุรายการสิทธิ์ที่ต้องการลบ' }, { status: 400 })
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from('restaurant_members')
      .select('id, restaurant_id, user_id, access_level')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'ไม่พบรายการสิทธิ์นี้' }, { status: 404 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('restaurant_members')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    if (member.access_level === 'owner') {
      await supabaseAdmin
        .from('restaurants')
        .update({ owner_id: null })
        .eq('id', member.restaurant_id)
        .eq('owner_id', member.user_id)
    }

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: adminUserId,
        action_type: 'restaurant_access_removed',
        title: 'ลบสิทธิ์ร้านอาหาร',
        detail: `ลบสิทธิ์ ${member.access_level} จาก restaurant ${member.restaurant_id}`,
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบสิทธิ์ร้านอาหาร'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
