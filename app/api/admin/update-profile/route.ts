import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { getProfileStudentId, resolveAccountRoleForEmail } from '@/lib/roles'
import { DUPLICATE_PHONE_MESSAGE, validateThaiPhone } from '@/lib/phone'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
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
      return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้' }, { status: 403 })
    }

    const { userId, username, email, fullName, phone, role } = await req.json()
    const phoneValidation = validateThaiPhone(phone)

    if (!userId || !username || !email || !fullName) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อผู้ใช้ อีเมล และชื่อจริงให้ครบ' },
        { status: 400 }
      )
    }

    if (!phoneValidation.success) {
      return NextResponse.json({ error: phoneValidation.message }, { status: 400 })
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, email, phone, role, student_id')
      .eq('id', userId)
      .single()

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้งานนี้' }, { status: 404 })
    }

    const { data: existingPhoneProfile, error: phoneLookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', phoneValidation.phone)
      .neq('id', userId)
      .maybeSingle()

    if (phoneLookupError) {
      return NextResponse.json({ error: phoneLookupError.message }, { status: 400 })
    }

    if (existingPhoneProfile) {
      return NextResponse.json({ error: DUPLICATE_PHONE_MESSAGE }, { status: 409 })
    }

    const resolvedRole = resolveAccountRoleForEmail(email, role || targetProfile.role || 'customer')
    const studentId = resolvedRole === 'student'
      ? getProfileStudentId({ ...targetProfile, username, role: resolvedRole }, email)
      : null

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        username,
        email,
        full_name: fullName,
        phone: phoneValidation.phone,
        role: resolvedRole,
        student_id: studentId,
      })
      .eq('id', userId)

    if (profileUpdateError) {
      return NextResponse.json({ error: profileUpdateError.message }, { status: 400 })
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const currentMetadata = authUser.user?.user_metadata || {}

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      user_metadata: {
        ...currentMetadata,
        username,
        full_name: fullName,
        display_name: fullName,
        phone: phoneValidation.phone,
        student_id: studentId,
        role: resolvedRole,
      },
    })

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, role: resolvedRole })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
