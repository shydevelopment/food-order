import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { getKmutnbStudentUsernameFromEmail, resolveAccountRoleForEmail } from '@/lib/roles'
import { validatePasswordPolicy } from '@/lib/password-policy'
import { DUPLICATE_PHONE_MESSAGE, validateThaiPhone } from '@/lib/phone'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }

    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์สร้างบัญชีผู้ใช้' }, { status: 403 })
    }

    const { email, password, username, fullName, phone, role } = await req.json()
    const accountRole = resolveAccountRoleForEmail(email, role)
    const studentId = accountRole === 'student' ? getKmutnbStudentUsernameFromEmail(email) || username : null
    const phoneValidation = validateThaiPhone(phone)

    if (!email || !password || !username || !fullName) {
      return NextResponse.json(
        { error: 'กรุณากรอกอีเมล รหัสผ่าน ชื่อผู้ใช้ และชื่อจริงให้ครบ' },
        { status: 400 }
      )
    }

    const passwordPolicyError = validatePasswordPolicy(password)
    if (passwordPolicyError) {
      return NextResponse.json(
        { error: passwordPolicyError },
        { status: 400 }
      )
    }

    if (!phoneValidation.success) {
      return NextResponse.json(
        { error: phoneValidation.message },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existingPhoneProfile, error: phoneLookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', phoneValidation.phone)
      .maybeSingle()

    if (phoneLookupError) {
      return NextResponse.json({ error: phoneLookupError.message }, { status: 400 })
    }

    if (existingPhoneProfile) {
      return NextResponse.json({ error: DUPLICATE_PHONE_MESSAGE }, { status: 409 })
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
        display_name: fullName,
        phone: phoneValidation.phone,
        student_id: studentId,
        role: accountRole,
      },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!createdUser.user) {
      return NextResponse.json({ error: 'ไม่สามารถสร้างบัญชีผู้ใช้ได้' }, { status: 400 })
    }

    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: createdUser.user.id,
          username,
          email,
          full_name: fullName,
          phone: phoneValidation.phone,
          student_id: studentId,
          role: accountRole,
        },
        { onConflict: 'id' }
      )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'เพิ่มบัญชีผู้ใช้สำเร็จ',
      userId: createdUser.user.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในระบบ'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
