import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import EditProfileForm from '@/components/edit-profile-form'
import { getSiteUrl } from '@/lib/site-url'
import { getKmutnbStudentUsernameFromEmail, isKmutnbStudentEmail } from '@/lib/roles'

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
    .select('username, full_name, phone, avatar_url, role')
    .eq('id', user.id)
    .single()

  const isStudentAccount = profile?.role === 'student' || isKmutnbStudentEmail(user.email)
  const studentUsername = getKmutnbStudentUsernameFromEmail(user.email)

  // 3. Server Action สำหรับอัปเดตโปรไฟล์
  const updateProfile = async (formData: FormData) => {
    'use server'
    const submittedUsername = formData.get('username') as string
    const submittedDisplayName = formData.get('displayName') as string
    const phone = formData.get('phone') as string

    const phoneRegex = /^0[0-9]{8,9}$/
    if (!phoneRegex.test(phone)) {
      return { success: false, message: 'เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก)' }
    }

    const supabaseServer = await createClient()
    const { data: { user: currentUser } } = await supabaseServer.auth.getUser()

    if (!currentUser) {
      return { success: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }
    }

    const { data: currentProfile } = await supabaseServer
      .from('profiles')
      .select('username, full_name, role')
      .eq('id', currentUser.id)
      .single()

    const currentIsStudent = currentProfile?.role === 'student' || isKmutnbStudentEmail(currentUser.email)
    const username = currentIsStudent
      ? getKmutnbStudentUsernameFromEmail(currentUser.email) || currentProfile?.username || submittedUsername
      : submittedUsername
    const displayName = currentIsStudent
      ? currentProfile?.full_name || submittedDisplayName
      : submittedDisplayName

    const { error } = await supabaseServer
      .from('profiles')
      .update({
        username: username,
        full_name: displayName,
        phone: phone,
      })
      .eq('id', currentUser.id)

    if (error) {
      return { success: false, message: error.message }
    }

    return { success: true }
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
          resendAction={resendVerificationEmail}
        />

      </main>
    </div>
  )
}
