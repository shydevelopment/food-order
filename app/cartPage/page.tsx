import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import CartCheckout from '@/components/cart-checkout'

export default async function CartPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-[80vh] bg-neutral-950 px-4 py-8 text-white">
      <CartCheckout />
    </div>
  )
}
