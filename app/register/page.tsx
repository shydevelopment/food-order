import { headers } from 'next/headers'
import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import { resolveAccountRoleForEmail } from '@/lib/roles'
import { getSiteUrl } from '@/lib/site-url'

// 💡 นำเข้าฟอร์มหน้าบ้าน
import RegisterForm from '@/components/register-form'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams
  const currentSupabase = await createClient()
  const { data: { user: currentUser } } = await currentSupabase.auth.getUser()

  if (currentUser) {
    redirect('/')
  }

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
    const accountRole = resolveAccountRoleForEmail(email)

    // 💡 2. เช็คว่ารหัสผ่าน 2 ช่องตรงกันไหม
    if (password !== confirmPassword) {
      redirect(`/register?message=${encodeURIComponent('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')}`)
    }

    // ⚡ ดึง URL กลาง รองรับ Production, Vercel Preview และ Localhost
    const requestHeaders = await headers()
    const siteUrl = getSiteUrl(requestHeaders)

    const supabase = await createClient()

    // 💡 3. ส่งคำขอสมัครสมาชิก
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/register-success`,
        data: {
          username: username,
          display_name: displayName,
          phone: phone,
          role: accountRole,
        },
      },
    })

    if (error) {
      redirect(`/register?message=${encodeURIComponent(error.message)}`)
    }

    // ⚡ ดักจับกรณีอีเมลนี้เคยสมัครและยืนยันตัวตนไปแล้ว
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      const msg = encodeURIComponent('อีเมลนี้ถูกใช้งานและยืนยันตัวตนแล้ว กรุณาเข้าสู่ระบบ')
      redirect(`/login?message=${msg}`)
    }

    // ⚡ 4. ปรับแก้คำแจ้งเตือน + ส่ง type=success ไปด้วยเพื่อให้แสดงผลเป็นสีเขียว
    const successMsg = encodeURIComponent('สมัครสมาชิกสำเร็จ! ระบบได้ส่งอีเมลสำหรับยืนยันตัวตนไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบกล่องข้อความ (รวมถึงจดหมายขยะ) เพื่อเปิดใช้งานบัญชี')
    
    redirect(`/login?message=${successMsg}&type=success`)
  }

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
