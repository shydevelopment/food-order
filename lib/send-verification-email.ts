import 'server-only'
import type { User } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createAdminClient } from '@/supabase/admin'

export async function sendVerificationEmail(user: User, siteUrl: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) throw new Error('ระบบส่งอีเมลยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ')

  const admin = createAdminClient()
  const { data: fresh, error: lookupError } = await admin.auth.admin.getUserById(user.id)
  if (lookupError || !fresh.user?.email) throw new Error('ไม่พบข้อมูลอีเมลผู้ใช้งาน')
  const lastSent = Number(fresh.user.app_metadata.verification_email_sent_at || 0)
  if (Date.now() - lastSent < 60_000) throw new Error('กรุณารอ 1 นาทีก่อนส่งอีเมลอีกครั้ง')

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: fresh.user.email,
  })
  if (error) throw error

  const link = new URL('/auth/verify-email', siteUrl)
  link.searchParams.set('token_hash', data.properties.hashed_token)
  const { error: sendError } = await new Resend(apiKey).emails.send({
    from,
    to: fresh.user.email,
    subject: 'ยืนยันอีเมลสำหรับ Food Order KMUTNB',
    text: `กดลิงก์เพื่อยืนยันอีเมลของคุณ: ${link.toString()}\nหากไม่ได้ร้องขอ คุณสามารถข้ามอีเมลนี้ได้`,
  })
  if (sendError) {
    const providerMessage = sendError.message.toLowerCase()

    if (providerMessage.includes('api key is invalid')) {
      throw new Error('การตั้งค่า RESEND_API_KEY ไม่ถูกต้องหรือหมดอายุ กรุณาติดต่อผู้ดูแลระบบ')
    }

    if (providerMessage.includes('domain') && providerMessage.includes('verify')) {
      throw new Error('โดเมนอีเมลผู้ส่งยังไม่ได้ยืนยันกับ Resend กรุณาติดต่อผู้ดูแลระบบ')
    }

    throw new Error('ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
  }
  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { verification_email_sent_at: Date.now() },
  })
  if (metadataError) throw new Error('ส่งอีเมลแล้ว แต่บันทึกสถานะไม่สำเร็จ กรุณาตรวจสอบกล่องข้อความ')
}
