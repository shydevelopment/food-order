import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/service/supabase/service'
import Link from 'next/link'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams

  // Server Action สำหรับสมัครสมาชิก
  const signUp = async (formData: FormData) => {
    'use server'
    const origin = (await headers()).get('origin')
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

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
      },
    })

    if (error) {
      return redirect(`/register?message=${error.message}`)
    }

    // สมัครสำเร็จ ให้กลับไปหน้า Login พร้อมข้อความแจ้งเตือน
    return redirect('/login?message=Registration successful! Please check your email to confirm.')
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mt-20 mx-auto text-white">
      <form action={signUp} className="animate-in flex-1 flex flex-col w-full justify-center gap-2">
        
        <label className="text-sm text-gray-300" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-transparent border border-gray-600 mb-4 focus:outline-none focus:border-gray-400 text-white placeholder:text-gray-500"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />

        <label className="text-sm text-gray-300" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-transparent border border-gray-600 mb-4 focus:outline-none focus:border-gray-400 text-white placeholder:text-gray-500"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />

        <label className="text-sm text-gray-300" htmlFor="confirmPassword">
          Confirm Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-transparent border border-gray-600 mb-6 focus:outline-none focus:border-gray-400 text-white placeholder:text-gray-500"
          type="password"
          name="confirmPassword"
          placeholder="••••••••"
          required
        />

        {/* ปุ่มหลัก (สีเขียว เหมือนในรูป) */}
        <button
          type="submit"
          className="bg-[#0e9f3b] rounded-md px-4 py-2 text-white mb-2 hover:bg-[#0c8732] transition-colors font-medium"
        >
          Sign Up
        </button>

        {/* ปุ่มรอง (เส้นขอบใส เหมือนปุ่ม Sign Up ในรูปของคุณ) */}
        <Link
          href="/login"
          className="border border-gray-600 rounded-md px-4 py-2 text-white mb-2 text-center hover:bg-gray-800 transition-colors"
        >
          Sign In
        </Link>

        {/* แสดงข้อความแจ้งเตือน Error (ถ้ามี) */}
        {resolvedSearchParams?.message && (
          <p className="mt-4 p-4 bg-gray-900 border border-gray-700 text-center text-red-400 rounded-md text-sm">
            {resolvedSearchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}