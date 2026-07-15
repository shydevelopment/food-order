import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/service/supabase/service'
import Link from 'next/link' // 1. Import Link จาก next/link

// เปลี่ยน Component ให้เป็น async และอัปเดต Type ของ searchParams ให้เป็น Promise
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  // ใช้ await เพื่อดึงค่าจาก searchParams
  const resolvedSearchParams = await searchParams

  // Server Action สำหรับเข้าสู่ระบบ
  const signIn = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    // ใส่ await หน้า createClient()
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return redirect('/login?message=Could not authenticate user')
    }

    return redirect('/') // เข้าสู่ระบบสำเร็จ กลับไปหน้าแรก
  }

  // (ลบฟังก์ชัน signUp ออกไป เพราะเราย้ายไปทำที่หน้า /register แล้ว)

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mt-20 mx-auto">
      <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground">
        <label className="text-md" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="email"
          placeholder="you@example.com"
          required
        />
        <label className="text-md" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        
        <button
          formAction={signIn}
          className="bg-green-700 rounded-md px-4 py-2 text-white mb-2 hover:bg-green-800 transition-colors"
        >
          Sign In
        </button>
        
        {/* 2. เปลี่ยนปุ่ม Sign Up เป็น Link เพื่อลิงก์ไปหน้า /register */}
        <Link
          href="/register"
          className="border border-foreground/20 rounded-md px-4 py-2 text-foreground mb-2 text-center hover:bg-foreground/5 transition-colors"
        >
          Sign Up
        </Link>

        {/* แสดงข้อความ Error กรณีล็อกอินไม่ผ่าน */}
        {resolvedSearchParams?.message && (
          <p className="mt-4 p-4 bg-foreground/10 text-center text-red-500 rounded-md">
            {resolvedSearchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}