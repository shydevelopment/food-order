import { headers } from 'next/headers'
import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import { getKmutnbStudentUsernameFromEmail, resolveAccountRoleForEmail } from '@/lib/roles'
import { getSiteUrl } from '@/lib/site-url'
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
    const phone = formData.get('phone') as string
    const accountRole = resolveAccountRoleForEmail(email)
    const username = getKmutnbStudentUsernameFromEmail(email) || rawUsername

    if (password !== confirmPassword) {
      redirect(`/register?message=${encodeURIComponent('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')}`)
    }

    const requestHeaders = await headers()
    const siteUrl = getSiteUrl(requestHeaders)

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/register-success`,
        data: {
          username: username,
          display_name: displayName,
          phone: phone,
          role: accountRole,
        },
      },
    })

    if (error) {
      redirect(`/register?message=${encodeURIComponent(error.message)}`)
    }

    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      const msg = encodeURIComponent('อีเมลนี้ถูกใช้งานและยืนยันตัวตนแล้ว กรุณาเข้าสู่ระบบ')
      redirect(`/login?message=${msg}`)
    }

    const successMsg = encodeURIComponent('สมัครสมาชิกสำเร็จ! ระบบได้ส่งอีเมลสำหรับยืนยันตัวตนไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบกล่องข้อความ (รวมถึงจดหมายขยะ) เพื่อเปิดใช้งานบัญชี')
    
    redirect(`/login?message=${successMsg}&type=success`)
  }

  const signUpWithGoogle = async () => {
    'use server'

    const requestHeaders = await headers()
    const siteUrl = getSiteUrl(requestHeaders)
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=/oauth-profile`,
      },
    })

    if (error || !data.url) {
      redirect(`/register?message=${encodeURIComponent(error?.message || 'ไม่สามารถสมัครด้วย Google ได้')}`)
    }

    redirect(data.url)
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-2 sm:p-4">
      <main className="flex w-full flex-col items-center justify-center p-0 sm:p-4">
        <RegisterForm
          signUpAction={signUpAction}
          googleSignInAction={signUpWithGoogle}
          message={resolvedSearchParams?.message}
        />
      </main>
    </div>
  )
}
