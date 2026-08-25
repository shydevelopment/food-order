'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { UIEvent } from 'react'

interface CartItem {
  menuId: string
  cartItemId?: string
  restaurantId: string
  restaurantName: string
  name: string
  price: number
  imageUrl: string | null
  quantity: number
  isSpecial?: boolean
  customName?: string
  itemNote?: string
}

const cartStorageKey = 'food-order-cart'
const checkoutDraftStorageKey = 'food-order-checkout-draft'

const readCart = (): CartItem[] => {
  try {
    return JSON.parse(window.localStorage.getItem(cartStorageKey) || '[]') as CartItem[]
  } catch {
    return []
  }
}

const writeCart = (items: CartItem[]) => {
  window.localStorage.setItem(cartStorageKey, JSON.stringify(items))
  window.dispatchEvent(new Event('food-order-cart-updated'))
}

const suggestedPickupTimes = [
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
]
const suggestedPickupMinutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))
const wheelItemStep = 56

const formatTypedPickupTime = (value: string) => {
  const cleanedValue = value.replace(/[^\d:]/g, '').slice(0, 5)

  if (cleanedValue.includes(':')) {
    return cleanedValue
  }

  if (cleanedValue.length > 2) {
    return `${cleanedValue.slice(0, 2)}:${cleanedValue.slice(2)}`
  }

  return cleanedValue
}

const normalizePickupTime = (value: string) => {
  const trimmedValue = value.trim()
  const compactMatch = trimmedValue.match(/^(\d{1,2}):?(\d{2})$/)

  if (!compactMatch) return trimmedValue

  const hour = Number(compactMatch[1])
  const minute = Number(compactMatch[2])

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return trimmedValue
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export default function CartCheckout() {
  const [items, setItems] = useState<CartItem[]>([])
  const hourWheelRef = useRef<HTMLDivElement | null>(null)
  const minuteWheelRef = useRef<HTMLDivElement | null>(null)
  const [pickupTime, setPickupTime] = useState('')
  const [showPickupTimePicker, setShowPickupTimePicker] = useState(false)
  const [pickupNote, setPickupNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [profileRequiredMessage, setProfileRequiredMessage] = useState<string | null>(null)
  const [profileRequiredClosing, setProfileRequiredClosing] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readCart())
  }, [])

  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [items])

  const restaurantName = items[0]?.restaurantName
  const normalizedWheelTime = /^\d{2}:\d{2}$/.test(normalizePickupTime(pickupTime))
    ? normalizePickupTime(pickupTime)
    : '08:00'
  const [selectedHour, selectedMinute] = normalizedWheelTime.split(':')

  const selectPickupHour = (hour: string) => {
    setPickupTime(`${hour}:${selectedMinute || '00'}`)
    const index = suggestedPickupTimes.indexOf(hour)
    if (index >= 0) {
      hourWheelRef.current?.scrollTo({ top: index * wheelItemStep, behavior: 'smooth' })
    }
  }

  const selectPickupMinute = (minute: string) => {
    setPickupTime(`${selectedHour || '08'}:${minute}`)
    const index = suggestedPickupMinutes.indexOf(minute)
    if (index >= 0) {
      minuteWheelRef.current?.scrollTo({ top: index * wheelItemStep, behavior: 'smooth' })
    }
  }

  const handleWheelScroll = (type: 'hour' | 'minute', event: UIEvent<HTMLDivElement>) => {
    const values = type === 'hour' ? suggestedPickupTimes : suggestedPickupMinutes
    const index = Math.min(
      values.length - 1,
      Math.max(0, Math.round(event.currentTarget.scrollTop / wheelItemStep)),
    )
    const value = values[index]

    if (type === 'hour') {
      setPickupTime(`${value}:${selectedMinute || '00'}`)
      return
    }

    setPickupTime(`${selectedHour || '08'}:${value}`)
  }

  useEffect(() => {
    if (!showPickupTimePicker) return

    const hourIndex = suggestedPickupTimes.indexOf(selectedHour || '08')
    const minuteIndex = suggestedPickupMinutes.indexOf(selectedMinute || '00')

    window.requestAnimationFrame(() => {
      if (hourIndex >= 0) {
        hourWheelRef.current?.scrollTo({ top: hourIndex * wheelItemStep })
      }
      if (minuteIndex >= 0) {
        minuteWheelRef.current?.scrollTo({ top: minuteIndex * wheelItemStep })
      }
    })
  }, [selectedHour, selectedMinute, showPickupTimePicker])

  const updateQuantity = (menuId: string, quantity: number) => {
    const nextItems = items
      .map((item) => (item.cartItemId || item.menuId) === menuId ? { ...item, quantity } : item)
      .filter((item) => item.quantity > 0)

    setItems(nextItems)
    writeCart(nextItems)
  }

  const removeItem = (menuId: string) => {
    const nextItems = items.filter((item) => (item.cartItemId || item.menuId) !== menuId)
    setItems(nextItems)
    writeCart(nextItems)
  }

  const clearCart = () => {
    setItems([])
    writeCart([])
  }

  const handleCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (items.length === 0) {
      alert('ตะกร้ายังว่างอยู่')
      return
    }

    const normalizedPickupTime = normalizePickupTime(pickupTime)

    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(normalizedPickupTime)) {
      alert('กรุณาเลือกเวลาไปรับอาหาร')
      return
    }

    setSubmitting(true)
    window.localStorage.setItem(checkoutDraftStorageKey, JSON.stringify({
      restaurantId: items[0].restaurantId,
      restaurantName: items[0].restaurantName,
      pickupTime: normalizedPickupTime,
      pickupNote,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice,
      updatedAt: new Date().toISOString(),
    }))
    window.location.href = '/payment'
  }

  const closeProfileRequired = () => {
    setProfileRequiredClosing(true)
    window.setTimeout(() => {
      setProfileRequiredMessage(null)
      setProfileRequiredClosing(false)
    }, 180)
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center sm:p-10">
        <h1 className="text-2xl font-black text-white">ตะกร้าว่าง</h1>
        <p className="mt-2 text-sm text-neutral-400">เลือกเมนูจากหน้าร้านอาหารก่อน แล้วกลับมายืนยันคำสั่งซื้อที่นี่</p>
        <Link
          href="/storePage"
          className="mt-6 inline-flex rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-amber-400"
        >
          ไปเลือกเมนู
        </Link>
      </div>
    )
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {profileRequiredMessage && (
        <div className={`fixed inset-0 z-[998] flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-4 text-white backdrop-blur-sm sm:px-4 ${profileRequiredClosing ? 'food-alert-overlay--exit' : 'food-alert-overlay'}`}>
          <div className={`relative w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center shadow-2xl shadow-black/60 sm:p-8 ${profileRequiredClosing ? 'food-alert-panel--exit' : 'food-alert-panel'}`}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-3xl font-black text-amber-400">
              !
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-wide text-orange-400">กรอกข้อมูลโปรไฟล์ก่อน</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">ยังไม่มีเบอร์โทรศัพท์</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm font-medium leading-6 text-neutral-300 sm:text-base">
              {profileRequiredMessage}
            </p>
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-left text-sm font-bold leading-7 text-neutral-300">
              <p><span className="mr-2 text-amber-400">•</span>ร้านต้องใช้เบอร์โทรสำหรับติดต่อเมื่ออาหารพร้อม</p>
              <p><span className="mr-2 text-amber-400">•</span>เพิ่มเบอร์มือถือไทยในหน้าแก้ไขโปรไฟล์ก่อนสั่งอาหาร</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <a
                href="/editPage"
                className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-black shadow-lg shadow-orange-500/10 transition hover:bg-orange-400"
              >
                ไปแก้ไขโปรไฟล์
              </a>
              <button
                type="button"
                onClick={closeProfileRequired}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Cart</p>
          <h1 className="mt-1 text-2xl font-black text-white">ตะกร้าของคุณ</h1>
          <p className="mt-1 text-sm text-neutral-400">ร้าน {restaurantName}</p>
        </div>

        <div className="divide-y divide-neutral-800">
          {items.map((item) => {
            const itemKey = item.cartItemId || item.menuId

            return (
            <div key={itemKey} className="flex flex-col gap-3 p-4 md:flex-row md:p-5">
              <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-neutral-800 sm:h-32 md:h-20 md:w-20">
                {item.customName ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 text-2xl">🍳</div>
                ) : (
                  <img
                    src={item.imageUrl || '/placeholder.jpg'}
                    alt={item.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-white">{item.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.customName && (
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-300">
                          เมนูเขียนเอง
                        </span>
                      )}
                      {item.isSpecial && (
                        <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-300">
                          พิเศษ
                        </span>
                      )}
                    </div>
                    {item.itemNote && (
                      <p className="mt-1 text-xs text-neutral-500">{item.itemNote}</p>
                    )}
                    <p className="mt-1 text-sm font-black text-amber-400">
                      {item.price > 0 ? `฿${item.price.toLocaleString('th-TH')}` : 'ร้านคิดราคา'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(itemKey)}
                    className="w-full rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20 sm:w-auto sm:py-1.5"
                  >
                    ลบ
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                    className="h-8 w-8 rounded-lg bg-neutral-800 text-sm font-black text-white transition hover:bg-neutral-700"
                  >
                    -
                  </button>
                  <span className="flex h-8 min-w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 px-3 text-sm font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                    className="h-8 w-8 rounded-lg bg-neutral-800 text-sm font-black text-white transition hover:bg-neutral-700"
                  >
                    +
                  </button>
                  <span className="ml-0 w-full text-right text-sm font-bold text-neutral-300 sm:ml-auto sm:w-auto">
                    ฿{(item.price * item.quantity).toLocaleString('th-TH')}
                  </span>
                </div>
              </div>
            </div>
          )})}
        </div>
      </section>

      <form onSubmit={handleCheckout} className="h-fit rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <h2 className="text-lg font-black text-white">ยืนยันคำสั่งซื้อ</h2>
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex justify-between text-sm text-neutral-400">
            <span>จำนวนรายการ</span>
            <span>{items.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น</span>
          </div>
          <div className="mt-3 flex justify-between border-t border-neutral-800 pt-3 text-base font-black text-white">
            <span>รวมทั้งหมด</span>
            <span className="text-amber-400">฿{totalPrice.toLocaleString('th-TH')}</span>
          </div>
        </div>
        
        <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-neutral-400">
          ไปรับกี่โมง *
        </label>
        <div className="relative mt-2">
          <div className="flex rounded-xl border border-neutral-800 bg-neutral-950 transition focus-within:border-amber-500">
            <input
              required
              value={pickupTime}
              onChange={(event) => setPickupTime(formatTypedPickupTime(event.target.value))}
              onBlur={(event) => setPickupTime(normalizePickupTime(event.target.value))}
              inputMode="numeric"
              pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
              placeholder="เช่น 11:27"
              title="กรุณากรอกเวลาเป็น HH:MM เช่น 11:27"
              className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3 py-2 text-sm font-black text-white placeholder-neutral-600 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPickupTimePicker((current) => !current)}
              className="shrink-0 rounded-r-xl border-l border-neutral-800 px-3 text-xs font-black text-amber-400 transition hover:bg-neutral-900"
            >
              เลือก
            </button>
          </div>

          {showPickupTimePicker && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-amber-500/30 bg-neutral-950 shadow-2xl shadow-black/60">
              <div className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-400">เลือกเวลาไปรับ</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">เลื่อนเลือกชั่วโมงและนาทีแบบนาฬิกา</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPickupTimePicker(false)}
                  className="rounded-lg px-2 py-1 text-xs font-black text-neutral-500 transition hover:bg-neutral-900 hover:text-white"
                >
                  ปิด
                </button>
              </div>
              <div className="relative grid grid-cols-[1fr_auto_1fr] gap-2 p-4">
                <div className="pointer-events-none absolute left-4 right-4 top-1/2 h-12 -translate-y-1/2 rounded-xl border border-amber-500/40 bg-amber-500/10" />

                <div
                  ref={hourWheelRef}
                  onScroll={(event) => handleWheelScroll('hour', event)}
                  className="scrollbar-hide relative h-48 snap-y snap-mandatory overflow-y-auto rounded-2xl border border-neutral-800 bg-black py-[72px]"
                >
                  <div className="space-y-2 px-2">
                    {suggestedPickupTimes.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => selectPickupHour(hour)}
                        className={`flex h-12 w-full snap-center items-center justify-center rounded-xl text-2xl font-black transition ${
                          selectedHour === hour
                            ? 'text-amber-300'
                            : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200'
                        }`}
                      >
                        {hour}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative z-10 flex h-48 items-center justify-center text-2xl font-black text-amber-400">
                  :
                </div>

                <div
                  ref={minuteWheelRef}
                  onScroll={(event) => handleWheelScroll('minute', event)}
                  className="scrollbar-hide relative h-48 snap-y snap-mandatory overflow-y-auto rounded-2xl border border-neutral-800 bg-black py-[72px]"
                >
                  <div className="space-y-2 px-2">
                    {suggestedPickupMinutes.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => selectPickupMinute(minute)}
                        className={`flex h-12 w-full snap-center items-center justify-center rounded-xl text-2xl font-black transition ${
                          selectedMinute === minute
                            ? 'text-amber-300'
                            : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200'
                        }`}
                      >
                        {minute}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-800 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowPickupTimePicker(false)}
                  className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-neutral-950 transition hover:bg-amber-400"
                >
                  ใช้เวลา {pickupTime || '08:00'}
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-500">พิมพ์เวลาเองได้ เช่น 11:27 หรือกดเลือกเวลายอดนิยม</p>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-neutral-400">
          ช่องเพิ่มเติม
        </label>
        <textarea
          rows={3}
          value={pickupNote}
          onChange={(event) => setPickupNote(event.target.value)}
          maxLength={200}
          placeholder="เช่น โทรเมื่ออาหารพร้อม, ไม่ใส่ผัก, ฝากไว้หน้าเคาน์เตอร์"
          className="mt-2 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-amber-500"
        />
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-neutral-500">
          <span>ไม่บังคับ ข้อความนี้จะแสดงในช่องเพิ่มเติมของออเดอร์</span>
          <span>{pickupNote.length}/200</span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {submitting ? 'กำลังไปหน้าชำระเงิน...' : 'ยืนยันสั่งอาหาร'}
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={clearCart}
          className="mt-3 w-full rounded-xl border border-neutral-800 px-5 py-3 text-sm font-bold text-neutral-400 transition hover:bg-neutral-800 hover:text-white disabled:opacity-50"
        >
          ล้างตะกร้า
        </button>
      </form>
    </div>
  )
}
