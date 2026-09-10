'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

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

interface CartRestaurantGroup {
  restaurantId: string
  restaurantName: string
  items: CartItem[]
  itemCount: number
  totalPrice: number
}

interface CheckoutDraftRestaurant {
  restaurantId: string
  restaurantName: string
  itemCount: number
  totalPrice: number
}

interface CheckoutDraft {
  restaurantId: string
  restaurantName: string
  restaurants?: CheckoutDraftRestaurant[]
  pickupTime: string
  pickupNote: string
  itemCount: number
  totalPrice: number
  updatedAt: string
}

const cartStorageKey = 'food-order-cart'
const checkoutDraftStorageKey = 'food-order-checkout-draft'

// Temporary switch: keep the QR checkout implementation in place while the
// payment option is unavailable to customers. Set this back to true to reopen it.
const qrPaymentsEnabled = false

const readCart = (): CartItem[] => {
  try {
    return JSON.parse(
      window.localStorage.getItem(cartStorageKey) || '[]',
    ) as CartItem[]
  } catch {
    return []
  }
}

const readCheckoutDraft = (): CheckoutDraft | null => {
  try {
    return JSON.parse(
      window.localStorage.getItem(checkoutDraftStorageKey) || 'null',
    ) as CheckoutDraft | null
  } catch {
    return null
  }
}

const clearCheckoutData = () => {
  window.localStorage.removeItem(cartStorageKey)
  window.localStorage.removeItem(checkoutDraftStorageKey)
  window.dispatchEvent(new Event('food-order-cart-updated'))
}

const writeCart = (cartItems: CartItem[]) => {
  window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems))
  window.dispatchEvent(new Event('food-order-cart-updated'))
}

const groupCartItemsByRestaurant = (cartItems: CartItem[]) => {
  const groupMap = new Map<string, CartRestaurantGroup>()

  cartItems.forEach((item) => {
    const group = groupMap.get(item.restaurantId) || {
      restaurantId: item.restaurantId,
      restaurantName: item.restaurantName,
      items: [],
      itemCount: 0,
      totalPrice: 0,
    }

    group.items.push(item)
    group.itemCount += item.quantity
    group.totalPrice += item.price * item.quantity
    groupMap.set(item.restaurantId, group)
  })

  return Array.from(groupMap.values())
}

export default function PaymentCheckout({ userId }: { userId: string }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [draft, setDraft] = useState<CheckoutDraft | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<
    'cash' | 'promptpay' | 'card'
  >('cash')
  const [submitting, setSubmitting] = useState(false)
  const [showCashConfirmation, setShowCashConfirmation] = useState(false)
  const [profileRequiredMessage, setProfileRequiredMessage] = useState<
    string | null
  >(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readCart())
    setDraft(readCheckoutDraft())
  }, [])

  const totals = useMemo(() => {
    return {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      ),
    }
  }, [items])

  const groupedCart = useMemo(() => groupCartItemsByRestaurant(items), [items])
  const restaurantName =
    groupedCart.length > 1
      ? `${groupedCart.length} ร้าน`
      : draft?.restaurantName || items[0]?.restaurantName || '-'
  const pickupTime = draft?.pickupTime || '-'
  const pickupNote = draft?.pickupNote || ''
  const totalPrice = totals.totalPrice || draft?.totalPrice || 0
  const itemCount = totals.itemCount || draft?.itemCount || 0
  const orderCount = groupedCart.length || draft?.restaurants?.length || 0
  const canSubmit =
    (selectedMethod === 'cash' || (qrPaymentsEnabled && selectedMethod === 'promptpay' && items.every(item => Boolean(item.menuId))))
    && items.length > 0
    && groupedCart.length > 0
    && Boolean(draft)

  const submitQrPayment = async () => {
    if (!draft || !canSubmit || submitting) return
    setSubmitting(true)
    setProfileRequiredMessage(null)
    const orderIds: string[] = []
    const successful = new Set<string>()
    try {
      for (const group of groupedCart) {
        const payload = {
          restaurantId: group.restaurantId, pickupTime: draft.pickupTime, pickupNote: draft.pickupNote,
          paymentMethod: 'qr', items: group.items.map(item => ({
            menuId: item.menuId, quantity: item.quantity, customName: item.customName,
            isSpecial: Boolean(item.isSpecial), itemNote: item.itemNote,
          })),
        }
        const fingerprint = JSON.stringify({ payload, draftDate: draft.updatedAt })
        const storageKey = `food-order-qr-checkout:${userId}:${group.restaurantId}`
        let attempt: { fingerprint: string; key: string } | null = null
        try { attempt = JSON.parse(window.localStorage.getItem(storageKey) || 'null') } catch { /* Start a new checkout. */ }
        if (attempt?.fingerprint !== fingerprint) {
          attempt = { fingerprint, key: crypto.randomUUID() }
          window.localStorage.setItem(storageKey, JSON.stringify(attempt))
        }
        const response = await fetch('/api/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, checkoutKey: attempt.key }),
        })
        const result = await response.json()
        if (!response.ok) {
          if (result.code === 'PROFILE_PHONE_REQUIRED') setProfileRequiredMessage(result.error)
          throw new Error(result.error || 'ไม่สามารถสร้างออเดอร์ QR ได้')
        }
        orderIds.push(result.orderId)
        successful.add(group.restaurantId)
        // Keep failed restaurants in the cart; successful orders can be resumed from /orders.
        const remaining = items.filter(item => !successful.has(item.restaurantId))
        writeCart(remaining)
        setItems(remaining)
      }
      clearCheckoutData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
    } finally {
      setSubmitting(false)
      if (orderIds.length) window.location.href = `/payment?orders=${orderIds.join(',')}`
    }
  }

  const submitCashPayment = async () => {
    if (!draft || items.length === 0) {
      alert('ไม่พบข้อมูลคำสั่งซื้อ กรุณากลับไปตะกร้า')
      return
    }

    if (selectedMethod !== 'cash') {
      alert('วิธีชำระเงินนี้ยังไม่พร้อมใช้งาน')
      return
    }

    setSubmitting(true)
    setProfileRequiredMessage(null)

    try {
      const createdOrderIds: string[] = []
      const successfulRestaurantIds = new Set<string>()

      for (const group of groupedCart) {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: group.restaurantId,
            pickupTime: draft.pickupTime,
            pickupNote: draft.pickupNote,
            paymentMethod: 'cash',
            items: group.items.map((item) => ({
              menuId: item.menuId,
              quantity: item.quantity,
              customName: item.customName,
              isSpecial: Boolean(item.isSpecial),
              itemNote: item.itemNote,
            })),
          }),
        })

        const result = await res.json()

        if (!res.ok) {
          if (
            createdOrderIds.length === 0
            && result.code === 'PROFILE_PHONE_REQUIRED'
          ) {
            setProfileRequiredMessage(
              result.error || 'กรุณาเพิ่มเบอร์โทรศัพท์ก่อนสั่งอาหาร',
            )
            return
          }

          if (createdOrderIds.length > 0) {
            const remainingItems = items.filter(
              (item) => !successfulRestaurantIds.has(item.restaurantId),
            )
            const remainingGroups = groupCartItemsByRestaurant(remainingItems)
            const nextDraft = {
              ...draft,
              restaurantId: remainingGroups[0]?.restaurantId || '',
              restaurantName:
                remainingGroups.length === 1
                  ? remainingGroups[0].restaurantName
                  : `${remainingGroups.length} ร้าน`,
              restaurants: remainingGroups.map((remainingGroup) => ({
                restaurantId: remainingGroup.restaurantId,
                restaurantName: remainingGroup.restaurantName,
                itemCount: remainingGroup.itemCount,
                totalPrice: remainingGroup.totalPrice,
              })),
              itemCount: remainingItems.reduce(
                (sum, item) => sum + item.quantity,
                0,
              ),
              totalPrice: remainingItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0,
              ),
              updatedAt: new Date().toISOString(),
            }

            writeCart(remainingItems)
            window.localStorage.setItem(
              checkoutDraftStorageKey,
              JSON.stringify(nextDraft),
            )
            setItems(remainingItems)
            setDraft(nextDraft)

            throw new Error(
              `สร้างออเดอร์สำเร็จแล้ว ${createdOrderIds.length} ร้าน แต่ร้าน ${group.restaurantName} มีปัญหา: ${result.error || 'ไม่สามารถสร้างคำสั่งซื้อได้'}`,
            )
          }

          throw new Error(result.error || 'ไม่สามารถสร้างคำสั่งซื้อได้')
        }

        successfulRestaurantIds.add(group.restaurantId)
        createdOrderIds.push(result.orderId)
      }

      clearCheckoutData()
      window.location.href =
        createdOrderIds.length === 1
          ? `/orders?order=${createdOrderIds[0]}`
          : '/orders'
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสั่งอาหาร'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!draft || items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-800 p-6 text-center shadow-2xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-wide text-amber-400">
          Payment
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">
          ยังไม่มีคำสั่งซื้อที่รอชำระเงิน
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          กลับไปตะกร้าเพื่อเลือกเวลารับอาหารและยืนยันคำสั่งซื้อก่อน
        </p>
        <Link
          href="/cart"
          className="mt-6 inline-flex rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-amber-400"
        >
          กลับไปตะกร้า
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-neutral-800  p-4 shadow-2xl sm:p-6">
        <p className="text-xs font-black uppercase tracking-wide text-amber-400">
          Payment
        </p>
        <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
          เลือกวิธีชำระเงิน
        </h1>
        <p className="mt-2 text-sm font-medium text-neutral-400">
          {orderCount > 1
            ? `เลือกช่องทางชำระเงินสำหรับ ${orderCount} ออเดอร์จาก ${restaurantName}`
            : `เลือกช่องทางชำระเงินสำหรับคำสั่งซื้อจากร้าน ${restaurantName}`}
        </p>

        {profileRequiredMessage && (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-bold text-amber-200">
              {profileRequiredMessage}
            </p>
            <Link
              href="/profile/edit"
              className="mt-3 inline-flex text-sm font-black text-amber-400 hover:text-amber-300"
            >
              ไปแก้ไขโปรไฟล์
            </Link>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => setSelectedMethod('cash')}
            className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
              selectedMethod === 'cash'
                ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                : 'border-neutral-800  hover:border-neutral-700'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                selectedMethod === 'cash'
                  ? 'border-amber-400 bg-amber-400'
                  : 'border-neutral-600'
              }`}
            >
              {selectedMethod === 'cash' && (
                <span className="h-2 w-2 rounded-full " />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-white">
                เงินสด จ่ายหน้าร้าน
              </span>
              <span className="mt-1 block text-sm font-medium text-neutral-400">
                ยืนยันออเดอร์ก่อน แล้วชำระเงินกับร้านตอนรับอาหาร
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={submitting || !qrPaymentsEnabled || items.some(item => !item.menuId)}
            onClick={() => setSelectedMethod('promptpay')}
            aria-pressed={selectedMethod === 'promptpay'}
            className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition disabled:opacity-50 ${selectedMethod === 'promptpay' ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 hover:border-neutral-700'}`}
          >
            <span className={`h-5 w-5 shrink-0 rounded-full border ${selectedMethod === 'promptpay' ? 'border-amber-400 bg-amber-400' : 'border-neutral-700'}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-neutral-300">
                ชำระเงินพร้อมเพย์
              </span>
              <span className="mt-1 block text-sm font-medium text-neutral-500">
                {!qrPaymentsEnabled
                  ? 'ปิดใช้งานชั่วคราว กรุณาเลือกชำระเงินสด'
                  : items.some(item => !item.menuId)
                    ? 'เมนูเขียนเองยังไม่ทราบราคา กรุณาเลือกเงินสด'
                    : 'สแกน QR ผ่านแอปธนาคาร · แยก QR ตามร้าน'}
              </span>
            </span>
            <span className="rounded-full border border-neutral-700 px-3 py-1 text-[11px] font-black text-neutral-500">
              {qrPaymentsEnabled ? 'QR' : 'ปิดชั่วคราว'}
            </span>
          </button>

          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-4 rounded-2xl border border-neutral-800  p-4 text-left opacity-60"
          >
            <span className="h-5 w-5 shrink-0 rounded-full border border-neutral-700" />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-neutral-300">
                ดึงผ่านรหัสบัตรเครดิต/เดบิต
              </span>
              <span className="mt-1 block text-sm font-medium text-neutral-500">
                ยังไม่พร้อมใช้งาน
              </span>
            </span>
            <span className="rounded-full border border-neutral-700 px-3 py-1 text-[11px] font-black text-neutral-500">
              เร็ว ๆ นี้
            </span>
          </button>
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-neutral-800  p-4 shadow-2xl sm:p-5">
        <h2 className="text-lg font-black text-white">สรุปคำสั่งซื้อ</h2>
        <div className="mt-4 space-y-3 rounded-2xl border border-neutral-800  p-4">
          <div className="flex justify-between gap-4 text-sm font-bold text-neutral-400">
            <span>{orderCount > 1 ? 'จำนวนออเดอร์' : 'ร้าน'}</span>
            <span className="text-right text-white">{restaurantName}</span>
          </div>
          {groupedCart.length > 1 && (
            <div className="space-y-2 border-t border-neutral-800 pt-3">
              {groupedCart.map((group) => (
                <div
                  key={group.restaurantId}
                  className="flex justify-between gap-4 text-xs font-bold text-neutral-400"
                >
                  <span className="min-w-0 truncate">
                    {group.restaurantName}
                  </span>
                  <span className="shrink-0 text-amber-400">
                    {group.itemCount} ชิ้น · ฿
                    {group.totalPrice.toLocaleString('th-TH')}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between gap-4 text-sm font-bold text-neutral-400">
            <span>จำนวนรายการ</span>
            <span className="text-white">{itemCount} ชิ้น</span>
          </div>
          <div className="flex justify-between gap-4 text-sm font-bold text-neutral-400">
            <span>เวลารับอาหาร</span>
            <span className="text-amber-400">{pickupTime}</span>
          </div>
          {pickupNote && (
            <div className="border-t border-neutral-800 pt-3 text-sm">
              <p className="font-bold text-neutral-400">ช่องเพิ่มเติม</p>
              <p className="mt-1 leading-6 text-white">{pickupNote}</p>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-800 pt-3 text-base font-black text-white">
            <span>รวมทั้งหมด</span>
            <span className="text-amber-400">
              ฿{totalPrice.toLocaleString('th-TH')}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={selectedMethod === 'promptpay' ? submitQrPayment : () => setShowCashConfirmation(true)}
          className="mt-5 w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-amber-400  disabled:text-neutral-500"
        >
          {submitting
            ? 'กำลังยืนยันคำสั่งซื้อ...'
            : selectedMethod === 'promptpay'
              ? 'ยืนยันและสร้าง QR ชำระเงิน'
            : orderCount > 1
              ? `ยืนยัน ${orderCount} ออเดอร์และจ่ายหน้าร้าน`
              : 'ยืนยันการสั่งซื้อ'}
        </button>

        <Link
          href="/cart"
          className="mt-3 flex w-full justify-center rounded-xl border border-neutral-800 px-5 py-3 text-sm font-bold text-neutral-400 transition  hover:text-white"
        >
          กลับไปแก้ไขตะกร้า
        </Link>
      </aside>
      {showCashConfirmation && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 px-4 py-6 text-white backdrop-blur-sm food-alert-overlay">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 p-5 shadow-2xl shadow-black/60 food-alert-panel">
            <p className="text-xs font-black uppercase tracking-wide text-amber-400">ยืนยันออเดอร์เงินสด</p>
            <h2 className="mt-2 text-xl font-black">ยืนยันสั่งอาหารใช่ไหม?</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              ร้านจะได้รับแจ้งเตือนว่าออเดอร์นี้ชำระเงินสด และต้องกดรับออเดอร์ก่อนจึงจะเริ่มเตรียมอาหาร
            </p>
            <p className="mt-4 rounded-xl border border-neutral-800 px-4 py-3 text-sm font-black text-amber-300">
              ยอดชำระ ฿{totalPrice.toLocaleString('th-TH')}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                disabled={submitting}
                onClick={() => { setShowCashConfirmation(false); void submitCashPayment() }}
                className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                ยืนยันสั่งอาหาร
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowCashConfirmation(false)}
                className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:text-white disabled:opacity-50"
              >
                กลับ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
