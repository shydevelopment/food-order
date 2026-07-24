import { headers } from 'next/headers'
import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'

// 💡 นำเข้าฟอร์มหน้าบ้าน
import RegisterForm from '@/components/register-form'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams

  // ==========================================
  // ⚙️ ส่วนที่ 1: ระบบจัดการการสมัครสมาชิก (Server Action)
  // ==========================================
  const signUpAction = async (formData: FormData) => {
    'use server'

    // 💡 1. ดึงข้อมูลทุกช่องที่กรอกมาจากฟอร์ม
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const username = formData.get('username') as string
    const displayName = formData.get('displayName') as string
    const phone = formData.get('phone') as string

    // 💡 2. เช็คว่ารหัสผ่าน 2 ช่องตรงกันไหม (ถ้าไม่ตรงให้เด้งกลับไปแจ้งเตือน)
    if (password !== confirmPassword) {
      redirect(`/register?message=${encodeURIComponent('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')}`)
    }

    const requestHeaders = await headers()
    const origin = requestHeaders.get('origin') || 'http://localhost:3000'

    const supabase = await createClient()

    // 💡 3. ส่งคำขอสมัครสมาชิก พร้อมแนบข้อมูลอื่นๆ ไปเก็บไว้ใน metadata
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/register-success`,
        data: {
          username: username,
          display_name: displayName,
          phone: phone,
        },
      },
    })

    if (error) {
      redirect(`/register?message=${encodeURIComponent(error.message)}`)
    }

    const successMsg = 'สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันตัวตน'
    redirect(`/login?message=${encodeURIComponent(successMsg)}`)
  }

  // ==========================================
  // 🖥️ ส่วนที่ 2: ส่วนแสดงผลหน้าจอ (React Component)
  // ==========================================
  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh]">
      <main className="w-full flex flex-col items-center justify-center p-4">
        <RegisterForm
          signUpAction={signUpAction}
          message={resolvedSearchParams?.message}
        />
      </main>
    </div>
  )
}