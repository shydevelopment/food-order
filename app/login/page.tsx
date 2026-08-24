import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, setAuthRememberPreference } from '@/supabase/service'
import { syncStudentRoleForUser } from '@/lib/student-role-sync'
import {
  getTurnstileSiteKey,
  shouldEnforceTurnstile,
  verifyTurnstileToken,
} from '@/lib/turnstile'
import LoginForm from '@/components/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; type?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const currentSupabase = await createClient()
  const { data: { user: currentUser } } = await currentSupabase.auth.getUser()

  if (currentUser) {
    redirect('/')
  }

  const signIn = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const rememberSession = formData.get('remember') === 'on'
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      redirect(`/login?message=${encodeURIComponent('รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')}`)
    }

    if (shouldEnforceTurnstile()) {
      const requestHeaders = await headers()
      const remoteIp =
        requestHeaders.get('cf-connecting-ip') ??
        requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()

      const turnstile = await verifyTurnstileToken(formData.get('cf-turnstile-response'), {
        action: 'login',
        remoteIp,
      })

      if (!turnstile.success) {
        redirect(`/login?message=${encodeURIComponent('กรุณายืนยัน Cloudflare ให้สำเร็จก่อนเข้าสู่ระบบ')}`)
      }
    }

    await setAuthRememberPreference(rememberSession)

    const supabase = await createClient({ rememberSession })

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const normalizedMessage = error.message.toLowerCase()
      if (
        normalizedMessage.includes('email not confirmed') ||
        normalizedMessage.includes('email_not_confirmed') ||
        normalizedMessage.includes('confirm')
      ) {
        redirect(`/login?message=${encodeURIComponent('บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณาตรวจสอบกล่องข้อความหรือจดหมายขยะ แล้วกดลิงก์ยืนยันก่อนเข้าสู่ระบบ')}`)
      }

      redirect(`/login?message=${encodeURIComponent('อีเมลหรือรหัสผ่านไม่ถูกต้อง')}`)
    }

    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut()
      redirect(`/login?message=${encodeURIComponent('บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ')}`)
    }

    if (data.user) {
      await syncStudentRoleForUser({
        id: data.user.id,
        email: data.user.email,
        userMetadata: data.user.user_metadata,
      })
    }

    redirect('/') 
  }

  return (
    <LoginForm
      signInAction={signIn}
      message={resolvedSearchParams?.message}
      messageType={resolvedSearchParams?.type === 'success' ? 'success' : 'error'}
      turnstileSiteKey={getTurnstileSiteKey()}
    />
  )
}
