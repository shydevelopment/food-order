import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // รับค่า next ที่เราส่งมาจากหน้า Register
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    
    // นำ Code ที่ได้จากอีเมลไปแลกเป็น Session ยืนยันตัวตน
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // 💡 บังคับ Logout เพื่อให้ผู้ใช้ต้องกรอกรหัสผ่านใหม่ที่หน้า Login
      await supabase.auth.signOut() 

      // 💡 ใช้ new URL() เพื่อให้ Next.js จัดการต่อ path ให้ถูกต้องเสมอ ป้องกันปัญหา Slash (/) ซ้อนกัน
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // 💡 เข้ารหัสภาษาไทยด้วย encodeURIComponent เพื่อป้องกัน URL Error บน Production
  const errorMessage = encodeURIComponent('ลิงก์ยืนยันตัวตนไม่ถูกต้องหรือหมดอายุแล้ว')
  return NextResponse.redirect(new URL(`/login?message=${errorMessage}`, requestUrl.origin))
}