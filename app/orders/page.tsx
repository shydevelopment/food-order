import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/supabase/service'
import OrderChatBox from '@/components/order-chat-box'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  getOrderStatusLabel,
  getOrderStatusStyle,
  isActiveOrderStatus,
} from '@/lib/order-status'

interface Order {
  id: string
  order_no: number | null
  restaurant_id: string
  total_price: number | string
  status: string | null
  delivery_address: string | null
  pickup_time: string | null
  pickup_note: string | null
  cancellation_reason: string | null
  created_at: string
}

interface OrderItem {
  id: string
  order_id: string
  menu_id: string | null
  custom_name: string | null
  is_special: boolean | null
  item_note: string | null
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

const formatPickupTime = (pickupTime: string | null) => {
  return pickupTime ? pickupTime.slice(0, 5) : '-'
}

const paymentMethodLabel = 'เงินสด จ่ายหน้าร้าน'

const buildTrackOrderHref = (orderId: string) => {
  return `/orders?order=${orderId}`
}

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const highlightedOrderId = resolvedSearchParams.order

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select(
      'id, order_no, restaurant_id, total_price, status, delivery_address, pickup_time, pickup_note, cancellation_reason, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('Error fetching orders:', ordersError.message)
  }

  const orderRows = (orders || []) as Order[]
  const orderIds = orderRows.map((order) => order.id)
  const restaurantIds = Array.from(
    new Set(orderRows.map((order) => order.restaurant_id)),
  )

  const { data: orderItems } =
    orderIds.length > 0
      ? await supabaseAdmin
          .from('order_items')
          .select(
            'id, order_id, menu_id, custom_name, is_special, item_note, quantity, price',
          )
          .in('order_id', orderIds)
      : { data: [] }

  const itemRows = (orderItems || []) as OrderItem[]
  const menuIds = Array.from(
    new Set(itemRows.map((item) => item.menu_id).filter(Boolean)),
  )

  const { data: menus } =
    menuIds.length > 0
      ? await supabaseAdmin
          .from('menus')
          .select('id, name, image_url')
          .in('id', menuIds)
      : { data: [] }

  const { data: restaurants } =
    restaurantIds.length > 0
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
  const restaurantsById = new Map(
    (restaurants || []).map((restaurant: Restaurant) => [
      restaurant.id,
      restaurant,
    ]),
  )
  const activeOrders = orderRows.filter((order) =>
    isActiveOrderStatus(order.status),
  )
  const historyOrders = orderRows.filter(
    (order) => !isActiveOrderStatus(order.status),
  )
  const selectedOrder =
    orderRows.find((order) => order.id === highlightedOrderId) ||
    activeOrders[0] ||
    orderRows[0]

  return (
    <div className="min-h-[80vh] px-4 py-8 text-white">
      <div className="w-full">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-amber-400">
              Track Order
            </p>
            <h1 className="mt-2 text-3xl font-black">ติดตามคำสั่งซื้อ</h1>
            <p className="mt-2 text-sm text-neutral-400">
              ดูรายการอาหารที่สั่งและสถานะล่าสุดของออร์เดอร์
            </p>
          </div>
          <Link
            href="/restaurants"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-800 px-4 py-2 text-sm font-bold text-neutral-300 transition  hover:text-white"
          >
            สั่งอาหารเพิ่ม
          </Link>
        </div>

        {orderRows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800  p-10 text-center">
            <h2 className="text-xl font-black text-white">
              ยังไม่มีคำสั่งซื้อ
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              เมื่อคุณยืนยันออร์เดอร์ รายการจะมาแสดงที่หน้านี้
            </p>
          </div>
        ) : selectedOrder ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-neutral-800  p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-white">รายการออเดอร์</h2>
                {activeOrders.length > 0 && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-400">
                    กำลังสั่งอยู่ {activeOrders.length}
                  </span>
                )}
              </div>

              {activeOrders.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    กำลังสั่งอยู่
                  </p>
                  <div className="space-y-2">
                    {activeOrders.map((order) => {
                      const restaurant = restaurantsById.get(
                        order.restaurant_id,
                      )
                      const isSelected = selectedOrder.id === order.id

                      return (
                        <a
                          key={order.id}
                          href={buildTrackOrderHref(order.id)}
                          className={`block rounded-xl border p-3 transition ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10'
                              : 'border-neutral-800  hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                Order #{order.order_no || order.id.slice(0, 8)}
                              </p>
                              <p className="mt-1 truncate text-xs text-neutral-400">
                                {restaurant?.name || 'ไม่พบชื่อร้าน'}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${getOrderStatusStyle(order.status)}`}
                            >
                              {getOrderStatusLabel(order.status)}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-400">
                              รับ {formatPickupTime(order.pickup_time)}
                            </span>
                            <span className="font-black text-neutral-200">
                              ฿
                              {Number(order.total_price).toLocaleString(
                                'th-TH',
                              )}
                            </span>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {historyOrders.length > 0 && (
                <div
                  className={
                    activeOrders.length > 0
                      ? 'mt-5 border-t border-neutral-800 pt-4'
                      : 'mt-4'
                  }
                >
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    ประวัติออเดอร์
                  </p>
                  <div className="space-y-2">
                    {historyOrders.map((order) => {
                      const restaurant = restaurantsById.get(
                        order.restaurant_id,
                      )
                      const isSelected = selectedOrder.id === order.id

                      return (
                        <a
                          key={order.id}
                          href={buildTrackOrderHref(order.id)}
                          className={`block rounded-xl border p-3 transition ${
                            isSelected
                              ? 'border-neutral-500 '
                              : 'border-neutral-800  hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                Order #{order.order_no || order.id.slice(0, 8)}
                              </p>
                              <p className="mt-1 truncate text-xs text-neutral-500">
                                {restaurant?.name || 'ไม่พบชื่อร้าน'}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${getOrderStatusStyle(order.status)}`}
                            >
                              {getOrderStatusLabel(order.status)}
                            </span>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </aside>

            <article
              className={`rounded-2xl border p-4 shadow-2xl sm:p-5 ${
                isActiveOrderStatus(selectedOrder.status)
                  ? 'border-amber-500/60  shadow-amber-500/10'
                  : 'border-neutral-800 '
              }`}
            >
              {(() => {
                const order = selectedOrder
                const orderItemsForOrder = itemsByOrder.get(order.id) || []
                const restaurant = restaurantsById.get(order.restaurant_id)

                return (
                  <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black text-white">
                            Order #{order.order_no || order.id.slice(0, 8)}
                          </h2>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${getOrderStatusStyle(order.status)}`}
                          >
                            {getOrderStatusLabel(order.status)}
                          </span>
                          {isActiveOrderStatus(order.status) && (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-400">
                              กำลังสั่งอยู่
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-neutral-400">
                          ร้าน {restaurant?.name || 'ไม่พบชื่อร้าน'}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {new Date(order.created_at).toLocaleString('th-TH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>

                      <div className="rounded-xl border border-neutral-800  px-4 py-3 text-left sm:text-right">
                        <p className="text-xs text-neutral-500">ยอดรวม</p>
                        <p className="text-xl font-black text-amber-400">
                          ฿{Number(order.total_price).toLocaleString('th-TH')}
                        </p>
                      </div>
                    </div>

                    {order.status === 'cancelled' && (
                      <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">
                        <p className="text-xs font-bold uppercase tracking-wide text-red-300">
                          เหตุผลที่ร้านยกเลิกออเดอร์
                        </p>
                        <p className="mt-1 font-bold">
                          {order.cancellation_reason || 'ร้านไม่ได้ระบุเหตุผล'}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-800  p-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                          เวลารับอาหาร
                        </p>
                        <p className="mt-1 text-lg font-black text-amber-400">
                          {formatPickupTime(order.pickup_time)}
                        </p>
                      </div>
                      <div className="payment-method-card rounded-xl p-3">
                        <p className="payment-method-eyebrow text-xs font-bold uppercase tracking-wide">
                          วิธีชำระเงิน
                        </p>
                        <p className="payment-method-title mt-1 text-sm font-black">
                          {paymentMethodLabel}
                        </p>
                        <p className="payment-method-note mt-0.5 text-xs">
                          ชำระเงินตอนรับอาหาร
                        </p>
                      </div>
                      <div className="border-t border-neutral-800 pt-3 sm:col-span-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                          ช่องเพิ่มเติม
                        </p>
                        <p className="mt-1 text-neutral-300">
                          {order.pickup_note || 'ไม่มีข้อมูลเพิ่มเติม'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-white">
                          รายการอาหารที่สั่ง
                        </h3>
                        <span className="text-xs font-bold text-neutral-500">
                          {orderItemsForOrder.length} รายการ
                        </span>
                      </div>
                      {orderItemsForOrder.map((item) => {
                        const menu = item.menu_id
                          ? menusById.get(item.menu_id)
                          : null
                        const itemName =
                          item.custom_name || menu?.name || 'เมนูที่ถูกลบแล้ว'

                        return (
                          <div
                            key={item.id}
                            className="flex flex-col gap-3 rounded-xl border border-neutral-800  p-3 md:flex-row md:items-center"
                          >
                            <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg  md:h-14 md:w-14">
                              <img
                                src={menu?.image_url || '/placeholder.jpg'}
                                alt={itemName}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-sm font-bold text-white">
                                  {itemName}
                                </p>
                                {item.custom_name && (
                                  <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-300">
                                    เมนูเขียนเอง
                                  </span>
                                )}
                                {item.is_special && (
                                  <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-300">
                                    พิเศษ
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-neutral-500">
                                จำนวน {item.quantity}
                              </p>
                              {item.item_note && (
                                <p className="mt-0.5 text-xs text-neutral-500">
                                  {item.item_note}
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-black text-neutral-300 md:text-right">
                              ฿
                              {(
                                Number(item.price) * item.quantity
                              ).toLocaleString('th-TH')}
                            </p>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-4 border-t border-neutral-800 pt-4">
                      <OrderChatBox
                        orderId={order.id}
                        title={`แชทกับร้าน ${restaurant?.name || ''}`}
                      />
                    </div>
                  </>
                )
              })()}
            </article>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-800  p-10 text-center">
            <h2 className="text-xl font-black text-white">
              ไม่พบออเดอร์ที่เลือก
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              ลองเลือกออเดอร์จากรายการอีกครั้ง
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
