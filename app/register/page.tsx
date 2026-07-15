import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/service'
import RegisterForm from '@/components/register-form' // 💡 นำเข้าฟอร์มฝั่งหน้าบ้านที่เราจะสร้างในข้อ 2

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams

  // Server Action สำหรับสมัครสมาชิก (ปลอดภัย รันฝั่ง Server)
  const signUp = async (formData: FormData) => {
    'use server'
    const origin = (await headers()).get('origin')
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const username = formData.get('username') as string
    const displayName = formData.get('displayName') as string
    const phone = formData.get('phone') as string

    // [หลังบ้าน] ตรวจสอบโครงสร้าง Email ด้วย Regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return redirect('/register?message=รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
    }

    // [หลังบ้าน] ตรวจสอบเบอร์โทรต้องเป็นตัวเลข ขึ้นต้นด้วย 0 และยาว 9-10 หลัก
    const phoneRegex = /^0[0-9]{8,9}$/
    if (!phoneRegex.test(phone)) {
      return redirect('/register?message=เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก)')
    }

    // ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่
    if (password !== confirmPassword) {
      return redirect('/register?message=Passwords do not match')
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          username: username,
          full_name: displayName, 
          phone: phone,
        }
      },
    })

    if (error) {
      return redirect(`/register?message=${error.message}`)
    }

    return redirect('/login?message=Registration successful! Please check your email to confirm.')
  }

  return <RegisterForm signUpAction={signUp} message={resolvedSearchParams?.message} />
}