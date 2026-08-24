import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import EditProfileForm from '@/components/edit-profile-form'
import { getSiteUrl } from '@/lib/site-url'
import { normalizeNotificationPreferences } from '@/lib/notification-preferences'
import { DUPLICATE_PHONE_MESSAGE, validateThaiPhone } from '@/lib/phone'
import { getKmutnbStudentUsernameFromEmail, getProfileStudentId, isKmutnbStudentEmail } from '@/lib/roles'

export default async function EditProfilePage() {
  const supabase = await createClient()

  // 1. ตรวจสอบข้อมูล User ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // ⚡ เช็กสถานะว่ายืนยันอีเมลแล้วหรือยัง
  const isEmailConfirmed = Boolean(user.email_confirmed_at)

  // 2. ดึงข้อมูลโปรไฟล์ปัจจุบัน
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, phone, avatar_url, role, student_id, notification_preferences')
    .eq('id', user.id)
    .single()

  const isStudentAccount = profile?.role === 'student' || isKmutnbStudentEmail(user.email)
  const studentUsername = getKmutnbStudentUsernameFromEmail(user.email)

  // 3. Server Action สำหรับอัปเดตโปรไฟล์
  const updateProfile = async (formData: FormData) => {
    'use server'
    const submittedUsername = formData.get('username') as string
    const submittedDisplayName = formData.get('displayName') as string
    const phoneValidation = validateThaiPhone(formData.get('phone'))
    if (!phoneValidation.success) {
      return { success: false, message: phoneValidation.message }
    }

    const phone = phoneValidation.phone

    const supabaseServer = await createClient()
    const { data: { user: currentUser } } = await supabaseServer.auth.getUser()

    if (!currentUser) {
      return { success: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }
    }

    const { data: currentProfile } = await supabaseServer
    .from('profiles')
      .select('username, full_name, role, student_id')
      .eq('id', currentUser.id)
      .single()

    const { data: existingPhoneProfile, error: phoneLookupError } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .neq('id', currentUser.id)
      .maybeSingle()

    if (phoneLookupError) {
      return { success: false, message: phoneLookupError.message }
    }

    if (existingPhoneProfile) {
      return { success: false, message: DUPLICATE_PHONE_MESSAGE }
    }

    const currentIsStudent = currentProfile?.role === 'student' || isKmutnbStudentEmail(currentUser.email)
    const username = currentIsStudent
      ? getKmutnbStudentUsernameFromEmail(currentUser.email) || currentProfile?.username || submittedUsername
      : submittedUsername
    const displayName = currentIsStudent
      ? currentProfile?.full_name || submittedDisplayName
      : submittedDisplayName
    const studentId = getProfileStudentId(currentProfile || {}, currentUser.email)

    const { error } = await supabaseServer
      .from('profiles')
      .update({
        username: username,
        full_name: displayName,
        phone: phone,
        student_id: currentIsStudent ? studentId : null,
      })
      .eq('id', currentUser.id)

    if (error) {
      return { success: false, message: error.message }
    }

    return { success: true }
  }

  const updateNotificationPreferences = async (formData: FormData) => {
    'use server'

    try {
      const rawPreferences = formData.get('notificationPreferences')
      const parsedPreferences = rawPreferences
        ? JSON.parse(String(rawPreferences))
        : null
      const notificationPreferences = normalizeNotificationPreferences(parsedPreferences)

      const supabaseServer = await createClient()
      const { data: { user: currentUser } } = await supabaseServer.auth.getUser()

      if (!currentUser) {
        return { success: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }
      }

      const { error } = await supabaseServer
        .from('profiles')
        .update({ notification_preferences: notificationPreferences })
        .eq('id', currentUser.id)

      if (error) {
        return { success: false, message: error.message }
      }

      return { success: true, message: 'บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ข้อมูลแจ้งเตือนไม่ถูกต้อง'
      return { success: false, message }
    }
  }

  // ⚡ 4. Server Action สำหรับส่งอีเมลยืนยันอีกครั้ง
  const resendVerificationEmail = async () => {
    'use server'
    try {
      const requestHeaders = await headers()
      const siteUrl = getSiteUrl(requestHeaders)

      const supabaseServer = await createClient()
      const { data: { user: currentUser } } = await supabaseServer.auth.getUser()

      if (!currentUser?.email) {
        return { success: false, message: 'ไม่พบข้อมูลอีเมลผู้ใช้งาน' }
      }

      // สั่งให้ Supabase ส่งอีเมลยืนยันอีกครั้ง
      const { error } = await supabaseServer.auth.resend({
        type: 'signup',
        email: currentUser.email,
        options: {
          emailRedirectTo: `${siteUrl}/register-success`,
        },
      })

      if (error) {
        return { success: false, message: error.message }
      }

      return { success: true, message: 'ส่งลิงก์ยืนยันตัวตนไปยังอีเมลของคุณเรียบร้อยแล้ว!' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งอีเมล'
      return { success: false, message }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh]">
      <main className="w-full flex flex-col items-center justify-center p-4">
        
        <EditProfileForm 
          profile={profile} 
          email={user.email} 
          isEmailConfirmed={isEmailConfirmed}
          isStudentAccount={isStudentAccount}
          studentUsername={studentUsername}
          updateAction={updateProfile} 
          updateNotificationAction={updateNotificationPreferences}
          resendAction={resendVerificationEmail}
        />

      </main>
    </div>
  )
}
