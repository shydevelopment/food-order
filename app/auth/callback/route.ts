import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // รับค่า next ที่ส่งมาจากหน้า Forgot Password (เช่น /reset-password)
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    
    // นำ Code ที่ได้จากอีเมลไปแลกเป็น Session ยืนยันตัวตน
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // ⚡ ลบ supabase.auth.signOut() ออก เพื่อเก็บ Session สำหรับหน้า /reset-password
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // เข้ารหัสภาษาไทยด้วย encodeURIComponent ป้องกัน Header Error
  const errorMessage = encodeURIComponent('ลิงก์ยืนยันตัวตนไม่ถูกต้องหรือหมดอายุแล้ว')
  return NextResponse.redirect(new URL(`/login?message=${errorMessage}`, requestUrl.origin))
}