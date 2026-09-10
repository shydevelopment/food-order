'use client'

import { useState } from 'react'

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

interface CustomMadeToOrderFormProps {
  restaurantId: string
  restaurantName: string
  unavailableIngredients: string[]
  disabled?: boolean
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

export default function CustomMadeToOrderForm({
  restaurantId,
  restaurantName,
  unavailableIngredients,
  disabled = false,
}: CustomMadeToOrderFormProps) {
  const [customName, setCustomName] = useState('')
  const [itemNote, setItemNote] = useState('')
  const [isSpecial, setIsSpecial] = useState(false)

  const unavailableMatch = unavailableIngredients.find((ingredient) => {
    const normalizedIngredient = ingredient.trim()
    if (!normalizedIngredient) return false
    const text = `${customName} ${itemNote}`.toLowerCase()
    return text.includes(normalizedIngredient.toLowerCase())
  })

  const handleAddCustomItem = () => {
    const cleanedName = customName.trim()
    const cleanedNote = itemNote.trim()

    if (!cleanedName) {
      alert('กรุณาเขียนเมนูที่ต้องการสั่ง')
      return
    }

    if (unavailableMatch) {
      alert(`วัตถุดิบ "${unavailableMatch}" หมด กรุณาเลือกเมนูอื่น`)
      return
    }

    const nextCart = readCart()
    const cartItemId = `custom:${restaurantId}:${Date.now()}`

    nextCart.push({
      menuId: '',
      cartItemId,
      restaurantId,
      restaurantName,
      name: cleanedName,
      price: 0,
      imageUrl: null,
      quantity: 1,
      isSpecial,
      customName: cleanedName,
      itemNote: cleanedNote || undefined,
    })

    writeCart(nextCart)
    window.location.href = '/cart'
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-black text-amber-400">เขียนเมนูตามสั่งเอง</h4>
          <p className="mt-1 text-xs text-neutral-500">ราคาให้ร้านสรุปในแชทหรือหน้าร้านเมื่อรับอาหาร</p>
        </div>
        {unavailableIngredients.length > 0 && (
          <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] font-black text-red-300">
            ของหมด {unavailableIngredients.length} รายการ
          </span>
        )}
      </div>

      {unavailableIngredients.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {unavailableIngredients.map((ingredient) => (
            <span key={ingredient} className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
              {ingredient}หมด
            </span>
          ))}
        </div>
      )}

      <textarea
        rows={2}
        value={customName}
        onChange={(event) => setCustomName(event.target.value.slice(0, 120))}
        placeholder="เช่น กะเพราไก่ไข่ดาว, ข้าวผัดหมู, คะน้าหมูกรอบ"
        className="mt-3 w-full resize-none rounded-lg border border-neutral-800  px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-amber-500"
      />
      <textarea
        rows={2}
        value={itemNote}
        onChange={(event) => setItemNote(event.target.value.slice(0, 160))}
        placeholder="รายละเอียดเพิ่มเติม เช่น เผ็ดน้อย ไม่ใส่ผัก ไม่ใส่น้ำตาล"
        className="mt-2 w-full resize-none rounded-lg border border-neutral-800  px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-amber-500"
      />

      {unavailableMatch && (
        <p className="mt-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
          วัตถุดิบ &quot;{unavailableMatch}&quot; หมด ร้านแจ้งไว้ตอนนี้
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-neutral-200">
          <input
            type="checkbox"
            checked={isSpecial}
            onChange={(event) => setIsSpecial(event.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          พิเศษ
        </label>

        <button
          type="button"
          disabled={disabled || Boolean(unavailableMatch)}
          onClick={handleAddCustomItem}
          className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-black text-neutral-950 transition hover:bg-amber-400 disabled:cursor-not-allowed  disabled:text-neutral-500"
        >
          เพิ่มเมนูตามสั่ง
        </button>
      </div>
    </div>
  )
}
