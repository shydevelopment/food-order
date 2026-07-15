import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/service'
import LoginForm from '@/components/login-form' // 💡 นำเข้าคอมโพเนนต์ฟอร์มที่เราจะสร้างในข้อ 2

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams

  // Server Action สำหรับเข้าสู่ระบบ (รันฝั่ง Server ปลอดภัยสูงสุด)
  const signIn = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    // ตรวจสอบโครงสร้าง Email ด้วย Regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return redirect('/login?message=รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return redirect('/login?message=อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    }

    return redirect('/') // เข้าสู่ระบบสำเร็จ กลับไปหน้าแรก
  }

  // ส่ง Action และ Message ไปทำงานฝั่งหน้าบ้าน
  return <LoginForm signInAction={signIn} message={resolvedSearchParams?.message} />
}