import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh] bg-zinc-950 text-white">
      <div className="max-w-md w-full bg-zinc-900 p-8 rounded-lg text-center border border-orange-500/30 shadow-2xl">
        <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl border border-orange-500/20">
          ✉️
        </div>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-zinc-400 mb-6 text-sm leading-relaxed">
          เราได้ส่งลิงก์ยืนยันตัวตนไปที่อีเมลของคุณเรียบร้อยแล้ว กรุณาเปิดกล่องข้อความและคลิกลิงก์เพื่อเปิดใช้งานบัญชี
        </p>
        <Link 
          href="/login" 
          className="block w-full border border-neutral-700 text-neutral-300 py-2 px-4 rounded-md hover:bg-neutral-800 transition-colors text-sm font-medium"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  )
}