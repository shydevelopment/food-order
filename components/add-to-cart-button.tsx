'use client'

interface CartItem {
  menuId: string
  restaurantId: string
  restaurantName: string
  name: string
  price: number
  imageUrl: string | null
  quantity: number
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

export default function AddToCartButton({ menu, disabled = false }: AddToCartButtonProps) {
  const handleAddToCart = () => {
    const currentCart = readCart()
    const hasOtherRestaurant = currentCart.some((item) => item.restaurantId !== menu.restaurantId)

    if (hasOtherRestaurant) {
      const shouldReplace = window.confirm('ตะกร้าสั่งได้ทีละร้าน ต้องการล้างตะกร้าเดิมแล้วเลือกร้านนี้แทนไหม?')
      if (!shouldReplace) return
      writeCart([])
    }

    const nextCart = hasOtherRestaurant ? [] : [...currentCart]
    const existingItem = nextCart.find((item) => item.menuId === menu.id)

    if (existingItem) {
      existingItem.quantity += 1
    } else {
      nextCart.push({
        menuId: menu.id,
        restaurantId: menu.restaurantId,
        restaurantName: menu.restaurantName,
        name: menu.name,
        price: menu.price,
        imageUrl: menu.imageUrl,
        quantity: 1,
      })
    }

    writeCart(nextCart)
    window.location.href = '/cartPage'
  }

  return (
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
  )
}
