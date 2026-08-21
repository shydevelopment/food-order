'use client'

import { useEffect, useMemo, useState } from 'react'

interface CartItem {
  menuId: string
  restaurantId: string
  restaurantName: string
  name: string
  price: number
  imageUrl: string | null
  quantity: number
}

const cartStorageKey = 'food-order-cart'

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

export default function CartCheckout() {
  const [items, setItems] = useState<CartItem[]>([])
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readCart())
  }, [])

  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [items])

  const restaurantName = items[0]?.restaurantName

  const updateQuantity = (menuId: string, quantity: number) => {
    const nextItems = items
      .map((item) => item.menuId === menuId ? { ...item, quantity } : item)
      .filter((item) => item.quantity > 0)

    setItems(nextItems)
    writeCart(nextItems)
  }

  const removeItem = (menuId: string) => {
    const nextItems = items.filter((item) => item.menuId !== menuId)
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

    setSubmitting(true)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: items[0].restaurantId,
          deliveryAddress,
          items: items.map((item) => ({
            menuId: item.menuId,
            quantity: item.quantity,
          })),
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถสร้างคำสั่งซื้อได้')
      }

      clearCart()
      window.location.href = `/trackorderPage?order=${result.orderId}`
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสั่งอาหาร'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-900 p-10 text-center">
        <h1 className="text-2xl font-black text-white">ตะกร้าว่าง</h1>
        <p className="mt-2 text-sm text-neutral-400">เลือกเมนูจากหน้าร้านอาหารก่อน แล้วกลับมายืนยันคำสั่งซื้อที่นี่</p>
        <a
          href="/storePage"
          className="mt-6 inline-flex rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-amber-400"
        >
          ไปเลือกเมนู
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Cart</p>
          <h1 className="mt-1 text-2xl font-black text-white">ตะกร้าของคุณ</h1>
          <p className="mt-1 text-sm text-neutral-400">ร้าน {restaurantName}</p>
        </div>

        <div className="divide-y divide-neutral-800">
          {items.map((item) => (
            <div key={item.menuId} className="flex gap-4 p-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
                <img
                  src={item.imageUrl || '/placeholder.jpg'}
                  alt={item.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-white">{item.name}</h2>
                    <p className="mt-1 text-sm font-black text-amber-400">
                      ฿{item.price.toLocaleString('th-TH')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.menuId)}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
                  >
                    ลบ
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.menuId, item.quantity - 1)}
                    className="h-8 w-8 rounded-lg bg-neutral-800 text-sm font-black text-white transition hover:bg-neutral-700"
                  >
                    -
                  </button>
                  <span className="flex h-8 min-w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 px-3 text-sm font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.menuId, item.quantity + 1)}
                    className="h-8 w-8 rounded-lg bg-neutral-800 text-sm font-black text-white transition hover:bg-neutral-700"
                  >
                    +
                  </button>
                  <span className="ml-auto text-sm font-bold text-neutral-300">
                    ฿{(item.price * item.quantity).toLocaleString('th-TH')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={handleCheckout} className="h-fit rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
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
          ที่อยู่จัดส่ง *
        </label>
        <textarea
          required
          rows={4}
          value={deliveryAddress}
          onChange={(event) => setDeliveryAddress(event.target.value)}
          placeholder="เช่น อาคาร..., ห้อง..., เบอร์โทรติดต่อ..."
          className="mt-2 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-amber-500"
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {submitting ? 'กำลังส่งออร์เดอร์...' : 'ยืนยันสั่งอาหาร'}
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
