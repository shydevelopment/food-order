'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultNotificationPreferences, normalizeNotificationPreferences, type NotificationPreferences } from '@/lib/notification-preferences'

interface OrderRealtimeRow {
  id: string
  order_no: number | null
  restaurant_id: string
  total_price: number | string
  created_at?: string
}

interface ProfileRow {
  role: string | null
  email: string | null
  notification_preferences: unknown
}

interface OrderAlert {
  type: 'new-order' | 'pickup-reminder'
  orderId: string
  orderNo: number | null
  totalPrice: number
  pickupTime?: string
  minutesUntilPickup?: number
}

interface NotificationSoundRow {
  id: string
  notification_type: string
  name: string
  sound_url: string | null
  duration_seconds: number | string | null
}

type RealtimeStatus = 'connecting' | 'connected' | 'error'
type PushPermission = NotificationPermission | 'unsupported'

export default function AdminOrdersRealtime() {
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reminderTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const newOrderPollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const allowedRestaurantIds = useRef<Set<string> | null | undefined>(undefined)
  const notificationPreferences = useRef<NotificationPreferences>(defaultNotificationPreferences)
  const orderStatusSystemSoundUrl = useRef<string | null>(null)
  const shownPickupReminderKeys = useRef<Set<string>>(new Set())
  const shownNewOrderIds = useRef<Set<string>>(new Set())
  const lastNewOrderCheckedAt = useRef<string>(new Date().toISOString())
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [orderAlert, setOrderAlert] = useState<OrderAlert | null>(null)
  const [isOrderAlertClosing, setIsOrderAlertClosing] = useState(false)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
  const [pushPermission, setPushPermission] = useState<PushPermission>(() => (
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  ))
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  useEffect(() => {
    const loadNotificationScope = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        allowedRestaurantIds.current = new Set()
        return false
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email, notification_preferences')
        .eq('id', user.id)
        .single<ProfileRow>()

      const normalizedPreferences = normalizeNotificationPreferences(profile?.notification_preferences)

      const { data: systemSound } = await supabase
        .from('notification_sounds')
        .select('sound_url')
        .eq('is_system', true)
        .eq('notification_type', 'order_status')
        .maybeSingle<Pick<NotificationSoundRow, 'sound_url'>>()

      orderStatusSystemSoundUrl.current = systemSound?.sound_url || null

      const customSoundIds = normalizedPreferences.custom
        .map((sound) => sound.sound_id || sound.id)
        .filter(Boolean)

      if (customSoundIds.length > 0) {
        const { data: customSoundRows } = await supabase
          .from('notification_sounds')
          .select('id, notification_type, name, sound_url, duration_seconds')
          .in('id', customSoundIds)
          .eq('notification_type', 'custom')

        const customSoundsById = new Map((customSoundRows || []).map((sound) => [sound.id, sound]))
        normalizedPreferences.custom = normalizedPreferences.custom
          .map((sound) => {
            const soundRecord = customSoundsById.get(sound.sound_id || sound.id)

            if (!soundRecord?.sound_url) {
              return sound
            }

            return {
              id: soundRecord.id,
              sound_id: soundRecord.id,
              name: soundRecord.name,
              url: soundRecord.sound_url,
              duration: Number(soundRecord.duration_seconds || sound.duration),
            }
          })
          .filter((sound) => Boolean(sound.url))
      }

      notificationPreferences.current = normalizedPreferences

      if (profile?.role === 'admin') {
        allowedRestaurantIds.current = null
        return true
      }

      const restaurantMap = new Set<string>()
      const { data: accessRows } = await supabase
        .from('restaurant_members')
        .select('restaurant_id')
        .eq('user_id', user.id)

      ;(accessRows || []).forEach((row) => restaurantMap.add(row.restaurant_id))

      const ownerFilters = [`owner_id.eq.${user.id}`]
      if (profile?.email) {
        ownerFilters.push(`email.eq.${profile.email}`)
      }

      const { data: ownedRestaurants } = await supabase
        .from('restaurants')
        .select('id')
        .or(ownerFilters.join(','))

      ;(ownedRestaurants || []).forEach((restaurant) => restaurantMap.add(restaurant.id))
      allowedRestaurantIds.current = restaurantMap
      return true
    }

    const scheduleRefresh = () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }

      refreshTimer.current = setTimeout(() => {
        setLastUpdatedAt(new Date())
        router.refresh()
      }, 450)
    }

    const playFallbackSound = () => {
      const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextConstructor) return
      const audioContext = new AudioContextConstructor()
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.5)
    }

    const playOrderSound = async () => {
      const preferences = notificationPreferences.current
      if (!preferences.system.includes('order_status')) return

      const customSound = preferences.custom[0]
      const systemSoundUrl = orderStatusSystemSoundUrl.current

      try {
        if (customSound?.url) {
          const audio = new Audio(customSound.url)
          audio.volume = 0.9
          await audio.play()
        } else if (systemSoundUrl) {
          const audio = new Audio(systemSoundUrl)
          audio.volume = 0.9
          await audio.play()
        } else {
          playFallbackSound()
        }
        setSoundBlocked(false)
      } catch {
        setSoundBlocked(true)
      }
    }

    const showOrderAlert = (order: OrderRealtimeRow) => {
      const preferences = notificationPreferences.current
      if (!preferences.system.includes('order_status')) return

      setIsOrderAlertClosing(false)
      setOrderAlert({
        type: 'new-order',
        orderId: order.id,
        orderNo: order.order_no,
        totalPrice: Number(order.total_price || 0),
      })

      showBrowserPushNotification({
        type: 'new-order',
        orderId: order.id,
        orderNo: order.order_no,
        totalPrice: Number(order.total_price || 0),
      })
    }

    const showBrowserPushNotification = (alert: OrderAlert) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return

      const title = alert.type === 'pickup-reminder'
        ? 'ใกล้ถึงเวลารับอาหาร'
        : 'มีออเดอร์ใหม่เข้า'
      const body = alert.type === 'pickup-reminder'
        ? `Order #${alert.orderNo || alert.orderId.slice(0, 8)} ถึงเวลารับอาหาร ${alert.pickupTime || ''}`
        : `Order #${alert.orderNo || alert.orderId.slice(0, 8)} ยอดรวม ฿${alert.totalPrice.toLocaleString('th-TH')}`

      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `food-order-admin-${alert.type}-${alert.orderId}`,
      })

      notification.onclick = () => {
        window.focus()
        router.push('/admin/orders')
        notification.close()
      }
    }

    const handleOrderInsert = (order: OrderRealtimeRow) => {
      if (shownNewOrderIds.current.has(order.id)) {
        scheduleRefresh()
        return
      }

      const allowedIds = allowedRestaurantIds.current

      if (allowedIds === undefined) {
        scheduleRefresh()
        return
      }

      if (allowedIds && !allowedIds.has(order.restaurant_id)) {
        scheduleRefresh()
        return
      }

      shownNewOrderIds.current.add(order.id)
      showOrderAlert(order)
      void playOrderSound()
      scheduleRefresh()
    }

    const buildPickupReminderKey = (orderId: string, pickupTime: string) => {
      const todayKey = new Date().toISOString().slice(0, 10)
      return `food-order-pickup-reminder:${todayKey}:${orderId}:${pickupTime}`
    }

    const hasShownPickupReminder = (orderId: string, pickupTime: string) => {
      const key = buildPickupReminderKey(orderId, pickupTime)

      if (shownPickupReminderKeys.current.has(key)) {
        return true
      }

      if (window.localStorage.getItem(key)) {
        shownPickupReminderKeys.current.add(key)
        return true
      }

      return false
    }

    const markPickupReminderShown = (orderId: string, pickupTime: string) => {
      const key = buildPickupReminderKey(orderId, pickupTime)
      shownPickupReminderKeys.current.add(key)
      window.localStorage.setItem(key, '1')
    }

    const checkPickupReminders = async () => {
      const preferences = notificationPreferences.current
      if (!preferences.system.includes('order_status')) return

      try {
        const res = await fetch('/api/admin/orders/pickup-reminders')
        const result = await res.json()

        if (!res.ok) return

        const reminder = (result.reminders || []).find((item: {
          id: string
          pickup_time: string
        }) => !hasShownPickupReminder(item.id, item.pickup_time))

        if (!reminder) return

        markPickupReminderShown(reminder.id, reminder.pickup_time)
        setIsOrderAlertClosing(false)
        setOrderAlert({
          type: 'pickup-reminder',
          orderId: reminder.id,
          orderNo: reminder.order_no,
          totalPrice: Number(reminder.total_price || 0),
          pickupTime: reminder.pickup_time,
          minutesUntilPickup: Number(reminder.minutes_until_pickup),
        })
        showBrowserPushNotification({
          type: 'pickup-reminder',
          orderId: reminder.id,
          orderNo: reminder.order_no,
          totalPrice: Number(reminder.total_price || 0),
          pickupTime: reminder.pickup_time,
          minutesUntilPickup: Number(reminder.minutes_until_pickup),
        })
        void playOrderSound()
      } catch {
        return
      }
    }

    const pollNewOrders = async () => {
      const preferences = notificationPreferences.current
      if (!preferences.system.includes('order_status')) return

      try {
        const res = await fetch(`/api/admin/orders/recent?since=${encodeURIComponent(lastNewOrderCheckedAt.current)}`)
        const result = await res.json()

        if (!res.ok) return

        const orders = (result.orders || []) as OrderRealtimeRow[]
        orders.forEach((order) => handleOrderInsert(order))

        if (typeof result.checkedAt === 'string') {
          lastNewOrderCheckedAt.current = result.checkedAt
        } else {
          lastNewOrderCheckedAt.current = new Date().toISOString()
        }
      } catch {
        return
      }
    }

    let isMounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const startRealtime = async () => {
      setRealtimeStatus('connecting')
      const canListen = await loadNotificationScope()
      if (!isMounted || !canListen) return

      lastNewOrderCheckedAt.current = new Date(Date.now() - 5000).toISOString()
      void pollNewOrders()
      newOrderPollTimer.current = setInterval(() => {
        void pollNewOrders()
      }, 3000)

      void checkPickupReminders()
      reminderTimer.current = setInterval(() => {
        void checkPickupReminders()
      }, 60000)

      channel = supabase
        .channel(`admin-orders-realtime-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          handleOrderInsert(payload.new as OrderRealtimeRow)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, scheduleRefresh)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, scheduleRefresh)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, scheduleRefresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, scheduleRefresh)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'order_items' }, scheduleRefresh)
        .subscribe((status) => {
          if (!isMounted) return

          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setRealtimeStatus('error')
          }
        })
    }

    void startRealtime()

    return () => {
      isMounted = false
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }
      if (reminderTimer.current) {
        clearInterval(reminderTimer.current)
      }
      if (newOrderPollTimer.current) {
        clearInterval(newOrderPollTimer.current)
      }
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [router, supabase])

  const realtimeCopy = {
    connecting: 'กำลังเชื่อมต่อแจ้งเตือนสด',
    connected: lastUpdatedAt
      ? `ฟังออเดอร์ใหม่อยู่ อัปเดตล่าสุด ${lastUpdatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
      : 'ฟังออเดอร์ใหม่อยู่',
    error: 'Realtime หลุด กรุณารีเฟรชหน้านี้',
  } satisfies Record<RealtimeStatus, string>

  const realtimeClassName = realtimeStatus === 'connected'
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    : realtimeStatus === 'error'
      ? 'border-red-500/20 bg-red-500/10 text-red-400'
      : 'border-amber-500/20 bg-amber-500/10 text-amber-400'

  const closeOrderAlert = () => {
    setIsOrderAlertClosing(true)
    window.setTimeout(() => {
      setOrderAlert(null)
      setIsOrderAlertClosing(false)
    }, 180)
  }

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      setPushPermission('unsupported')
      return
    }

    const permission = await Notification.requestPermission()
    setPushPermission(permission)
  }

  return (
    <>
      <div className={`rounded-xl border px-4 py-3 text-sm ${realtimeClassName}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-bold">เรียลไทม์</span>
            <span className="ml-1 text-neutral-300">
              {realtimeCopy[realtimeStatus]}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {pushPermission === 'default' && (
              <button
                type="button"
                onClick={requestPushPermission}
                className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-black text-orange-300 transition hover:bg-orange-500/20"
              >
                เปิดแจ้งเตือนแบบพุช
              </button>
            )}
            {pushPermission === 'granted' && (
              <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-300">
                Push เปิดแล้ว
              </span>
            )}
            {pushPermission === 'denied' && (
              <span className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-300">
                Push ถูกบล็อกในเบราว์เซอร์
              </span>
            )}
          </div>
        </div>
      </div>

      {orderAlert && (
        <div className={`fixed inset-0 z-[998] flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-4 text-white backdrop-blur-sm sm:px-4 ${isOrderAlertClosing ? 'food-alert-overlay--exit' : 'food-alert-overlay'}`}>
          <div className={`relative w-full max-w-3xl rounded-2xl border border-neutral-800  p-4 text-center shadow-2xl shadow-black/60 sm:p-8 ${isOrderAlertClosing ? 'food-alert-panel--exit' : 'food-alert-panel'}`}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-3xl font-black text-amber-400">
              !
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-wide text-orange-400">
              {orderAlert.type === 'pickup-reminder' ? 'แจ้งเตือนเวลารับอาหาร' : 'ออเดอร์ใหม่'}
            </p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              {orderAlert.type === 'pickup-reminder' ? 'ใกล้ถึงเวลารับอาหาร' : 'มีออเดอร์ใหม่เข้า'}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-neutral-300 sm:text-base">
              Order #{orderAlert.orderNo || orderAlert.orderId.slice(0, 8)} ยอดรวม ฿{orderAlert.totalPrice.toLocaleString('th-TH')}
            </p>

            <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-neutral-800  p-4 text-left text-sm font-bold leading-7 text-neutral-300">
              <p><span className="mr-2 text-amber-400">•</span>สถานะ: <span className="text-white">
                {orderAlert.type === 'pickup-reminder' ? 'ลูกค้าใกล้มารับอาหารที่ร้าน' : 'รอร้านรับออเดอร์'}
              </span></p>
              <p><span className="mr-2 text-amber-400">•</span>ยอดรวม: <span className="text-amber-400">฿{orderAlert.totalPrice.toLocaleString('th-TH')}</span></p>
              {orderAlert.type === 'pickup-reminder' && (
                <p>
                  <span className="mr-2 text-amber-400">•</span>
                  เวลารับอาหาร: <span className="text-white">{orderAlert.pickupTime}</span>
                  {typeof orderAlert.minutesUntilPickup === 'number' && (
                    <span className="text-neutral-400">
                      {orderAlert.minutesUntilPickup >= 0
                        ? ` อีกประมาณ ${orderAlert.minutesUntilPickup} นาที`
                        : ' ถึงเวลาแล้ว'}
                    </span>
                  )}
                </p>
              )}
              {soundBlocked && (
                <p><span className="mr-2 text-amber-400">•</span>เบราว์เซอร์บล็อกเสียงไว้ คลิกในหน้าเว็บหนึ่งครั้งเพื่อเปิดเสียง</p>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <a
                href="/admin/orders"
                className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-black shadow-lg shadow-orange-500/10 transition hover:bg-orange-400"
              >
                ดูออเดอร์
              </a>
              <button
                type="button"
                onClick={closeOrderAlert}
                className="rounded-xl border border-neutral-700  px-5 py-3 text-sm font-bold text-neutral-300 transition  hover:text-white"
              >
                ปิด
              </button>
            </div>
            <button
              type="button"
              onClick={closeOrderAlert}
              aria-label="ปิดแจ้งเตือน"
              className="absolute right-4 top-4 rounded-xl px-3 py-2 text-sm font-black text-neutral-500 transition  hover:text-white"
            >
              x
            </button>
          </div>
        </div>
      )}
    </>
  )
}
