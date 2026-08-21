import { headers } from 'next/headers'
import { createClient } from '@/supabase/service'
import { ForgotPasswordForm } from '@/components/forgot-password-form' 
import { getSiteUrl } from '@/lib/site-url'

export default async function ForgotPasswordPage() {
  
  const sendResetLink = async (formData: FormData) => {
    'use server'
    
    try {
      const email = formData.get('email') as string
      
      // ดึง URL กลาง รองรับ Production, Vercel Preview และ Localhost
      const requestHeaders = await headers()
      const siteUrl = getSiteUrl(requestHeaders)

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(email)) {
        return { success: false, message: 'รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' }
      }

      const supabase = await createClient()
      
      // 💡 อัปเดต redirectTo ให้ปลายทางวิ่งไปที่ /reset-password แทนหน้าเดิมแล้วครับ
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password`,
      })

      if (error) {
        return { success: false, message: error.message }
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ระบบหลังบ้านเกิดข้อผิดพลาด'
      return { success: false, message }
    }
  }

  return (
    <ForgotPasswordForm sendAction={sendResetLink} />
  )
}
