import { createClient } from '@/supabase/service'

export default async function Index() {
  const supabase = await createClient()

  // ตรวจสอบสถานะ User เพื่อใช้แสดงปุ่ม แต่ไม่บังคับ login สำหรับการดูเว็บ
  const { data: { user } } = await supabase.auth.getUser()

  // ดึงข้อมูลร้านอาหารทั้งหมดจากตาราง restaurants
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('*')

  if (error) {
    console.error('Error fetching restaurants:', error.message)
  }

  // เลือกร้านแนะนำรายการแรก เพื่อให้ render คงที่และไม่เปลี่ยนเองระหว่าง request
  const randomRestaurant = restaurants && restaurants.length > 0 
    ? restaurants[0] 
    : null;

  // ตัวแปรเช็คสถานะเปิดปิดของร้านที่สุ่มได้
  const isOpen = randomRestaurant?.status === 'open'
  const restaurantCount = restaurants?.length || 0

  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-0 pb-8 sm:gap-10 sm:pb-10">
        {!user ? (
          <>
            <section
              className="relative min-h-[460px] overflow-hidden rounded-none border border-orange-500/20 md:rounded-2xl"
              style={{
                background:
                  'radial-gradient(circle at 18% 18%, rgba(255, 122, 0, 0.34), transparent 32%), linear-gradient(135deg, #111827 0%, #1f2937 52%, #431407 100%)',
                color: '#ffffff',
              }}
            >
              <div className="relative flex min-h-[460px] flex-col justify-between p-5 sm:p-6 md:min-h-[520px] md:p-10">
                <div className="max-w-3xl pt-6 md:pt-16">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                    Food Order KMUTNB
                  </p>
                  <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl md:text-6xl" style={{ color: '#ffffff' }}>
                    สมัครครั้งเดียว แล้วสั่งอาหารในมหาลัยได้ทันที
                  </h1>
                  <p className="mt-5 max-w-2xl text-sm font-medium leading-7 sm:text-base md:text-lg" style={{ color: 'rgba(255,255,255,0.78)' }}>
                    สำหรับคนที่เพิ่งเข้าเว็บครั้งแรก คุณดูร้านและเมนูได้ก่อนเลย แต่ถ้าจะเพิ่มลงตะกร้า สั่งอาหาร หรือติดตามออเดอร์ ต้องสมัครสมาชิกหรือเข้าสู่ระบบก่อน
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a
                      href="/register"
                      className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-black shadow-lg shadow-orange-500/15 transition hover:bg-orange-400 active:scale-95"
                    >
                      สมัครสมาชิก
                    </a>
                    <a
                      href="/storePage"
                      className="inline-flex items-center justify-center rounded-xl border px-6 py-3 text-sm font-bold transition hover:border-orange-300 active:scale-95"
                      style={{
                        borderColor: 'rgba(255,255,255,0.34)',
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        color: '#ffffff',
                      }}
                    >
                      ดูร้านอาหารก่อน
                    </a>
                    <a
                      href="/login"
                      className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-bold transition active:scale-95"
                      style={{ color: '#ffffff' }}
                    >
                      มีบัญชีแล้ว เข้าสู่ระบบ
                    </a>
                  </div>
                </div>

                <div
                  className="grid grid-cols-1 gap-3 border-t border-white/10 pt-5 text-sm md:grid-cols-3"
                  style={{ color: 'rgba(255,255,255,0.78)' }}
                >
                  <div>
                    <p className="font-black" style={{ color: '#ffffff' }}>{restaurantCount} ร้านในระบบ</p>
                    <p className="mt-1 text-xs">เลือกดูร้านและเมนูได้โดยไม่ต้องสมัคร</p>
                  </div>
                  <div>
                    <p className="font-black" style={{ color: '#ffffff' }}>สมัครก่อนสั่ง</p>
                    <p className="mt-1 text-xs">ตะกร้าและออเดอร์ใช้กับบัญชีของคุณ</p>
                  </div>
                  <div>
                    <p className="font-black" style={{ color: '#ffffff' }}>อีเมล KMUTNB</p>
                    <p className="mt-1 text-xs">ใช้ @email.kmutnb.ac.th จะได้ role นักศึกษา</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                ['1', 'ดูร้านและเมนู', 'กดดูร้านอาหารทั้งหมดได้ทันที เพื่อเช็กราคา เวลาเปิด และรายการอาหาร'],
                ['2', 'สมัครหรือเข้าสู่ระบบ', 'สร้างบัญชีด้วยอีเมลของคุณ เพื่อให้ระบบจำตะกร้าและข้อมูลออเดอร์'],
                ['3', 'สั่งและติดตาม', 'หลังเข้าสู่ระบบ คุณจะเพิ่มเมนูลงตะกร้า สั่งอาหาร และดูสถานะออเดอร์ได้'],
              ].map(([step, title, detail]) => (
                <div key={step} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-sm font-black text-black">
                    {step}
                  </div>
                  <h2 className="mt-4 text-lg font-black text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">{detail}</p>
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="w-full rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-600/5 px-6 py-10 text-center shadow-lg shadow-amber-500/5">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl md:text-5xl">
              ยินดีต้อนรับกลับสู่ Food Order KMUTNB
            </h1>
            <p className="mt-4 text-sm text-neutral-400 md:text-base">
              คิดไม่ออกว่าจะกินอะไร? ลองดูร้านที่เราแนะนำให้วันนี้สิ
            </p>
          </section>
        )}

        {/* --- ส่วนร้านอาหารแบบสุ่ม (Random Restaurant) --- */}
        <section className="w-full">
          <div className="flex items-center gap-3 mb-6 justify-center text-center">
            <h2 className="text-xl font-bold text-white sm:text-2xl">🎲 ร้านเด็ดสุ่มมาให้คุณ</h2>
          </div>

          {!randomRestaurant ? (
            <div className="text-center py-20 bg-neutral-900/50 rounded-2xl border border-neutral-800">
              <p className="text-neutral-400">ยังไม่มีร้านอาหารในระบบ 🥲</p>
            </div>
          ) : (
            /* Card สุ่มร้านอาหาร */
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row items-stretch group hover:border-amber-500/50 transition-all duration-500">
              
              {/* 📌 แก้ไขส่วนนี้: ภาพปก (ฝั่งซ้าย) */}
              {/* ใช้ min-h-[250px] สำหรับมือถือ และล็อกความกว้างด้วย md:w-80 lg:w-96 */}
              <div className="relative w-full min-h-[250px] md:min-h-0 md:w-80 lg:w-96 shrink-0 bg-neutral-800 overflow-hidden">
                {/* 📌 จุดสำคัญ: เพิ่ม `absolute inset-0` เข้าไปที่ img เพื่อไม่ให้รูปดันกล่อง */}
                <img
                  src={randomRestaurant.image_url || '/placeholder.jpg'}
                  alt={randomRestaurant.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <span 
                  className={`absolute top-4 left-4 px-3 py-1.5 text-xs font-bold rounded-full backdrop-blur-md shadow-sm z-10 ${
                    isOpen 
                      ? 'bg-emerald-500/90 text-white' 
                      : 'bg-rose-500/90 text-white'
                  }`}
                >
                  {isOpen ? 'เปิดอยู่' : 'ปิดแล้ว'}
                </span>
              </div>

              {/* รายละเอียด (ฝั่งขวา) */}
              <div className="p-5 sm:p-6 md:p-8 flex flex-col justify-between flex-1 w-full">
                <div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
                    {randomRestaurant.name}
                  </h3>
                  
                  {randomRestaurant.description && (
                    <p className="text-neutral-400 text-sm md:text-base mb-6 line-clamp-2">
                      {randomRestaurant.description}
                    </p>
                  )}

                  <div className="space-y-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50 mb-6">
                    {randomRestaurant.address && (
                      <p className="flex items-start gap-3">
                        <span className="text-amber-500 text-lg">📍</span>
                        <span>{randomRestaurant.address}</span>
                      </p>
                    )}
                    {(randomRestaurant.open_time || randomRestaurant.close_time) && (
                      <p className="flex items-center gap-3">
                        <span className="text-amber-500 text-lg">🕒</span>
                        <span>{randomRestaurant.open_time?.slice(0, 5)} - {randomRestaurant.close_time?.slice(0, 5)} น.</span>
                      </p>
                    )}
                  </div>
                </div>
                
                {isOpen ? (
                  <a 
                    href={user ? '/storePage' : '/login'}
                    className="w-full md:w-auto text-center px-8 py-3.5 rounded-xl text-sm font-bold transition-all bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:-translate-y-1"
                  >
                    {user ? 'ดูเมนูและสั่งอาหาร' : 'เข้าสู่ระบบเพื่อสั่งอาหาร'}
                  </a>
                ) : (
                  <button 
                    disabled
                    className="w-full md:w-auto px-8 py-3.5 rounded-xl text-sm font-bold transition-all bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  >
                    เสียดายจัง ร้านยังไม่เปิด
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
