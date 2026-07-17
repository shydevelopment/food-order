import { headers } from 'next/headers'
import { createClient } from '@/supabase/service'
import { ForgotPasswordForm } from '@/components/forgot-password-form' 

export default async function ForgotPasswordPage() {
  
  const sendResetLink = async (formData: FormData) => {
    'use server'
    
    try {
      const email = formData.get('email') as string
      
      // ดักจับค่า origin และใส่ค่า fallback ป้องกันกรณีหลุดเป็น null
      const requestHeaders = await headers()
      const origin = requestHeaders.get('origin') || 'http://localhost:3000'

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(email)) {
        return { success: false, message: 'รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' }
      }

      const supabase = await createClient()
      
      // 💡 อัปเดต redirectTo ให้ปลายทางวิ่งไปที่ /reset-password แทนหน้าเดิมแล้วครับ
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      })

      if (error) {
        return { success: false, message: error.message }
      }

      return { success: true }
    } catch (err: any) {
      return { success: false, message: err.message || 'ระบบหลังบ้านเกิดข้อผิดพลาด' }
    }
  }

  return (
    <ForgotPasswordForm sendAction={sendResetLink} />
  )
}