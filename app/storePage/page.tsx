import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'

// กำหนด Interface ให้ตรงตามฟิลด์ตาราง restaurants ในรูปภาพ
interface Restaurant {
  id: string
  name: string
  description: string | null
  image_url: string | null
  owner_id: string | null
  created_at: string
  email: string
  phone: string
  address: string
  status: string
  open_time: string
  close_time: string
}

export default async function Index() {
  const supabase = await createClient()

  // 1. ตรวจสอบการล็อกอิน
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. ดึงข้อมูลจากตาราง "restaurants" (ตามในรูปภาพ)
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('*')

  if (error) {
    console.error('Error fetching restaurants:', error.message)
  }

  // Server Action สำหรับออกจากระบบ
  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-12">

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 pt-8">
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>ร้านอาหารแนะนำ</span>
            <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded-full font-normal">
              {restaurants?.length || 0} ร้าน
            </span>
          </h2>

          {(!restaurants || restaurants.length === 0) ? (
            <div className="text-center py-16 bg-neutral-900/50 rounded-xl border border-neutral-800">
              <p className="text-neutral-400">ยังไม่มีร้านอาหารเปิดให้บริการในขณะนี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map((store: Restaurant) => {
                const isOpen = store.status === 'open'

                return (
                  <div
                    key={store.id}
                    className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* ภาพปก */}
                      <div className="relative h-44 w-full bg-neutral-800 overflow-hidden">
                        <img
                          src={store.image_url || '/placeholder.jpg'}
                          alt={store.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span
                          className={`absolute top-3 right-3 px-2.5 py-1 text-xs font-semibold rounded-full backdrop-blur-md ${
                            isOpen
                              ? 'bg-emerald-500/80 text-white'
                              : 'bg-rose-500/80 text-white'
                          }`}
                        >
                          {isOpen ? 'เปิดอยู่' : 'ปิดแล้ว'}
                        </span>
                      </div>

                      {/* รายละเอียด */}
                      <div className="p-5 space-y-3">
                        <div>
                          <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                            {store.name}
                          </h3>
                          {store.description && (
                            <p className="text-xs text-neutral-400 line-clamp-2 mt-1">
                              {store.description}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
                          {store.address && (
                            <p className="flex items-center gap-1.5">
                              <span>📍</span>
                              <span className="line-clamp-1">{store.address}</span>
                            </p>
                          )}
                          {(store.open_time || store.close_time) && (
                            <p className="flex items-center gap-1.5">
                              <span>🕒</span>
                              <span>
                                {store.open_time?.slice(0, 5)} - {store.close_time?.slice(0, 5)} น.
                              </span>
                            </p>
                          )}
                          {store.phone && (
                            <p className="flex items-center gap-1.5">
                              <span>📞</span>
                              <span>{store.phone}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ปุ่มสั่งซื้อ / ดูเมนู */}
                    <div className="p-5 pt-0">
                      <button
                        disabled={!isOpen}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition ${
                          isOpen
                            ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/10'
                            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                        }`}
                      >
                        {isOpen ? 'เลือกร้านนี้' : 'ร้านยังไม่เปิด'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}