import Link from 'next/link'
import { notFound } from 'next/navigation'
import AddToCartButton from '@/components/add-to-cart-button'
import CustomMadeToOrderForm from '@/components/custom-made-to-order-form'
import { createClient } from '@/supabase/service'
import { formatThaiPhoneInput } from '@/lib/phone'
import { getRestaurantTypeMeta, supportsCustomMenuText, supportsSpecialOption } from '@/lib/restaurant-types'
import { getBangkokDayIndex, isMenuAvailableOnDay, WEEKDAY_OPTIONS } from '@/lib/menu-days'
import { getMenuCategoryToneClasses } from '@/lib/menu-categories'

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
  unavailable_ingredients: string[] | null
}

interface Menu {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  image_url: string | null
  price: number | string
  is_available: boolean | null
  available_days: number[] | null
  category_id: string | null
}

interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
}

const formatPrice = (price: number | string) => {
  return `฿${Number(price).toLocaleString('th-TH')}`
}

const formatTimeRange = (openTime: string | null, closeTime: string | null) => {
  if (!openTime && !closeTime) return 'ยังไม่ระบุเวลา'
  return `${openTime?.slice(0, 5) || '--:--'} - ${closeTime?.slice(0, 5) || '--:--'} น.`
}

export default async function RestaurantStorePage({
  params,
}: {
  params: Promise<{ restaurantId: string }>
}) {
  const { restaurantId } = await params
  const supabase = await createClient()
  const todayIndex = getBangkokDayIndex()
  const todayLabel = WEEKDAY_OPTIONS.find((day) => day.value === todayIndex)?.label || 'วันนี้'

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: restaurant, error: restaurantError },
    { data: menus, error: menusError },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single(),
    supabase
      .from('menus')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false }),
    supabase
      .from('menu_categories')
      .select('id, restaurant_id, name')
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true }),
  ])

  if (restaurantError || !restaurant) {
    notFound()
  }

  if (menusError) {
    console.error('Error fetching restaurant menus:', menusError.message)
  }

  if (categoriesError) {
    console.error('Error fetching menu categories:', categoriesError.message)
  }

  const store = restaurant as Restaurant
  const isOpen = store.status === 'open'
  const restaurantType = getRestaurantTypeMeta(store.restaurant_type)
  const canWriteCustomMenu = supportsCustomMenuText(store.restaurant_type)
  const canChooseSpecial = supportsSpecialOption(store.restaurant_type)
  const unavailableIngredients = store.unavailable_ingredients || []
  const todayMenus = ((menus || []) as Menu[]).filter((menu) => isMenuAvailableOnDay(menu.available_days, todayIndex))
  const availableMenus = todayMenus.filter((menu) => menu.is_available)
  const categoryRows = (categories || []) as MenuCategory[]
  const categoriesById = new Map(categoryRows.map((category, index) => [
    category.id,
    { ...category, toneClass: getMenuCategoryToneClasses(index) },
  ]))
  const groupedMenus = categoryRows
    .map((category) => ({
      id: category.id,
      name: category.name,
      toneClass: categoriesById.get(category.id)?.toneClass || getMenuCategoryToneClasses(0),
      menus: todayMenus.filter((menu) => menu.category_id === category.id),
    }))
    .filter((group) => group.menus.length > 0)
  const uncategorizedMenus = todayMenus.filter((menu) => !menu.category_id || !categoriesById.has(menu.category_id))
  const menuGroups = [
    ...groupedMenus,
    ...(uncategorizedMenus.length > 0
      ? [{
        id: 'uncategorized',
        name: 'เมนูอื่นๆ',
        toneClass: 'border-neutral-700 bg-neutral-800 text-neutral-300',
        menus: uncategorizedMenus,
      }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-neutral-950 pb-12 text-white">
      <main className="w-full px-0 pt-4 sm:px-2 sm:pt-6">
        <div className="mb-4">
          <Link
            href="/storePage"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-black text-neutral-300 transition hover:border-orange-500/40 hover:text-orange-300"
          >
            ← กลับไปเลือกร้าน
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl">
          <div className="relative min-h-[320px]">
            <img
              src={store.image_url || '/placeholder.jpg'}
              alt={store.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/15" />
            <div className="relative flex min-h-[320px] flex-col justify-end p-5 sm:p-8 lg:p-10">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-black ${
                  isOpen ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {isOpen ? 'เปิดอยู่' : 'ปิดแล้ว'}
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-200 backdrop-blur">
                  <span className="mr-1">{restaurantType.icon}</span>
                  {restaurantType.label}
                </span>
                <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-black text-white backdrop-blur">
                  {todayLabel}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                {store.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-200 sm:text-base">
                {store.description || restaurantType.description}
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
                  <p className="text-xs font-bold text-neutral-400">เวลาทำการ</p>
                  <p className="mt-1 font-black text-white">{formatTimeRange(store.open_time, store.close_time)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
                  <p className="text-xs font-bold text-neutral-400">เมนูวันนี้</p>
                  <p className="mt-1 font-black text-amber-300">{todayMenus.length} รายการ</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
                  <p className="text-xs font-bold text-neutral-400">พร้อมขาย</p>
                  <p className="mt-1 font-black text-emerald-300">{availableMenus.length} รายการ</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4">
              <h2 className="text-lg font-black text-white">ข้อมูลร้าน</h2>
              <div className="mt-4 space-y-3 text-sm text-neutral-400">
                <p className="flex gap-2">
                  <span className="shrink-0 text-pink-400">●</span>
                  <span>{store.address || 'ยังไม่ระบุที่อยู่ร้าน'}</span>
                </p>
                <p className="flex gap-2">
                  <span className="shrink-0 text-amber-400">●</span>
                  <span>{formatTimeRange(store.open_time, store.close_time)}</span>
                </p>
                <p className="flex gap-2">
                  <span className="shrink-0 text-emerald-400">●</span>
                  <span>{store.phone ? formatThaiPhoneInput(store.phone) : 'ยังไม่ระบุเบอร์โทร'}</span>
                </p>
                {store.email && (
                  <p className="flex gap-2">
                    <span className="shrink-0 text-sky-400">●</span>
                    <span className="break-all">{store.email}</span>
                  </p>
                )}
              </div>
            </div>

            {!user && (
              <div className="rounded-3xl border border-orange-500/20 bg-orange-500/10 p-4">
                <p className="text-sm font-bold text-orange-100">เข้าสู่ระบบก่อนสั่งอาหาร</p>
                <Link
                  href="/login"
                  className="mt-3 flex justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-400"
                >
                  Login เพื่อสั่ง
                </Link>
              </div>
            )}

            {unavailableIngredients.length > 0 && (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4">
                <h2 className="text-sm font-black text-red-200">วัตถุดิบที่หมดตอนนี้</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {unavailableIngredients.map((ingredient) => (
                    <span key={ingredient} className="rounded-full border border-red-400/25 bg-red-500/15 px-3 py-1 text-xs font-black text-red-200">
                      {ingredient}หมด
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-red-100/70">เมนูที่มีวัตถุดิบนี้จะสั่งไม่ได้ชั่วคราว</p>
              </div>
            )}
          </aside>

          <div className="space-y-5">
            <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-400">Menu</p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    {canWriteCustomMenu ? 'สั่งอาหารตามสั่ง' : `เมนูที่ขาย${todayLabel}`}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">{restaurantType.description}</p>
                </div>
                <span className="w-fit rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs font-bold text-neutral-400">
                  {todayMenus.length} เมนู
                </span>
              </div>

              {canWriteCustomMenu && user && (
                <div className="mt-5">
                  <CustomMadeToOrderForm
                    restaurantId={store.id}
                    restaurantName={store.name}
                    unavailableIngredients={store.unavailable_ingredients || []}
                    disabled={!isOpen}
                  />
                </div>
              )}

              {todayMenus.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
                  {canWriteCustomMenu
                    ? 'ร้านนี้ยังไม่มีเมนูแนะนำ แต่สามารถเขียนเมนูตามสั่งเองได้'
                    : `ร้านนี้ยังไม่มีเมนูสำหรับ${todayLabel}`}
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  {menuGroups.map((group) => (
                    <section key={group.id}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className={`rounded-full border px-3 py-1 text-sm font-black ${group.toneClass}`}>
                          {group.name}
                        </h3>
                        <span className="text-xs font-bold text-neutral-500">{group.menus.length} เมนู</span>
                      </div>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {group.menus.map((menu) => {
                          const canOrder = Boolean(user && isOpen && menu.is_available)
                          const menuCategory = menu.category_id ? categoriesById.get(menu.category_id) : null
                          const menuUnavailableMatch = unavailableIngredients.find((ingredient) => {
                            const normalizedIngredient = ingredient.trim().toLowerCase()
                            if (!normalizedIngredient) return false
                            return `${menu.name} ${menu.description || ''}`.toLowerCase().includes(normalizedIngredient)
                          })
                          const canSubmitMenu = Boolean(canOrder && !menuUnavailableMatch)

                          return (
                            <article key={menu.id} className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                              <div className="relative h-44 overflow-hidden bg-neutral-800">
                                <img
                                  src={menu.image_url || '/placeholder.jpg'}
                                  alt={menu.name}
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                                <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
                                  {menuCategory ? (
                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black backdrop-blur ${menuCategory.toneClass}`}>
                                      {menuCategory.name}
                                    </span>
                                  ) : <span />}
                                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
                                    menuUnavailableMatch
                                      ? 'border-red-500/25 bg-red-500/80 text-white'
                                      : menu.is_available
                                        ? 'border-emerald-500/25 bg-emerald-500/80 text-white'
                                      : 'border-red-500/25 bg-red-500/80 text-white'
                                  }`}>
                                    {menuUnavailableMatch ? `${menuUnavailableMatch}หมด` : menu.is_available ? 'พร้อมขาย' : 'หมด'}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h3 className="line-clamp-1 text-lg font-black text-white">{menu.name}</h3>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
                                      {menu.description || 'ไม่มีรายละเอียดเมนู'}
                                    </p>
                                  </div>
                                  <span className="shrink-0 text-lg font-black text-amber-400">{formatPrice(menu.price)}</span>
                                </div>

                                {user ? (
                                  <div className="space-y-2">
                                    {menuUnavailableMatch && (
                                      <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">
                                        วัตถุดิบ &quot;{menuUnavailableMatch}&quot; หมด ร้านแจ้งไว้ตอนนี้
                                      </p>
                                    )}
                                    <AddToCartButton
                                      menu={{
                                        id: menu.id,
                                        restaurantId: store.id,
                                        restaurantName: store.name,
                                        name: menu.name,
                                        price: Number(menu.price),
                                        imageUrl: menu.image_url,
                                      }}
                                      allowSpecial={canChooseSpecial}
                                      disabled={!canSubmitMenu}
                                    />
                                  </div>
                                ) : (
                                  <Link
                                    href="/login"
                                    className="flex justify-center rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-center text-xs font-black text-orange-800 transition hover:bg-orange-500 hover:text-black"
                                  >
                                    Login เพื่อสั่ง
                                  </Link>
                                )}
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
