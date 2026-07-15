// 1. แก้ไขบรรทัด import เอาตัว 's' เกินออก
import { createClient } from '@/service/supabase/service'
import { redirect } from 'next/navigation'

export default async function Index() {
  // 2. ใส่ await หน้า createClient() จุดที่ 1
  const supabase = await createClient()

  // ตรวจสอบข้อมูล User ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // ถ้ายังไม่ล็อกอิน ให้โยนไปหน้า /login
    return redirect('/login')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">ยินดีต้อนรับ!</h1>
      <p>คุณเข้าสู่ระบบด้วยอีเมล: <strong>{user.email}</strong></p>
      
      <form action={async () => {
        'use server'
        // 3. ใส่ await หน้า createClient() จุดที่ 2 (ใน Server Action ของการ Sign Out)
        const supabase = await createClient()
        await supabase.auth.signOut()
        return redirect('/login')
      }}>
        <button className="mt-4 px-4 py-2 bg-red-500 text-white rounded">
          ออกจากระบบ (Sign Out)
        </button>
      </form>
    </div>
  )
}