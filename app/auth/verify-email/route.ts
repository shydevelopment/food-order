import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { createAdminClient } from '@/supabase/admin'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  if (tokenHash) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    if (!error && data.user?.email) {
      const admin = createAdminClient()
      const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { verified_email: data.user.email },
      })
      if (!updateError) {
        await supabase.auth.refreshSession()
        return NextResponse.redirect(new URL('/profile/edit', url.origin))
      }
    }
  }
  return NextResponse.redirect(new URL(`/profile/edit?message=${encodeURIComponent('ลิงก์ยืนยันอีเมลไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว กรุณาส่งลิงก์ใหม่')}`, url.origin))
}
