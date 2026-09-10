import { createClient } from '@/supabase/service'
import { redirect } from 'next/navigation'
import PaymentCheckout from '@/components/payment-checkout'
import QrPaymentPanel from '@/components/qr-payment-panel'

export default async function PaymentPage({ searchParams }: {
  searchParams: Promise<{ orders?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const query = await searchParams
  const orderIds = typeof query.orders === 'string'
    ? Array.from(new Set(query.orders.split(',').filter(id => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)))).slice(0, 20)
    : []

  return (
    <div className="min-h-[80vh] w-full  px-0 py-4 text-white sm:px-2 sm:py-8">
      {orderIds.length ? <QrPaymentPanel orderIds={orderIds} /> : <PaymentCheckout userId={user.id} />}
    </div>
  )
}
