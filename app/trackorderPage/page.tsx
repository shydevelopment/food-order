import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'

interface Order {
  id: string
  order_no: number | null
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

interface Menu {
  id: string
  name: string
  image_url: string | null
}

interface Restaurant {
  id: string
  name: string
}

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
      return 'รอดำเนินการ'
  }
}

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const highlightedOrderId = resolvedSearchParams.order

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, order_no, restaurant_id, total_price, status, delivery_address, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('Error fetching orders:', ordersError.message)
  }

  const orderRows = (orders || []) as Order[]
  const orderIds = orderRows.map((order) => order.id)
  const restaurantIds = Array.from(new Set(orderRows.map((order) => order.restaurant_id)))

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
      .select('id, name')
      .in('id', restaurantIds)
    : { data: [] }

  const itemsByOrder = new Map<string, OrderItem[]>()
  itemRows.forEach((item) => {
    const list = itemsByOrder.get(item.order_id) || []
    list.push(item)
    itemsByOrder.set(item.order_id, list)
  })

  const menusById = new Map((menus || []).map((menu: Menu) => [menu.id, menu]))
  const restaurantsById = new Map((restaurants || []).map((restaurant: Restaurant) => [restaurant.id, restaurant]))

  return (
    <div className="min-h-[80vh] bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-amber-400">Track Order</p>
            <h1 className="mt-2 text-3xl font-black">ติดตามคำสั่งซื้อ</h1>
            <p className="mt-2 text-sm text-neutral-400">ดูรายการอาหารที่สั่งและสถานะล่าสุดของออร์เดอร์</p>
          </div>
          <a
            href="/storePage"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-800 px-4 py-2 text-sm font-bold text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
          >
            สั่งอาหารเพิ่ม
          </a>
        </div>

        {orderRows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-10 text-center">
            <h2 className="text-xl font-black text-white">ยังไม่มีคำสั่งซื้อ</h2>
            <p className="mt-2 text-sm text-neutral-400">เมื่อคุณยืนยันออร์เดอร์ รายการจะมาแสดงที่หน้านี้</p>
          </div>
        ) : (
          <div className="space-y-5">
            {orderRows.map((order) => {
              const orderItemsForOrder = itemsByOrder.get(order.id) || []
              const restaurant = restaurantsById.get(order.restaurant_id)
              const isHighlighted = highlightedOrderId === order.id

              return (
                <article
                  key={order.id}
                  className={`rounded-2xl border bg-neutral-900 p-5 shadow-2xl ${
                    isHighlighted ? 'border-amber-500/60 shadow-amber-500/10' : 'border-neutral-800'
                  }`}
                >
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

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left sm:text-right">
                      <p className="text-xs text-neutral-500">ยอดรวม</p>
                      <p className="text-xl font-black text-amber-400">
                        ฿{Number(order.total_price).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>

                  {order.delivery_address && (
                    <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-300">
                      <span className="font-bold text-neutral-500">ที่อยู่จัดส่ง:</span> {order.delivery_address}
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    {orderItemsForOrder.map((item) => {
                      const menu = menusById.get(item.menu_id)

                      return (
                        <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 sm:flex-row sm:items-center">
                          <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg bg-neutral-800 sm:h-14 sm:w-14">
                            <img
                              src={menu?.image_url || '/placeholder.jpg'}
                              alt={menu?.name || 'menu'}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">{menu?.name || 'เมนูที่ถูกลบแล้ว'}</p>
                            <p className="mt-0.5 text-xs text-neutral-500">จำนวน {item.quantity}</p>
                          </div>
                          <p className="text-sm font-black text-neutral-300 sm:text-right">
                            ฿{(Number(item.price) * item.quantity).toLocaleString('th-TH')}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
