import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { syncStudentRoleForUser } from '@/lib/student-role-sync'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        await syncStudentRoleForUser({
          id: user.id,
          email: user.email,
          userMetadata: user.user_metadata,
        })
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  const errorMessage = encodeURIComponent('ลิงก์ยืนยันตัวตนไม่ถูกต้องหรือหมดอายุแล้ว')
  return NextResponse.redirect(new URL(`/login?message=${errorMessage}`, requestUrl.origin))
}
