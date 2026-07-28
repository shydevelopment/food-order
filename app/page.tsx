import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'

interface Restaurant {
  id: string
  name: string
  description: string | null
  image_url: string | null
  address: string
  status: string
  open_time: string
  close_time: string
}

export default async function Index() {
  const supabase = await createClient()

  // 1. ตรวจสอบข้อมูล User ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. ดึงข้อมูลร้านอาหารทั้งหมดจากตาราง restaurants
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('*')

  if (error) {
    console.error('Error fetching restaurants:', error.message)
  }

  // 3. สุ่มร้านอาหาร 1 ร้าน (Random)
  const randomRestaurant = restaurants && restaurants.length > 0 
    ? restaurants[Math.floor(Math.random() * restaurants.length)] 
    : null;

  // Server Action สำหรับ Sign Out
  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  // ตัวแปรเช็คสถานะเปิดปิดของร้านที่สุ่มได้
  const isOpen = randomRestaurant?.status === 'open'

  return (
    <div className="flex flex-col items-center p-4 min-h-screen bg-neutral-950 text-white font-sans">
      <main className="flex flex-col items-center w-full max-w-4xl">
        
        {/* --- ส่วน Header ต้อนรับ --- */}
        <section className="text-center w-full mb-10 py-10 bg-gradient-to-br from-amber-500/10 to-orange-600/5 rounded-3xl border border-amber-500/20 shadow-lg shadow-amber-500/5">
          <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-4">
            ยินดีต้อนรับเข้าสู่ Food Order Kmutnb
          </h1>
          <p className="text-neutral-400 text-sm md:text-base">
            คิดไม่ออกว่าจะกินอะไร? ลองดูร้านที่เราสุ่มมาให้คุณวันนี้สิ!
          </p>
        </section>

        {/* --- ส่วนร้านอาหารแบบสุ่ม (Random Restaurant) --- */}
        <section className="w-full">
          <div className="flex items-center gap-3 mb-6 justify-center">
            <h2 className="text-2xl font-bold text-white">🎲 ร้านเด็ดสุ่มมาให้คุณ</h2>
          </div>

          {!randomRestaurant ? (
            <div className="text-center py-20 bg-neutral-900/50 rounded-2xl border border-neutral-800">
              <p className="text-neutral-400">ยังไม่มีร้านอาหารในระบบ 🥲</p>
            </div>
          ) : (
            /* Card สุ่มร้านอาหาร */
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row items-stretch group hover:border-amber-500/50 transition-all duration-500">
              
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
              <div className="p-6 md:p-8 flex flex-col justify-between flex-1 w-full">
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
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
                
                {/* ปุ่มสั่งอาหาร */}
                <button 
                  disabled={!isOpen}
                  className={`w-full md:w-auto px-8 py-3.5 rounded-xl text-sm font-bold transition-all ${
                    isOpen 
                      ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:-translate-y-1' 
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  {isOpen ? 'เลือกร้านนี้เลย!' : 'เสียดายจัง ร้านยังไม่เปิด'}
                </button>
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  )
}