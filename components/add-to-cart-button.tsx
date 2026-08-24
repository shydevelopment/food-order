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
}

interface AddToCartButtonProps {
  menu: {
    id: string
    restaurantId: string
    restaurantName: string
    name: string
    price: number
    imageUrl: string | null
  }
  allowSpecial?: boolean
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

export default function AddToCartButton({ menu, allowSpecial = false, disabled = false }: AddToCartButtonProps) {
  const [isSpecial, setIsSpecial] = useState(false)

  const handleAddToCart = () => {
    const currentCart = readCart()
    const hasOtherRestaurant = currentCart.some((item) => item.restaurantId !== menu.restaurantId)

    if (hasOtherRestaurant) {
      const shouldReplace = window.confirm('ตะกร้าสั่งได้ทีละร้าน ต้องการล้างตะกร้าเดิมแล้วเลือกร้านนี้แทนไหม?')
      if (!shouldReplace) return
      writeCart([])
    }

    const nextCart = hasOtherRestaurant ? [] : [...currentCart]
    const cartItemId = `${menu.id}:${isSpecial ? 'special' : 'normal'}`
    const existingItem = nextCart.find((item) => (item.cartItemId || item.menuId) === cartItemId)

    if (existingItem) {
      existingItem.quantity += 1
    } else {
      nextCart.push({
        menuId: menu.id,
        cartItemId,
        restaurantId: menu.restaurantId,
        restaurantName: menu.restaurantName,
        name: menu.name,
        price: menu.price,
        imageUrl: menu.imageUrl,
        quantity: 1,
        isSpecial,
      })
    }

    writeCart(nextCart)
    window.location.href = '/cartPage'
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {allowSpecial && (
        <label className="flex cursor-pointer items-center justify-end gap-2 text-[11px] font-bold text-neutral-300">
          <input
            type="checkbox"
            checked={isSpecial}
            onChange={(event) => setIsSpecial(event.target.checked)}
            className="h-3.5 w-3.5 accent-amber-500"
          />
          พิเศษ
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={handleAddToCart}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
          disabled
            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            : 'bg-amber-500 text-neutral-950 hover:bg-amber-400'
        }`}
      >
        {disabled ? 'สั่งไม่ได้' : 'เพิ่มลงตะกร้า'}
      </button>
    </div>
  )
}
