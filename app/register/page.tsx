import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import { getKmutnbStudentUsernameFromEmail, resolveAccountRoleForEmail } from '@/lib/roles'
import { validatePasswordPolicy } from '@/lib/password-policy'
import { DUPLICATE_PHONE_MESSAGE, validateThaiPhone } from '@/lib/phone'
import { createAdminClient } from '@/supabase/admin'
import RegisterForm from '@/components/register-form'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams
  const currentSupabase = await createClient()
  const { data: { user: currentUser } } = await currentSupabase.auth.getUser()

  if (currentUser) {
    redirect('/')
  }

  const signUpAction = async (formData: FormData) => {
    'use server'

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const rawUsername = formData.get('username') as string
    const displayName = formData.get('displayName') as string
    const phoneValidation = validateThaiPhone(formData.get('phone'))
    if (!phoneValidation.success) {
      redirect(`/register?message=${encodeURIComponent(phoneValidation.message)}`)
    }

    const phone = phoneValidation.phone
    const signupType = formData.get('signupType') as string
    const accountRole = resolveAccountRoleForEmail(email)
    const studentId = getKmutnbStudentUsernameFromEmail(email)
    const username = studentId || rawUsername

    if (signupType === 'student' && !studentId) {
      redirect(`/register?message=${encodeURIComponent('กรุณาใช้อีเมลมหาลัยรูปแบบ @email.kmutnb.ac.th สำหรับบัญชีนักศึกษา')}`)
    }

    if (!username?.trim()) {
      redirect(`/register?message=${encodeURIComponent('กรุณากรอก Username ให้ถูกต้อง')}`)
    }

    if (password !== confirmPassword) {
      redirect(`/register?message=${encodeURIComponent('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')}`)
    }

    const passwordPolicyError = validatePasswordPolicy(password)
    if (passwordPolicyError) {
      redirect(`/register?message=${encodeURIComponent(passwordPolicyError)}`)
    }

    const supabase = await createClient()

    const { data: existingPhoneProfile, error: phoneLookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (phoneLookupError) {
      redirect(`/register?message=${encodeURIComponent(phoneLookupError.message)}`)
    }

    if (existingPhoneProfile) {
      redirect(`/register?message=${encodeURIComponent(DUPLICATE_PHONE_MESSAGE)}`)
    }

    // Login is enabled immediately; email ownership is tracked in protected app metadata.
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      app_metadata: { email_verification_required: true },
      user_metadata: {
        username,
        full_name: displayName,
        display_name: displayName,
        phone,
        student_id: accountRole === 'student' ? studentId : null,
        role: accountRole,
      },
    })

    if (error) {
      redirect(`/register?message=${encodeURIComponent(error.message)}`)
    }

    redirect(`/login?message=${encodeURIComponent('สมัครสมาชิกสำเร็จแล้ว กรุณาเข้าสู่ระบบอีกครั้ง')}&type=success`)
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-2 sm:p-4">
      <main className="flex w-full flex-col items-center justify-center p-0 sm:p-4">
        <RegisterForm
          signUpAction={signUpAction}
          message={resolvedSearchParams?.message}
        />
      </main>
    </div>
  )
}
