import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutConfirmButton from '@/components/logout-confirm-button'
import { formatThaiPhoneInput } from '@/lib/phone'
import { getProfileStudentIdDisplay } from '@/lib/roles'

const roleEnglishLabels: Record<string, string> = {
  admin: 'ADMIN',
  restaurant: 'RESTAURANT',
  student: 'STUDENT',
  rider: 'RIDER',
  customer: 'CUSTOMER',
}

export default async function ViewProfilePage() {
  const supabase = await createClient()

  // 1. ตรวจสอบข้อมูล User ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. ดึงข้อมูลโปรไฟล์จากตาราง profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, phone, avatar_url, role, student_id')
    .eq('id', user.id)
    .single()

  // กำหนดค่าตัวแปรผู้ใช้งาน
  const fullName = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || 'ผู้ใช้งาน'
  const username = profile?.username || user.user_metadata?.username || 'username'
  const phone = profile?.phone ? formatThaiPhoneInput(profile.phone) : 'ยังไม่ได้ระบุ'
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url
  const email = user.email ?? 'ไม่พบอีเมล'
  const isEmailConfirmed = Boolean(user.email_confirmed_at)
  
  // ดึง Role จาก Database
  const userRole = (profile?.role || user.app_metadata?.role || 'customer').toLowerCase()
  const userRoleLabel = roleEnglishLabels[userRole] || userRole.toUpperCase()
  const studentIdDisplay = getProfileStudentIdDisplay(profile || {}, user.email)

  // ⚡ ฟังก์ชันกำหนด Class สีตามแบบฉบับ Navbar เป๊ะๆ
  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'restaurant':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'student':
        return 'bg-white/10 text-white border-white/40'
      case 'rider':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  // แปลงวันที่สมัครสมาชิกเป็นรูปแบบภาษาไทย
  const createdAt = new Date(user.created_at).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 text-white">
      <main className="w-full max-w-3xl  rounded-2xl shadow-2xl border border-neutral-800/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Layout แนวนอน */}
        <div className="flex flex-col md:flex-row">
          
          {/* 👈 ฝั่งซ้าย: รูป Avatar, ชื่อ, Role Badge และปุ่ม Sign Out */}
          <div className="app-chrome md:w-1/3 bg-gradient-to-b from-orange-600/20 via-neutral-900 to-neutral-900 p-6 flex flex-col items-center text-center justify-between border-b md:border-b-0 md:border-r border-neutral-800/80">
            <div className="flex flex-col items-center w-full">
              
              {/* รูป Avatar */}
              <div className="relative mb-4 mt-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="w-28 h-28 rounded-2xl border-2 border-orange-500/50 object-cover shadow-xl "
                  />
                ) : (
                  <div className="w-28 h-28 rounded-2xl border-2 border-orange-500/50 bg-orange-500 text-black flex items-center justify-center text-4xl font-black shadow-xl">
                    {fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span 
                  className={`absolute bottom-1 right-1 w-4 h-4 border-2 border-neutral-900 rounded-full ${isEmailConfirmed ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                  title={isEmailConfirmed ? 'ยืนยันอีเมลแล้ว' : 'ยังไม่ได้ยืนยันอีเมล'} 
                />
              </div>

              {/* ชื่อ และ Username */}
              <h1 className="text-xl font-black text-white truncate max-w-full">{fullName}</h1>
              <p className="max-w-full truncate text-xs text-orange-400 font-medium mb-2">@{username}</p>

              {/* 🎨 Role Badge ฝั่งซ้าย (อ้างอิงสีจาก Navbar) */}
              <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${getRoleStyle(userRole)}`}>
                {userRole === 'admin' ? `📊 ${userRoleLabel}` :
                 userRole === 'restaurant' ? `🍔 ${userRoleLabel}` :
                 userRole === 'student' ? `🎓 ${userRoleLabel}` :
                 userRole === 'rider' ? `🛵 ${userRoleLabel}` : `👤 ${userRoleLabel}`}
              </span>

            </div>

            {/* ปุ่ม Sign Out */}
            <div className="w-full mt-6">
              <LogoutConfirmButton
                context={userRole === 'admin' ? 'admin' : userRole === 'restaurant' ? 'restaurant' : 'default'}
                className="w-full py-2.5 text-xs font-bold text-red-400 bg-red-950/40 hover:bg-red-900/60 active:scale-95 rounded-xl transition-all border border-red-900/50 cursor-pointer shadow-lg"
              >
                ออกจากระบบ
              </LogoutConfirmButton>
            </div>
          </div>

          {/* 👉 ฝั่งขวา: รายละเอียดโปรไฟล์ */}
          <div className="flex-1 p-4 sm:p-6 flex flex-col justify-between  min-w-0">
            <div>
              <h2 className="text-lg font-black text-neutral-200 border-b border-neutral-800/80 pb-3 mb-4">
                ข้อมูลโปรไฟล์ (Profile Details)
              </h2>

              <div className="space-y-3  p-4 rounded-xl border border-neutral-800/80 text-sm">
                
                <div className="flex flex-col gap-1 py-1 border-b border-neutral-800/60 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-neutral-400 font-medium text-xs uppercase tracking-wider">อีเมล</span>
                  <span className="text-neutral-200 font-medium text-xs break-all sm:max-w-[220px] sm:truncate">
                    {email}
                  </span>
                </div>

                <div className="flex flex-col gap-1 py-1 border-b border-neutral-800/60 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-neutral-400 font-medium text-xs uppercase tracking-wider">เบอร์โทรศัพท์</span>
                  <span className="text-neutral-200 font-medium text-xs">
                    {phone}
                  </span>
                </div>

                <div className="flex flex-col gap-1 py-1 border-b border-neutral-800/60 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-neutral-400 font-medium text-xs uppercase tracking-wider">รหัสนักศึกษา</span>
                  <span className="text-neutral-200 font-medium text-xs font-mono">
                    {studentIdDisplay}
                  </span>
                </div>

                {/* 🎨 สิทธิ์การใช้งาน (Role) ในตาราง (อ้างอิงสีจาก Navbar) */}
                <div className="flex flex-col gap-1 py-1 border-b border-neutral-800/60 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-neutral-400 font-medium text-xs uppercase tracking-wider">Role</span>
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border ${getRoleStyle(userRole)}`}>
                    {userRoleLabel}
                  </span>
                </div>

                <div className="flex flex-col gap-1 py-1 border-b border-neutral-800/60 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-neutral-400 font-medium text-xs uppercase tracking-wider">สถานะอีเมล</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${isEmailConfirmed ? 'bg-emerald-950/10 text-emerald-400 border border-emerald-800/50' : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'}`}>
                    {isEmailConfirmed ? '✓ ยืนยันเรียบร้อย' : '⚠️ ยังไม่ได้ยืนยัน'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-neutral-400 font-medium text-xs uppercase tracking-wider">สมาชิกเมื่อ</span>
                  <span className="text-neutral-300 font-medium text-xs">{createdAt}</span>
                </div>

              </div>
            </div>

            {/* ปุ่มแก้ไขข้อมูลโปรไฟล์ */}
            <div className="mt-6">
              <Link
                href="/profile/edit"
                className="block w-full bg-orange-500 hover:bg-orange-400 text-black font-bold py-2.5 px-4 rounded-xl transition-all active:scale-95 text-center text-sm shadow-lg shadow-orange-500/10 cursor-pointer"
              >
                ✏️ แก้ไขข้อมูลโปรไฟล์
              </Link>
            </div>

          </div>

        </div>
      </main>
    </div>
  )
}
