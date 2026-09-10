'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getOrderStatusDetail,
  getOrderStatusLabel,
  normalizeOrderStatus,
} from '@/lib/order-status'

interface OrderStatusSnapshot {
  id: string
  order_no: number | null
  restaurant_id: string
  restaurant_name: string | null
  total_price: number | string
  status: string | null
  pickup_time: string | null
  cancellation_reason: string | null
}

interface StatusAlert {
  orderId: string
  orderNo: number | null
  restaurantName: string | null
  status: string
  totalPrice: number
  pickupTime: string | null
  cancellationReason: string | null
}

const statusStorageKey = 'food-order-customer-order-statuses'

const readStoredStatuses = () => {
  try {
    return JSON.parse(
      window.localStorage.getItem(statusStorageKey) || '{}',
    ) as Record<string, string>
  } catch {
    return {}
  }
}

const writeStoredStatuses = (statuses: Record<string, string>) => {
  window.localStorage.setItem(statusStorageKey, JSON.stringify(statuses))
}

export default function CustomerOrderStatusAlerts() {
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const storedStatuses = useRef<Record<string, string>>({})
  const [statusAlert, setStatusAlert] = useState<StatusAlert | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  )

  useEffect(() => {
    let isMounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const showStatusAlert = (order: OrderStatusSnapshot) => {
      const status = normalizeOrderStatus(order.status)

      setIsClosing(false)
      setStatusAlert({
        orderId: order.id,
        orderNo: order.order_no,
        restaurantName: order.restaurant_name,
        status,
        totalPrice: Number(order.total_price || 0),
        pickupTime: order.pickup_time ? order.pickup_time.slice(0, 5) : null,
        cancellationReason: order.cancellation_reason,
      })
    }

    const mergeOrderStatuses = (orders: OrderStatusSnapshot[]) => {
      const nextStatuses = { ...storedStatuses.current }
      let alertOrder: OrderStatusSnapshot | null = null

      orders.forEach((order) => {
        const nextStatus = normalizeOrderStatus(order.status)
        const previousStatus = storedStatuses.current[order.id]

        if (previousStatus && previousStatus !== nextStatus) {
          alertOrder = order
        }

        nextStatuses[order.id] = nextStatus
      })

      storedStatuses.current = nextStatuses
      writeStoredStatuses(nextStatuses)

      if (alertOrder) {
        showStatusAlert(alertOrder)
      }
    }

    const fetchOrderStatuses = async () => {
      if (document.visibilityState === 'hidden') return

      try {
        const res = await fetch('/api/orders/status-updates')
        const result = await res.json()

        if (!isMounted || !res.ok) return

        mergeOrderStatuses((result.orders || []) as OrderStatusSnapshot[])
      } catch {
        return
      }
    }

    const start = async () => {
      storedStatuses.current = readStoredStatuses()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted || !user) return

      await fetchOrderStatuses()

      pollTimer.current = setInterval(() => {
        void fetchOrderStatuses()
      }, 3000)

      channel = supabase
        .channel(`customer-order-status-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchOrderStatuses()
          },
        )
        .subscribe()
    }

    void start()

    return () => {
      isMounted = false
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
      }
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  if (!statusAlert) return null

  const closeAlert = () => {
    setIsClosing(true)
    window.setTimeout(() => {
      setStatusAlert(null)
      setIsClosing(false)
    }, 180)
  }

  return (
    <div
      className={`fixed inset-0 z-[998] flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-4 text-white backdrop-blur-sm sm:px-4 ${isClosing ? 'food-alert-overlay--exit' : 'food-alert-overlay'}`}
    >
      <div
        className={`w-full max-w-3xl rounded-2xl border border-neutral-800  p-4 text-center shadow-2xl shadow-black/60 sm:p-8 ${isClosing ? 'food-alert-panel--exit' : 'food-alert-panel'}`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-3xl font-black text-amber-400">
          !
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-wide text-orange-400">
          สถานะออเดอร์อัปเดต
        </p>
        <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
          {getOrderStatusLabel(statusAlert.status) || 'ออเดอร์อัปเดตแล้ว'}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-neutral-300 sm:text-base">
          Order #{statusAlert.orderNo || statusAlert.orderId.slice(0, 8)}
          {statusAlert.restaurantName
            ? ` จากร้าน ${statusAlert.restaurantName}`
            : ''}{' '}
          {getOrderStatusDetail(statusAlert.status) || 'มีการเปลี่ยนแปลงสถานะ'}
        </p>
        {statusAlert.status === 'cancelled' &&
          statusAlert.cancellationReason && (
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-left text-sm font-bold leading-6 text-red-100">
              <p className="text-xs font-black uppercase tracking-wide text-red-300">
                เหตุผลที่ร้านยกเลิก
              </p>
              <p className="mt-1">{statusAlert.cancellationReason}</p>
            </div>
          )}

        <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-neutral-800  p-4 text-left text-sm font-bold leading-7 text-neutral-300">
          <p>
            <span className="mr-2 text-amber-400">•</span>สถานะล่าสุด:{' '}
            <span className="text-white">
              {getOrderStatusLabel(statusAlert.status) || 'ออเดอร์อัปเดตแล้ว'}
            </span>
          </p>
          <p>
            <span className="mr-2 text-amber-400">•</span>ยอดรวม:{' '}
            <span className="text-amber-400">
              ฿{statusAlert.totalPrice.toLocaleString('th-TH')}
            </span>
          </p>
          {statusAlert.pickupTime && (
            <p>
              <span className="mr-2 text-amber-400">•</span>เวลารับอาหาร:{' '}
              <span className="text-white">{statusAlert.pickupTime}</span>
            </p>
          )}
          {statusAlert.status === 'cancelled' && (
            <p>
              <span className="mr-2 text-red-400">•</span>เหตุผล:{' '}
              <span className="text-white">
                {statusAlert.cancellationReason || 'ร้านไม่ได้ระบุเหตุผล'}
              </span>
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <a
            href={`/orders?order=${statusAlert.orderId}`}
            className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-black shadow-lg shadow-orange-500/10 transition hover:bg-orange-400"
          >
            ดูออเดอร์
          </a>
          <button
            type="button"
            onClick={closeAlert}
            className="rounded-xl border border-neutral-700  px-5 py-3 text-sm font-bold text-neutral-300 transition  hover:text-white"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
