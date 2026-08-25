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

interface CheckoutDraft {
  restaurantId: string
  restaurantName: string
  pickupTime: string
  pickupNote: string
  itemCount: number
  totalPrice: number
  updatedAt: string
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

const readCheckoutDraft = (): CheckoutDraft | null => {
  try {
    return JSON.parse(window.localStorage.getItem(checkoutDraftStorageKey) || 'null') as CheckoutDraft | null
  } catch {
    return null
  }
}

const clearCheckoutData = () => {
  window.localStorage.removeItem(cartStorageKey)
  window.localStorage.removeItem(checkoutDraftStorageKey)
  window.dispatchEvent(new Event('food-order-cart-updated'))
}

export default function PaymentCheckout() {
  const [items, setItems] = useState<CartItem[]>([])
  const [draft, setDraft] = useState<CheckoutDraft | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'promptpay' | 'card'>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [profileRequiredMessage, setProfileRequiredMessage] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readCart())
    setDraft(readCheckoutDraft())
  }, [])

  const totals = useMemo(() => {
    return {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }
  }, [items])

  const restaurantName = draft?.restaurantName || items[0]?.restaurantName || '-'
  const pickupTime = draft?.pickupTime || '-'
  const pickupNote = draft?.pickupNote || ''
  const totalPrice = totals.totalPrice || draft?.totalPrice || 0
  const itemCount = totals.itemCount || draft?.itemCount || 0
  const canSubmit = selectedMethod === 'cash' && items.length > 0 && Boolean(draft)

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
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: draft.restaurantId,
          pickupTime: draft.pickupTime,
          pickupNote: draft.pickupNote,
          paymentMethod: 'cash',
          items: items.map((item) => ({
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
        if (result.code === 'PROFILE_PHONE_REQUIRED') {
          setProfileRequiredMessage(result.error || 'กรุณาเพิ่มเบอร์โทรศัพท์ก่อนสั่งอาหาร')
          return
        }

        throw new Error(result.error || 'ไม่สามารถสร้างคำสั่งซื้อได้')
      }

      clearCheckoutData()
      window.location.href = `/trackorderPage?order=${result.orderId}`
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสั่งอาหาร'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!draft || items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center shadow-2xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-wide text-amber-400">Payment</p>
        <h1 className="mt-2 text-2xl font-black text-white">ยังไม่มีคำสั่งซื้อที่รอชำระเงิน</h1>
        <p className="mt-2 text-sm text-neutral-400">กลับไปตะกร้าเพื่อเลือกเวลารับอาหารและยืนยันคำสั่งซื้อก่อน</p>
        <Link
          href="/cartPage"
          className="mt-6 inline-flex rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-amber-400"
        >
          กลับไปตะกร้า
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl sm:p-6">
        <p className="text-xs font-black uppercase tracking-wide text-amber-400">Payment</p>
        <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">เลือกวิธีชำระเงิน</h1>
        <p className="mt-2 text-sm font-medium text-neutral-400">เลือกช่องทางชำระเงินสำหรับคำสั่งซื้อจากร้าน {restaurantName}</p>

        {profileRequiredMessage && (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-bold text-amber-200">{profileRequiredMessage}</p>
            <Link href="/editPage" className="mt-3 inline-flex text-sm font-black text-amber-400 hover:text-amber-300">
              ไปแก้ไขโปรไฟล์
            </Link>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => setSelectedMethod('cash')}
            className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
              selectedMethod === 'cash'
                ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
            }`}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
              selectedMethod === 'cash' ? 'border-amber-400 bg-amber-400' : 'border-neutral-600'
            }`}>
              {selectedMethod === 'cash' && <span className="h-2 w-2 rounded-full bg-neutral-950" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-white">เงินสด จ่ายหน้าร้าน</span>
              <span className="mt-1 block text-sm font-medium text-neutral-400">ชำระเงินกับร้านตอนรับอาหาร</span>
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-300">
              พร้อมใช้
            </span>
          </button>

          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-left opacity-60"
          >
            <span className="h-5 w-5 shrink-0 rounded-full border border-neutral-700" />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-neutral-300">ชำระเงินพร้อมเพย์</span>
              <span className="mt-1 block text-sm font-medium text-neutral-500">ยังไม่พร้อมใช้งาน</span>
            </span>
            <span className="rounded-full border border-neutral-700 px-3 py-1 text-[11px] font-black text-neutral-500">
              เร็ว ๆ นี้
            </span>
          </button>

          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-left opacity-60"
          >
            <span className="h-5 w-5 shrink-0 rounded-full border border-neutral-700" />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-neutral-300">ดึงผ่านรหัสบัตรเครดิต/เดบิต</span>
              <span className="mt-1 block text-sm font-medium text-neutral-500">ยังไม่พร้อมใช้งาน</span>
            </span>
            <span className="rounded-full border border-neutral-700 px-3 py-1 text-[11px] font-black text-neutral-500">
              เร็ว ๆ นี้
            </span>
          </button>
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl sm:p-5">
        <h2 className="text-lg font-black text-white">สรุปคำสั่งซื้อ</h2>
        <div className="mt-4 space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex justify-between gap-4 text-sm font-bold text-neutral-400">
            <span>ร้าน</span>
            <span className="text-right text-white">{restaurantName}</span>
          </div>
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
            <span className="text-amber-400">฿{totalPrice.toLocaleString('th-TH')}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={submitCashPayment}
          className="mt-5 w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {submitting ? 'กำลังยืนยันคำสั่งซื้อ...' : 'ยืนยันและจ่ายหน้าร้าน'}
        </button>

        <Link
          href="/cartPage"
          className="mt-3 flex w-full justify-center rounded-xl border border-neutral-800 px-5 py-3 text-sm font-bold text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
        >
          กลับไปแก้ไขตะกร้า
        </Link>
      </aside>
    </div>
  )
}
