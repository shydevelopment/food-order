import { createClient } from '@/supabase/service'
import Link from 'next/link'
import { getBangkokDayIndex, isMenuAvailableOnDay } from '@/lib/menu-days'
import { getRestaurantTypeMeta, RESTAURANT_TYPES } from '@/lib/restaurant-types'
import HomeClockBadge from '@/components/home-clock-badge'

interface Restaurant {
  id: string
  name: string
  description: string | null
  image_url: string | null
  address: string | null
  phone: string | null
  status: string | null
  open_time: string | null
  close_time: string | null
  restaurant_type: string | null
}

interface Menu {
  id: string
  restaurant_id: string
  is_available: boolean | null
  available_days: number[] | null
}

const formatTimeRange = (openTime: string | null, closeTime: string | null) => {
  if (!openTime && !closeTime) return 'ยังไม่ระบุเวลา'
  return `${openTime?.slice(0, 5) || '--:--'} - ${closeTime?.slice(0, 5) || '--:--'} น.`
}

export default async function Index() {
  const supabase = await createClient()
  const todayIndex = getBangkokDayIndex()

  const [
    { data: { user } },
    { data: restaurants, error: restaurantError },
    { data: menus, error: menuError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('restaurants')
      .select('id, name, description, image_url, address, phone, status, open_time, close_time, restaurant_type')
      .order('name', { ascending: true }),
    supabase
      .from('menus')
      .select('id, restaurant_id, is_available, available_days'),
  ])

  if (restaurantError) {
    console.error('Error fetching restaurants:', restaurantError.message)
  }

  if (menuError) {
    console.error('Error fetching menus:', menuError.message)
  }

  const restaurantRows = (restaurants || []) as Restaurant[]
  const menuRows = (menus || []) as Menu[]
  const todayMenus = menuRows.filter((menu) => isMenuAvailableOnDay(menu.available_days, todayIndex))
  const availableTodayMenus = todayMenus.filter((menu) => menu.is_available)
  const openRestaurants = restaurantRows.filter((restaurant) => restaurant.status === 'open')
  const featuredRestaurant = openRestaurants[0] || restaurantRows[0] || null

  const menusByRestaurant = new Map<string, Menu[]>()
  todayMenus.forEach((menu) => {
    const restaurantMenus = menusByRestaurant.get(menu.restaurant_id) || []
    restaurantMenus.push(menu)
    menusByRestaurant.set(menu.restaurant_id, restaurantMenus)
  })

  const typeCounts = new Map<string, number>()
  restaurantRows.forEach((restaurant) => {
    const type = restaurant.restaurant_type || 'rice_menu'
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
  })

  const quickRestaurants = openRestaurants.slice(0, 4)
  const featuredType = getRestaurantTypeMeta(featuredRestaurant?.restaurant_type)
  const featuredMenuCount = featuredRestaurant
    ? menusByRestaurant.get(featuredRestaurant.id)?.filter((menu) => menu.is_available).length || 0
    : 0

  return (
    <div className="home-page min-h-screen text-white">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-0 pb-8 sm:px-2 lg:gap-6">
        <section className="home-hero overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950">
          <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[minmax(0,1.04fr)_minmax(390px,0.96fr)]">
            <div className="flex flex-col justify-between gap-8 p-5 sm:p-8 lg:p-10">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="home-brand-badge rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">
                    Food Order KMUTNB
                  </span>
                  <HomeClockBadge />
                </div>

                <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                  เลือกของกินในมหาลัยให้ไวกว่าเดิม
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-400 sm:text-base">
                  ดูร้านที่เปิดอยู่ เช็กเมนูของวันนี้ แล้วกดเข้าร้านเพื่อสั่งอาหารหรือติดตามออเดอร์ได้ในที่เดียว
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/storePage"
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-black text-black transition hover:bg-orange-400 active:scale-95"
                  >
                    ดูร้านอาหาร
                  </Link>
                  <Link
                    href={user ? '/trackorderPage' : '/login'}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900 px-6 text-sm font-black text-white transition hover:border-sky-500/50 hover:text-sky-300 active:scale-95"
                  >
                    {user ? 'ติดตามออเดอร์' : 'เข้าสู่ระบบ'}
                  </Link>
                  {!user && (
                    <Link
                      href="/register"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-neutral-800 px-6 text-sm font-bold text-neutral-300 transition hover:border-orange-500/40 hover:text-orange-300 active:scale-95"
                    >
                      สมัครสมาชิก
                    </Link>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  [restaurantRows.length, 'ร้านทั้งหมด', 'text-orange-300'],
                  [openRestaurants.length, 'เปิดอยู่', 'text-emerald-300'],
                  [todayMenus.length, 'เมนูวันนี้', 'text-sky-300'],
                  [availableTodayMenus.length, 'พร้อมขาย', 'text-pink-300'],
                ].map(([value, label, tone]) => (
                  <div key={label} className="home-stat-card rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                    <p className={`text-2xl font-black ${tone}`}>{value}</p>
                    <p className="mt-1 text-xs font-bold text-neutral-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="home-featured-media relative min-h-[360px] overflow-hidden border-t border-neutral-800 bg-neutral-900 lg:border-l lg:border-t-0">
              {featuredRestaurant ? (
                <>
                  <img
                    src={featuredRestaurant.image_url || '/placeholder.jpg'}
                    alt={featuredRestaurant.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
                  <div className="home-on-image absolute inset-x-0 bottom-0 p-5 sm:p-7">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${
                        featuredRestaurant.status === 'open'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}>
                        {featuredRestaurant.status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว'}
                      </span>
                      <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-black text-white backdrop-blur">
                        {featuredType.icon} {featuredType.label}
                      </span>
                    </div>
                    <h2 className="text-3xl font-black text-white sm:text-4xl">{featuredRestaurant.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-200">
                      {featuredRestaurant.description || featuredType.description}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="home-glass-card rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur">
                        <p className="text-xs font-bold text-neutral-400">เวลาเปิด</p>
                        <p className="mt-1 font-black text-amber-300">{formatTimeRange(featuredRestaurant.open_time, featuredRestaurant.close_time)}</p>
                      </div>
                      <div className="home-glass-card rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur">
                        <p className="text-xs font-bold text-neutral-400">เมนูพร้อมขาย</p>
                        <p className="mt-1 font-black text-sky-300">{featuredMenuCount} รายการ</p>
                      </div>
                    </div>
                    <Link
                      href={`/storePage/${featuredRestaurant.id}`}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-neutral-950 transition hover:bg-orange-200 active:scale-95 sm:w-auto"
                    >
                      เข้าร้านแนะนำ
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[360px] items-center justify-center p-8 text-center">
                  <div>
                    <h2 className="text-2xl font-black text-white">ยังไม่มีร้านอาหารในระบบ</h2>
                    <p className="mt-2 text-sm text-neutral-500">เพิ่มร้านในหน้าแอดมินแล้วร้านจะแสดงตรงนี้</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="home-panel rounded-3xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">ร้านที่เปิดอยู่ตอนนี้</h2>
                <p className="mt-1 text-sm text-neutral-500">เลือกเข้าร้านเพื่อดูเมนูของวันนี้</p>
              </div>
              <Link href="/storePage" className="shrink-0 text-sm font-black text-orange-400 transition hover:text-orange-300">
                ดูทั้งหมด
              </Link>
            </div>

            {quickRestaurants.length === 0 ? (
              <div className="home-empty-state rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center">
                <p className="font-bold text-neutral-300">ตอนนี้ยังไม่มีร้านเปิด</p>
                <p className="mt-1 text-sm text-neutral-500">ลองดูร้านทั้งหมดเพื่อเช็กเวลาเปิดปิด</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {quickRestaurants.map((restaurant) => {
                  const typeMeta = getRestaurantTypeMeta(restaurant.restaurant_type)
                  const availableCount = menusByRestaurant.get(restaurant.id)?.filter((menu) => menu.is_available).length || 0

                  return (
                    <Link
                      key={restaurant.id}
                      href={`/storePage/${restaurant.id}`}
                      className="home-quick-card group grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-3 transition hover:border-orange-500/40 hover:bg-neutral-900"
                    >
                      <div className="relative h-24 overflow-hidden rounded-xl bg-neutral-800">
                        <img
                          src={restaurant.image_url || '/placeholder.jpg'}
                          alt={restaurant.name}
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{typeMeta.icon}</span>
                          <span className="truncate text-[11px] font-black text-amber-300">{typeMeta.label}</span>
                        </div>
                        <h3 className="mt-1 truncate text-lg font-black text-white">{restaurant.name}</h3>
                        <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{restaurant.address || 'ยังไม่ระบุที่อยู่ร้าน'}</p>
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-neutral-400">{formatTimeRange(restaurant.open_time, restaurant.close_time)}</span>
                          <span className="rounded-full bg-emerald-500/15 px-2 py-1 font-black text-emerald-300">{availableCount} เมนู</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <aside className="home-panel rounded-3xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
            <h2 className="text-xl font-black text-white">หมวดร้าน</h2>
            <p className="mt-1 text-sm text-neutral-500">กดเพื่อกรองร้านตามประเภท</p>
            <div className="mt-4 space-y-2">
              {RESTAURANT_TYPES.map((type) => (
                <Link
                  key={type.value}
                  href={`/storePage?type=${type.value}`}
                  className="home-category-link flex items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 transition hover:border-orange-500/40 hover:bg-neutral-900"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">
                      <span className="mr-2">{type.icon}</span>
                      {type.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-neutral-500">{type.description}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-neutral-700 px-2.5 py-1 text-xs font-black text-orange-300">
                    {typeCounts.get(type.value) || 0}
                  </span>
                </Link>
              ))}
            </div>
          </aside>
        </section>

        {!user && (
          <section className="home-auth-callout rounded-3xl border border-sky-500/25 bg-sky-500/10 p-5 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">ดูร้านได้ทันที สั่งอาหารหลังเข้าสู่ระบบ</h2>
                <p className="mt-1 text-sm leading-6 text-neutral-300">
                  บัญชีจะช่วยเก็บตะกร้า ประวัติออเดอร์ และสถานะการสั่งอาหารของคุณ
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-sky-400 px-5 text-sm font-black text-neutral-950 transition hover:bg-sky-300 active:scale-95"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-sky-400/30 px-5 text-sm font-black text-sky-200 transition hover:bg-sky-400/10 active:scale-95"
                >
                  สมัครสมาชิก
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
