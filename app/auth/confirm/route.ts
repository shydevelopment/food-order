import type { EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'

const allowedNextPaths = ['/register-success', '/reset-password', '/', '/login']

const getSafeNextPath = (next: string | null) => {
  if (!next) return '/'

  try {
    const parsedNext = new URL(next)
    return allowedNextPaths.includes(parsedNext.pathname) ? parsedNext.pathname : '/'
  } catch {
    return allowedNextPaths.includes(next) ? next : '/'
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const code = requestUrl.searchParams.get('code')
  const next = getSafeNextPath(requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirect_to'))
  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  const errorMessage = encodeURIComponent('ลิงก์ยืนยันตัวตนไม่ถูกต้อง ถูกใช้ไปแล้ว หรือหมดอายุแล้ว')
  return NextResponse.redirect(new URL(`/login?message=${errorMessage}`, requestUrl.origin))
}
