import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/service'
import AdminOrdersRealtime from '@/components/admin-orders-realtime'
import OrderStatusActions from '@/components/order-status-actions'

interface Customer {
  id: string
  full_name: string | null
  username: string | null
  phone: string | null
  email: string | null
}

interface Order {
  id: string
  order_no: number | null
  user_id: string
  restaurant_id: string
  total_price: number | string
  status: string | null
  delivery_address: string | null
  created_at: string
}

interface OrderItem {
  id: string
  order_id: string
  menu_id: string
  quantity: number
  price: number | string
}

interface Restaurant {
  id: string
  name: string
  owner_id: string | null
  email: string | null
}

interface RestaurantMember {
  restaurant_id: string
}

interface Menu {
  id: string
  name: string
  image_url: string | null
}

const statusTabs = [
  { value: 'pending', label: 'รอรับออเดอร์' },
  { value: 'preparing', label: 'กำลังเตรียม' },
  { value: 'delivering', label: 'กำลังจัดส่ง' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'cancelled', label: 'ยกเลิก' },
]

const getStatusStyle = (status: string | null) => {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
    case 'cancelled':
      return 'border-red-500/30 bg-red-500/10 text-red-400'
    case 'preparing':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
    case 'delivering':
      return 'border-purple-500/30 bg-purple-500/10 text-purple-400'
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
  }
}

const getStatusLabel = (status: string | null) => {
  switch (status) {
    case 'completed':
      return 'สำเร็จแล้ว'
    case 'cancelled':
      return 'ยกเลิก'
    case 'preparing':
      return 'กำลังเตรียมอาหาร'
    case 'delivering':
      return 'กำลังจัดส่ง'
    default:
      return 'รอรับออเดอร์'
  }
}

const buildOrdersHref = (params: { status?: string; restaurantId?: string }) => {
  const search = new URLSearchParams()

  if (params.status) search.set('status', params.status)
  if (params.restaurantId) search.set('restaurantId', params.restaurantId)

  const query = search.toString()
  return query ? `/admin/orders?${query}` : '/admin/orders'
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; restaurantId?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const selectedStatus = resolvedSearchParams.status
  const selectedRestaurantId = resolvedSearchParams.restaurantId

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, email, full_name, username, phone')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !['admin', 'restaurant'].includes(profile.role)) {
    redirect('/')
  }

  const ownerFilters = [`owner_id.eq.${user.id}`]

  if (profile.email) {
    ownerFilters.push(`email.eq.${profile.email}`)
  }

  const { data: ownerRestaurants } = profile.role === 'restaurant'
    ? await supabaseAdmin
      .from('restaurants')
      .select('id, name, owner_id, email')
      .or(ownerFilters.join(','))
    : { data: null }

  const { data: restaurantMembers, error: restaurantMembersError } = profile.role === 'restaurant'
    ? await supabaseAdmin
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', user.id)
    : { data: null, error: null }

  if (restaurantMembersError) {
    console.error('Error fetching restaurant members:', restaurantMembersError.message)
  }

  const ownerRestaurantIds = (ownerRestaurants || []).map((restaurant: Restaurant) => restaurant.id)
  const memberRestaurantIds = ((restaurantMembers || []) as RestaurantMember[]).map((member) => member.restaurant_id)
  const allowedRestaurantIds = Array.from(new Set([...ownerRestaurantIds, ...memberRestaurantIds]))

  const isAdmin = profile.role === 'admin'
  const { data: selectableRestaurants } = isAdmin
    ? await supabaseAdmin
      .from('restaurants')
      .select('id, name, owner_id, email')
      .order('name', { ascending: true })
    : { data: [] }

  const selectableRestaurantRows = (selectableRestaurants || []) as Restaurant[]
  const selectableRestaurantIds = selectableRestaurantRows.map((restaurant) => restaurant.id)
  const canUseRestaurantFilter = Boolean(
    isAdmin && selectedRestaurantId && selectableRestaurantIds.includes(selectedRestaurantId)
  )

  let ordersQuery = supabaseAdmin
    .from('orders')
    .select('id, order_no, user_id, restaurant_id, total_price, status, delivery_address, created_at')
    .order('created_at', { ascending: false })

  if (selectedStatus && statusTabs.some((status) => status.value === selectedStatus)) {
    ordersQuery = ordersQuery.eq('status', selectedStatus)
  }

  if (profile.role === 'restaurant') {
    if (allowedRestaurantIds.length === 0) {
      ordersQuery = ordersQuery.in('restaurant_id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      ordersQuery = ordersQuery.in('restaurant_id', allowedRestaurantIds)
    }
  }

  if (canUseRestaurantFilter) {
    ordersQuery = ordersQuery.eq('restaurant_id', selectedRestaurantId)
  }

  const { data: orders, error: ordersError } = await ordersQuery

  if (ordersError) {
    console.error('Error fetching admin orders:', ordersError.message)
  }

  const orderRows = (orders || []) as Order[]
  const orderIds = orderRows.map((order) => order.id)
  const restaurantIds = Array.from(new Set(orderRows.map((order) => order.restaurant_id)))
  const userIds = Array.from(new Set(orderRows.map((order) => order.user_id)))

  const { data: orderItems } = orderIds.length > 0
    ? await supabaseAdmin
      .from('order_items')
      .select('id, order_id, menu_id, quantity, price')
      .in('order_id', orderIds)
    : { data: [] }

  const itemRows = (orderItems || []) as OrderItem[]
  const menuIds = Array.from(new Set(itemRows.map((item) => item.menu_id)))

  const { data: menus } = menuIds.length > 0
    ? await supabaseAdmin
      .from('menus')
      .select('id, name, image_url')
      .in('id', menuIds)
    : { data: [] }

  const { data: restaurants } = restaurantIds.length > 0
    ? await supabaseAdmin
      .from('restaurants')
      .select('id, name, owner_id, email')
      .in('id', restaurantIds)
    : { data: ownerRestaurants || [] }

  const { data: customers } = userIds.length > 0
    ? await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, phone, email')
      .in('id', userIds)
    : { data: [] }

  const itemsByOrder = new Map<string, OrderItem[]>()
  itemRows.forEach((item) => {
    const list = itemsByOrder.get(item.order_id) || []
    list.push(item)
    itemsByOrder.set(item.order_id, list)
  })

  const menusById = new Map((menus || []).map((menu: Menu) => [menu.id, menu]))
  const restaurantsById = new Map((restaurants || []).map((restaurant: Restaurant) => [restaurant.id, restaurant]))
  const customersById = new Map((customers || []).map((customer: Customer) => [customer.id, customer]))
  const pendingCount = orderRows.filter((order) => !order.status || order.status === 'pending').length
  const selectedRestaurant = selectedRestaurantId
    ? selectableRestaurantRows.find((restaurant) => restaurant.id === selectedRestaurantId)
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-500">
            {profile.role === 'admin' ? 'Admin Orders' : 'Restaurant Workspace'}
          </p>
          <h1 className="mt-2 text-2xl font-black text-white">
            {profile.role === 'admin' ? 'รับออเดอร์จากลูกค้า' : 'ศูนย์รับออเดอร์ร้าน'}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {profile.role === 'admin'
              ? 'แอดมินเห็นออร์เดอร์ทุกสาขาและปรับสถานะได้'
              : 'จัดการออร์เดอร์เฉพาะร้านที่คุณได้รับสิทธิ์ พร้อมอัปเดตสถานะให้ลูกค้าเห็นแบบเรียลไทม์'}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <AdminOrdersRealtime />
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
            <span className="font-bold text-amber-400">{pendingCount}</span>
            <span className="ml-1 text-neutral-300">ออร์เดอร์รอรับในมุมมองนี้</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={buildOrdersHref({ restaurantId: isAdmin ? selectedRestaurantId : undefined })}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
            !selectedStatus ? 'bg-orange-500 text-black' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          ทั้งหมด
        </a>
        {statusTabs.map((status) => (
          <a
            key={status.value}
            href={buildOrdersHref({ status: status.value, restaurantId: isAdmin ? selectedRestaurantId : undefined })}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              selectedStatus === status.value ? 'bg-orange-500 text-black' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            {status.label}
          </a>
        ))}
      </div>

      {isAdmin && (
        <form action="/admin/orders" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label htmlFor="restaurantId" className="mb-1 block text-xs font-bold uppercase tracking-wide text-neutral-500">
                กรองตามร้านอาหาร
              </label>
              <div className="relative">
                <select
                  id="restaurantId"
                  name="restaurantId"
                  defaultValue={canUseRestaurantFilter ? selectedRestaurantId : ''}
                  className="w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 pr-8 text-sm font-bold text-white focus:border-orange-500 focus:outline-none"
                >
                  <option value="">ทุกร้านอาหาร</option>
                  {selectableRestaurantRows.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id} className="bg-neutral-950 text-white">
                      {restaurant.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-neutral-500">▼</span>
              </div>
            </div>

            {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}

            <button
              type="submit"
              className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-black transition hover:bg-orange-600"
            >
              ดูออเดอร์
            </button>

            {(selectedStatus || canUseRestaurantFilter) && (
              <a
                href="/admin/orders"
                className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2 text-center text-xs font-bold text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
              >
                ล้างตัวกรอง
              </a>
            )}
          </div>

          {selectedRestaurant && (
            <p className="mt-3 text-xs text-neutral-400">
              กำลังดูออเดอร์ของร้าน <span className="font-bold text-orange-400">{selectedRestaurant.name}</span>
            </p>
          )}
        </form>
      )}

      {profile.role === 'restaurant' && allowedRestaurantIds.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-10 text-center">
          <h2 className="text-xl font-black text-white">ยังไม่ได้ผูกบัญชีกับร้าน</h2>
          <p className="mt-2 text-sm text-neutral-400">
            กรุณาให้แอดมินเพิ่มบัญชีนี้ในหน้า สิทธิ์ร้านอาหาร
          </p>
        </div>
      ) : orderRows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-10 text-center">
          <h2 className="text-xl font-black text-white">ยังไม่มีออร์เดอร์</h2>
          <p className="mt-2 text-sm text-neutral-400">เมื่อมีลูกค้าสั่งอาหาร รายการจะมาแสดงตรงนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {orderRows.map((order) => {
            const restaurant = restaurantsById.get(order.restaurant_id)
            const customer = customersById.get(order.user_id)
            const orderItemsForOrder = itemsByOrder.get(order.id) || []

            return (
              <article key={order.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-white">Order #{order.order_no || order.id.slice(0, 8)}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${getStatusStyle(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-400">ร้าน {restaurant?.name || 'ไม่พบชื่อร้าน'}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {new Date(order.created_at).toLocaleString('th-TH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-right">
                    <p className="text-xs text-neutral-500">ยอดรวม</p>
                    <p className="text-xl font-black text-orange-500">
                      ฿{Number(order.total_price).toLocaleString('th-TH')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">ลูกค้า</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {customer?.full_name || customer?.username || 'ไม่พบชื่อผู้ใช้'}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">{customer?.email || '-'}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">{customer?.phone || '-'}</p>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">ที่อยู่จัดส่ง</p>
                    <p className="mt-1 text-sm text-neutral-300">{order.delivery_address || '-'}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {orderItemsForOrder.map((item) => {
                    const menu = menusById.get(item.menu_id)

                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                          <img
                            src={menu?.image_url || '/placeholder.jpg'}
                            alt={menu?.name || 'menu'}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{menu?.name || 'เมนูที่ถูกลบแล้ว'}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {item.quantity} x ฿{Number(item.price).toLocaleString('th-TH')}
                          </p>
                        </div>
                        <p className="text-sm font-black text-neutral-300">
                          ฿{(Number(item.price) * item.quantity).toLocaleString('th-TH')}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-5 border-t border-neutral-800 pt-4">
                  <OrderStatusActions orderId={order.id} status={order.status} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
