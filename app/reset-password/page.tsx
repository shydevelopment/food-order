import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/components/reset-password-form'

export default async function ResetPasswordPage() {
  const supabase = await createClient()

  // 1. ตรวจสอบ Session ชั่วคราวของผู้ใช้จากการคลิกลิงก์อีเมล
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // ⚡ ใช้ encodeURIComponent ครอบข้อความภาษาไทย ป้องกัน Invalid character in header
    const errorMessage = encodeURIComponent('เซสชันไม่ถูกต้อง กรุณาใช้ลิงก์กู้คืนรหัสผ่านจากอีเมลของคุณ')
    redirect(`/login?message=${errorMessage}`)
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh]">
      <main className="w-full flex flex-col items-center justify-center p-4">
        
        {/* ฟอร์มกรอกรหัสผ่านใหม่ */}
        <ResetPasswordForm />

      </main>
    </div>
  )
}