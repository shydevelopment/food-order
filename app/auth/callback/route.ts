import { createClient } from '@/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // 💡 แกะค่าพารามิเตอร์ next ออกมาจาก URL (จากในรูปของคุุณคือ %2FeditPage หรือก็คือ /editPage)
  const next = searchParams.get('next') || '/' 

  if (code) {
    const supabase = await createClient()
    
    // 🔐 แลกเปลี่ยน Code ที่ได้จากอีเมล เพื่อสร้างเป็น Session ล็อกอินให้ผู้ใช้โดยอัตโนมัติ
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // หากแลกโค้ดสำเร็จ ให้พาวิ่งตรงไปยังหน้าแก้ไขข้อมูล (/editPage) ทันทีตามที่ตั้งค่าไว้
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // ⚠️ หากเกิดข้อผิดพลาด ลิงก์หมดอายุ หรือโค้ดไม่ถูกต้อง ให้ดีดกลับไปหน้า Login
  return NextResponse.redirect(`${origin}/login?message=ลิงก์กู้คืนรหัสผ่านหมดอายุ หรือทำรายการไม่สำเร็จ`)
}