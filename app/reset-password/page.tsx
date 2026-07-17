import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/components/reset-password-form'

export default async function ResetPasswordPage() {
  const supabase = await createClient()

  // 1. ตรวจสอบว่าผู้ใช้งานได้รับสิทธิ์ล็อกอินชั่วคราวจากการคลิกลิงก์กู้คืนในอีเมลมาแล้วหรือไม่
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // หากไม่มีสิทธิ์ หรือเปิดหน้านี้ขึ้นมาตรงๆ โดยไม่ได้ผ่านอีเมล ให้ส่งกลับไปหน้าเข้าสู่ระบบ
    redirect('/login?message=เซสชันไม่ถูกต้อง กรุณาใช้ลิงก์กู้คืนรหัสผ่านจากอีเมลของคุณ')
  }

  return (
    // จัดโครงสร้างให้กล่อง Card UI อยู่กึ่งกลางจอคอมพิวเตอร์ตามดีไซน์เดิมของคุณ
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh]">
      <main className="w-full flex flex-col items-center justify-center p-4">
        
        {/* เรียกใช้งานฟอร์มกรอกรหัสผ่านใหม่ */}
        <ResetPasswordForm />

      </main>
    </div>
  )
}