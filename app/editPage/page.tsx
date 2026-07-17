import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import EditProfileForm from '@/components/edit-profile-form'

export default async function EditProfilePage() {
  const supabase = await createClient()

  // 1. ตรวจสอบข้อมูล User ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 2. ดึงข้อมูลโปรไฟล์ปัจจุบัน
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, phone, avatar_url')
    .eq('id', user.id)
    .single()

  // 3. ปรับ Server Action ให้ส่งสถานะกลับเป็น Object เพื่อให้เข้าคู่กับฟอร์มระบบสลับแท็บ
  const updateProfile = async (formData: FormData) => {
    'use server'
    const username = formData.get('username') as string
    const displayName = formData.get('displayName') as string
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

    // อัปเดตข้อมูลลงฐานข้อมูล
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

    // ส่ง success กลับไปบอกหน้าบ้าน เพื่อให้หน้าบ้านสั่ง redirect แบบปลอดภัย
    return { success: true }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh]">
      <main className="w-full flex flex-col items-center justify-center p-4">
        
        {/* 💡 เอาบรรทัด message={...} ออกแล้ว ทำให้ Type ถูกต้องและเส้นแดงหายไปครับ */}
        <EditProfileForm profile={profile} email={user.email} updateAction={updateProfile} />

      </main>
    </div>
  )
}