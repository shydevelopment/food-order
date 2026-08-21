import Link from 'next/link'

export default function RegisterSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh]">
      <main className="w-full flex flex-col items-center justify-center p-4">
        
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800/80 p-8 rounded-2xl shadow-2xl text-center animate-in fade-in zoom-in-95 duration-300">
          
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            ✓
          </div>

          <h1 className="text-2xl font-black text-white mb-3 tracking-wide">
            ยืนยันตัวตนสำเร็จ!
          </h1>
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">
            Verification Successful
          </p>

          <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
            บัญชีของคุณได้รับการยืนยันเรียบร้อยแล้ว ตอนนี้คุณสามารถเข้าสู่ระบบเพื่อเริ่มใช้งานและสั่งอาหารอร่อยๆ ได้เลยครับ 🍔
          </p>

          <Link 
            href="/login" 
            className="block w-full bg-orange-500 hover:bg-orange-400 text-black font-bold py-3 px-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20 text-center text-sm cursor-pointer"
          >
            ไปที่หน้าเข้าสู่ระบบ (Go to Login)
          </Link>

        </div>

      </main>
    </div>
  )
}
