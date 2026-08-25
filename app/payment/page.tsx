import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import PaymentCheckout from '@/components/payment-checkout'

export default async function PaymentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-[80vh] w-full bg-neutral-950 px-0 py-4 text-white sm:px-2 sm:py-8">
      <PaymentCheckout />
    </div>
  )
}
