import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/components/reset-password-form' 

export default async function ResetPasswordPage() {
  const supabase = await createClient()

  // 1. ตรวจสอบ Session ชั่วคราวของผู้ใช้จากการคลิกลิงก์อีเมล
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    const errorMessage = encodeURIComponent('เซสชันไม่ถูกต้อง กรุณาใช้ลิงก์กู้คืนรหัสผ่านจากอีเมลของคุณ')
    redirect(`/login?message=${errorMessage}`)
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-2 sm:p-4">
      <main className="flex w-full flex-col items-center justify-center p-0 sm:p-4">
        
        {/* ฟอร์มกรอกรหัสผ่านใหม่ */}
        <ResetPasswordForm />

      </main>
    </div>
  )
}
