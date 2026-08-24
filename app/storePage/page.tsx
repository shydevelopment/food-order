import Link from 'next/link'
import { createClient } from '@/supabase/service'
import { getRestaurantTypeMeta, RESTAURANT_TYPES, RESTAURANT_TYPE_VALUES } from '@/lib/restaurant-types'
import { formatThaiPhoneInput } from '@/lib/phone'
import { getBangkokDayIndex, isMenuAvailableOnDay, WEEKDAY_OPTIONS } from '@/lib/menu-days'

interface Restaurant {
  id: string
  name: string
  description: string | null
  image_url: string | null
  email: string | null
  phone: string | null
  address: string | null
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

export default async function StoreIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const todayIndex = getBangkokDayIndex()
  const todayLabel = WEEKDAY_OPTIONS.find((day) => day.value === todayIndex)?.label || 'วันนี้'
  const selectedType = RESTAURANT_TYPE_VALUES.includes(resolvedSearchParams.type as typeof RESTAURANT_TYPE_VALUES[number])
    ? resolvedSearchParams.type
    : 'all'

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: restaurants, error }, { data: menus, error: menuError }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, description, image_url, email, phone, address, status, open_time, close_time, restaurant_type')
      .order('name', { ascending: true }),
    supabase
      .from('menus')
      .select('id, restaurant_id, is_available, available_days'),
  ])

  if (error) {
    console.error('Error fetching restaurants:', error.message)
  }

  if (menuError) {
    console.error('Error fetching menus:', menuError.message)
  }

  const menusByRestaurant = new Map<string, Menu[]>()

  ;((menus || []) as Menu[]).forEach((menu) => {
    if (!isMenuAvailableOnDay(menu.available_days, todayIndex)) return

    const restaurantMenus = menusByRestaurant.get(menu.restaurant_id) || []
    restaurantMenus.push(menu)
    menusByRestaurant.set(menu.restaurant_id, restaurantMenus)
  })

  const restaurantRowsAll = (restaurants || []) as Restaurant[]
  const restaurantRows = selectedType === 'all'
    ? restaurantRowsAll
    : restaurantRowsAll.filter((store) => store.restaurant_type === selectedType)
  const typeCounts = new Map<string, number>()

  restaurantRowsAll.forEach((store) => {
    const type = store.restaurant_type || 'rice_menu'
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
  })

  return (
    <div className="min-h-screen bg-neutral-950 pb-12 text-white">
      <main className="w-full px-0 pt-5 sm:px-2 sm:pt-8">
        <section className="mb-6 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900">
          <div className="grid min-h-[240px] grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-10">
              <p className="text-xs font-black uppercase tracking-wide text-amber-400">Food Order KMUTNB</p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                เลือกร้านก่อนสั่งอาหาร
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
                ดูร้านที่เปิดอยู่ เมนูที่ขาย{todayLabel} และข้อมูลติดต่อก่อนเข้าหน้าร้านจริง
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">
                  {restaurantRowsAll.length} ร้าน
                </span>
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                  เปิดอยู่ {restaurantRowsAll.filter((store) => store.status === 'open').length} ร้าน
                </span>
                <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                  เมนูวันนี้ {(menus || []).filter((menu) => isMenuAvailableOnDay((menu as Menu).available_days, todayIndex)).length} รายการ
                </span>
              </div>
            </div>
            <div className="hidden border-l border-neutral-800 bg-[radial-gradient(circle_at_35%_30%,rgba(245,158,11,0.28),transparent_32%),linear-gradient(135deg,#111,#20150a)] p-8 lg:flex lg:items-end">
              <div className="w-full rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur">
                <p className="text-xs font-bold text-neutral-400">แสดงเฉพาะเมนูของ</p>
                <p className="mt-1 text-2xl font-black text-amber-300">{todayLabel}</p>
                <p className="mt-2 text-sm text-neutral-300">
                  เข้าไปที่ร้านเพื่อเลือกเมนู เขียนเมนูตามสั่ง หรือเพิ่มลงตะกร้า
                </p>
              </div>
            </div>
          </div>
        </section>

        {!user && (
          <div className="mb-5 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-bold">ดูร้านได้ทันที แต่ต้องเข้าสู่ระบบก่อนสั่งอาหาร</p>
              <Link
                href="/login"
                className="inline-flex justify-center rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-black transition hover:bg-orange-400"
              >
                Login เพื่อสั่งอาหาร
              </Link>
            </div>
          </div>
        )}

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">ร้านอาหารทั้งหมด</h2>
              <p className="mt-1 text-sm text-neutral-500">กดเข้าร้านเพื่อดูเมนูและสั่งอาหาร</p>
            </div>
            <span className="w-fit rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-bold text-neutral-400">
              {todayLabel}
            </span>
          </div>

          <div className="mb-5 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              <Link
                href="/storePage"
                className={`rounded-2xl border px-4 py-3 text-xs font-black transition ${
                  selectedType === 'all'
                    ? 'border-orange-500 bg-orange-500 text-black'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-orange-500/40 hover:text-orange-300'
                }`}
              >
                ทั้งหมด
                <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-[10px]">{restaurantRowsAll.length}</span>
              </Link>
              {RESTAURANT_TYPES.map((type) => (
                <Link
                  key={type.value}
                  href={`/storePage?type=${type.value}`}
                  className={`rounded-2xl border px-4 py-3 text-xs font-black transition ${
                    selectedType === type.value
                      ? 'border-orange-500 bg-orange-500 text-black'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-orange-500/40 hover:text-orange-300'
                  }`}
                >
                  <span className="mr-1 text-sm">{type.icon}</span>
                  {type.label}
                  <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-[10px]">{typeCounts.get(type.value) || 0}</span>
                </Link>
              ))}
            </div>
          </div>

          {restaurantRows.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-10 text-center">
              <h3 className="text-lg font-black text-white">ยังไม่มีร้านประเภทนี้</h3>
              <p className="mt-2 text-sm text-neutral-500">ลองเลือกประเภทอื่น หรือเพิ่มร้านในหน้าแอดมิน</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {restaurantRows.map((store) => {
                const isOpen = store.status === 'open'
                const typeMeta = getRestaurantTypeMeta(store.restaurant_type)
                const todayMenus = menusByRestaurant.get(store.id) || []
                const availableMenus = todayMenus.filter((menu) => menu.is_available)

                return (
                  <article
                    key={store.id}
                    className="group overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-orange-500/40"
                  >
                    <Link href={`/storePage/${store.id}`} className="block">
                      <div className="relative h-48 overflow-hidden bg-neutral-800">
                        <img
                          src={store.image_url || '/placeholder.jpg'}
                          alt={store.name}
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-black shadow-lg ${
                            isOpen ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                          }`}>
                            {isOpen ? 'เปิดอยู่' : 'ปิดแล้ว'}
                          </span>
                          <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-black text-white backdrop-blur">
                            {availableMenus.length} เมนูวันนี้
                          </span>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4">
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[10px] font-black text-amber-200 backdrop-blur">
                            <span className="mr-1">{typeMeta.icon}</span>
                            {typeMeta.label}
                          </span>
                          <h3 className="mt-2 line-clamp-1 text-2xl font-black text-white">
                            {store.name}
                          </h3>
                        </div>
                      </div>
                    </Link>

                    <div className="space-y-4 p-4">
                      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-neutral-400">
                        {store.description || typeMeta.description}
                      </p>

                      <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400">
                        <p className="flex gap-2">
                          <span className="shrink-0 text-pink-400">●</span>
                          <span className="line-clamp-1">{store.address || 'ยังไม่ระบุที่อยู่ร้าน'}</span>
                        </p>
                        <p className="flex gap-2">
                          <span className="shrink-0 text-amber-400">●</span>
                          <span>{formatTimeRange(store.open_time, store.close_time)}</span>
                        </p>
                        <p className="flex gap-2">
                          <span className="shrink-0 text-emerald-400">●</span>
                          <span>{store.phone ? formatThaiPhoneInput(store.phone) : 'ยังไม่ระบุเบอร์โทร'}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
                          <p className="text-xl font-black text-amber-400">{todayMenus.length}</p>
                          <p className="text-[10px] font-bold text-neutral-500">เมนูของวันนี้</p>
                        </div>
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
                          <p className="text-xl font-black text-emerald-400">{availableMenus.length}</p>
                          <p className="text-[10px] font-bold text-neutral-500">พร้อมขาย</p>
                        </div>
                      </div>

                      <Link
                        href={`/storePage/${store.id}`}
                        className="flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-400"
                      >
                        เข้าร้าน
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
