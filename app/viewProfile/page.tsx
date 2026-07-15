import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'

export default async function Index() {
  const supabase = await createClient()

  // ตรวจสอบข้อมูล User ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // ถ้ายังไม่ล็อกอิน ให้โยนไปหน้า /login
    redirect('/login')
  }

  // แยก Server Action สำหรับ Sign Out
  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    // 2. ปรับโครงสร้างหลักให้เป็น flex-col แบบเต็มหน้าจอ
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh]">

      <main className="flex-grow flex flex-col items-center justify-center p-4"></main>

    </div>
  )
}