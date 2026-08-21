import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/supabase/service'
import { syncStudentRoleForUser } from '@/lib/student-role-sync'
import { getSiteUrl } from '@/lib/site-url'
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
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      redirect(`/login?message=${encodeURIComponent('รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')}`)
    }

    const supabase = await createClient()

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

  const signInWithGoogle = async () => {
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
      redirect(`/login?message=${encodeURIComponent(error?.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้')}`)
    }

    redirect(data.url)
  }

  return (
    <LoginForm
      signInAction={signIn}
      googleSignInAction={signInWithGoogle}
      message={resolvedSearchParams?.message}
      messageType={resolvedSearchParams?.type === 'success' ? 'success' : 'error'}
    />
  )
}
