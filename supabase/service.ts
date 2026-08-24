import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const REMEMBER_COOKIE_NAME = 'food-order-auth-remember'
const REMEMBER_MAX_AGE = 400 * 24 * 60 * 60

type CreateClientOptions = {
  rememberSession?: boolean
}

function getRememberCookieOptions(maxAge?: number) {
  return {
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    ...(maxAge === undefined ? {} : { maxAge }),
  }
}

function toSessionCookieOptions(options: CookieOptions) {
  if (options.maxAge === 0) {
    return options
  }

  const { maxAge, expires, ...sessionCookieOptions } = options
  void maxAge
  void expires

  return sessionCookieOptions
}

export async function setAuthRememberPreference(rememberSession: boolean) {
  const cookieStore = await cookies()

  cookieStore.set(
    REMEMBER_COOKIE_NAME,
    rememberSession ? '1' : '0',
    getRememberCookieOptions(rememberSession ? REMEMBER_MAX_AGE : undefined),
  )
}

export async function createClient(options: CreateClientOptions = {}) {
  const cookieStore = await cookies()
  const rememberSession =
    options.rememberSession ?? cookieStore.get(REMEMBER_COOKIE_NAME)?.value !== '0'

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                rememberSession ? options : toSessionCookieOptions(options)
              )
            )
          } catch {
            // ปล่อยว่างไว้ได้เลย เพราะฝั่ง Server Component จะกด set คุกกี้ตรงๆ ไม่ได้
          }
        },
      },
    }
  )
}
