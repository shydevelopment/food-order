import { createClient } from '@/supabase/service'
import AddToCartButton from '@/components/add-to-cart-button'

interface Restaurant {
  id: string
  name: string
  description: string | null
  image_url: string | null
  owner_id: string | null
  created_at: string
  email: string | null
  phone: string | null
  address: string | null
  status: string | null
  open_time: string | null
  close_time: string | null
}

interface Menu {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  image_url: string | null
  price: number | string
  is_available: boolean | null
}

const formatPrice = (price: number | string) => {
  return `฿${Number(price).toLocaleString('th-TH')}`
}

export default async function Index() {
  const supabase = await createClient()

  // ใช้ user เพื่อแยกสิทธิ์การสั่งอาหารเท่านั้น ไม่บังคับ login สำหรับการดูร้าน/เมนู
  const { data: { user } } = await supabase.auth.getUser()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching restaurants:', error.message)
  }

  const { data: menus, error: menuError } = await supabase
    .from('menus')
    .select('id, restaurant_id, name, description, image_url, price, is_available')
    .order('created_at', { ascending: false })

  if (menuError) {
    console.error('Error fetching menus:', menuError.message)
  }

  const menusByRestaurant = new Map<string, Menu[]>()

  ;(menus || []).forEach((menu: Menu) => {
    const restaurantMenus = menusByRestaurant.get(menu.restaurant_id) || []
    restaurantMenus.push(menu)
    menusByRestaurant.set(menu.restaurant_id, restaurantMenus)
  })

  return (
    <div className="min-h-screen overflow-x-hidden bg-neutral-950 text-white pb-12">
      <main className="max-w-6xl mx-auto px-3 pt-6 sm:px-4 sm:pt-8">
        <section className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">เลือกร้านอาหาร</h1>
            <p className="text-sm text-neutral-400 mt-1">
              ดูร้านและเมนูได้ทันที {user ? 'เลือกเมนูที่ต้องการได้เลย' : 'แต่ต้องเข้าสู่ระบบก่อนสั่งอาหาร'}
            </p>
          </div>

          {!user && (
            <a
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 transition hover:bg-orange-500 hover:text-black sm:w-auto"
            >
              Login เพื่อสั่งอาหาร
            </a>
          )}
        </section>

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {restaurants.map((store: Restaurant) => {
                const isOpen = store.status === 'open'
                const storeMenus = menusByRestaurant.get(store.id) || []

                return (
                  <div
                    key={store.id}
                    className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all duration-300"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
                      <div className="relative h-48 sm:h-full min-h-48 w-full bg-neutral-800 overflow-hidden">
                        <img
                          src={store.image_url || '/placeholder.jpg'}
                          alt={store.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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

                      <div className="p-5 space-y-4">
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

                    <div className="border-t border-neutral-800 bg-neutral-950/35 p-5">
                            <div className="flex items-center justify-between gap-3 mb-4">
                        <h4 className="text-sm font-black text-amber-400">เมนูอาหาร</h4>
                        <span className="text-[11px] text-neutral-500">{storeMenus.length} เมนู</span>
                      </div>

                      {storeMenus.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-neutral-800 p-5 text-center text-xs text-neutral-500">
                          ร้านนี้ยังไม่มีเมนูในระบบ
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {storeMenus.map((menu) => {
                            const canOrder = Boolean(user && isOpen && menu.is_available)

                            return (
                              <div
                                key={menu.id}
                                className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 sm:flex-row"
                              >
                                <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg bg-neutral-800 sm:h-20 sm:w-20">
                                  <img
                                    src={menu.image_url || '/placeholder.jpg'}
                                    alt={menu.name}
                                    className="absolute inset-0 h-full w-full object-cover"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                    <div className="min-w-0">
                                      <h5 className="truncate text-sm font-bold text-white">{menu.name}</h5>
                                      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                                        {menu.description || 'ไม่มีรายละเอียดเมนู'}
                                      </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-black text-amber-400">
                                      {formatPrice(menu.price)}
                                    </span>
                                  </div>

                                  <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                      menu.is_available
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                        : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                                    }`}>
                                      {menu.is_available ? 'พร้อมขาย' : 'หมด'}
                                    </span>

                                    {user ? (
                                      <AddToCartButton
                                        menu={{
                                          id: menu.id,
                                          restaurantId: store.id,
                                          restaurantName: store.name,
                                          name: menu.name,
                                          price: Number(menu.price),
                                          imageUrl: menu.image_url,
                                        }}
                                        disabled={!canOrder}
                                      />
                                    ) : (
                                      <a
                                        href="/login"
                                        className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-center text-xs font-black text-orange-800 transition hover:bg-orange-500 hover:text-black"
                                      >
                                        Login เพื่อสั่ง
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
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
