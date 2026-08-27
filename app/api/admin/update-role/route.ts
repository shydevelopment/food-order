import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { ACCOUNT_ROLE_VALUES, canHaveRestaurantAccess, getAccountRoleMeta, getProfileStudentId, resolveAccountRoleForEmail } from '@/lib/roles'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }

    const { userId, role } = await req.json()

    if (!userId || !ACCOUNT_ROLE_VALUES.includes(role)) {
      return NextResponse.json({ error: 'ข้อมูล Role ไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminProfileError || adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เปลี่ยน Role ผู้ใช้งาน' }, { status: 403 })
    }

    if (userId === user.id && role !== 'admin') {
      return NextResponse.json(
        { error: 'ไม่สามารถลดสิทธิ์ Admin ของบัญชีตัวเองได้' },
        { status: 400 }
      )
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, email, role, student_id')
      .eq('id', userId)
      .single()

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้งานนี้' }, { status: 404 })
    }

    const resolvedRole = resolveAccountRoleForEmail(targetProfile.email, role)
    const studentId = resolvedRole === 'student'
      ? getProfileStudentId({ ...targetProfile, role: resolvedRole }, targetProfile.email)
      : null

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: resolvedRole, student_id: studentId })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const currentMetadata = authUser.user?.user_metadata || {}

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMetadata,
        role: resolvedRole,
        student_id: studentId,
      },
    })

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 })
    }

    if (!canHaveRestaurantAccess(resolvedRole)) {
      await supabaseAdmin
        .from('restaurants')
        .update({ owner_id: null })
        .eq('owner_id', userId)

      await supabaseAdmin
        .from('restaurant_members')
        .delete()
        .eq('user_id', userId)
    }

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'role_updated',
        title: 'เปลี่ยน Role ผู้ใช้งาน',
        detail: `${targetProfile.full_name || targetProfile.username || userId} เปลี่ยนจาก ${getAccountRoleMeta(targetProfile.role)?.thaiLabel || 'User'} เป็น ${getAccountRoleMeta(resolvedRole)?.thaiLabel || 'User'}`,
      })

    return NextResponse.json({ success: true, role: resolvedRole })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเปลี่ยน Role'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
