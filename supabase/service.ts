import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 1. เติมคำว่า async ไว้หน้า function
export async function createClient() {
  // 2. เติมคำว่า await หน้า cookies()
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // กรณีที่เรียกใช้จาก Server Component จะไม่สามารถ set cookie ได้
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // กรณีที่เรียกใช้จาก Server Component จะไม่สามารถลบ cookie ได้
          }
        },
      },
    }
  )
}