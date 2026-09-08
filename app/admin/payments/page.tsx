import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import PaymentStatusActions from '@/components/payment-status-actions'
import {
  isPaymentMethod,
  isPaymentStatus,
  paymentMethodMeta,
  paymentMethods,
  paymentStatusMeta,
  paymentStatuses,
  type PaymentMethod,
  type PaymentStatus,
} from '@/lib/payments'
import { createClient } from '@/supabase/service'

interface Restaurant {
  id: string
  name: string
  owner_id: string | null
  email: string | null
}

interface RestaurantMember {
  restaurant_id: string
}

interface PaymentRow {
  id: string
  order_id: string
  restaurant_id: string
  method: PaymentMethod
  status: PaymentStatus
  amount: number | string
  provider: string | null
  provider_reference: string | null
  paid_at: string | null
  created_at: string
  orders: { order_no: number | null } | null
  restaurants: { name: string | null } | null
}

const noRestaurantId = '00000000-0000-0000-0000-000000000000'

const formatAmount = (amount: number | string) =>
  Number(amount || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatDateTime = (value: string | null) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    method?: string
    status?: string
    restaurantId?: string
  }>
}) {
  const resolvedSearchParams = await searchParams
  const selectedMethod = isPaymentMethod(resolvedSearchParams.method || '')
    ? resolvedSearchParams.method
    : ''
  const selectedStatus = isPaymentStatus(resolvedSearchParams.status || '')
    ? resolvedSearchParams.status
    : ''
  const requestedRestaurantId = resolvedSearchParams.restaurantId || ''

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (
    profileError ||
    !profile ||
    !['admin', 'restaurant'].includes(profile.role)
  ) {
    redirect('/')
  }

  const isAdmin = profile.role === 'admin'
  const ownerFilters = [`owner_id.eq.${user.id}`]
  if (profile.email) ownerFilters.push(`email.eq.${profile.email}`)

  const [{ data: ownedRestaurants }, { data: restaurantMembers }] = isAdmin
    ? [{ data: [] }, { data: [] }]
    : await Promise.all([
        supabaseAdmin
          .from('restaurants')
          .select('id, name, owner_id, email')
          .or(ownerFilters.join(',')),
        supabaseAdmin
          .from('restaurant_members')
          .select('restaurant_id')
          .eq('user_id', user.id),
      ])

  const allowedRestaurantIds = Array.from(
    new Set([
      ...((ownedRestaurants || []) as Restaurant[]).map(
        (restaurant) => restaurant.id,
      ),
      ...((restaurantMembers || []) as RestaurantMember[]).map(
        (member) => member.restaurant_id,
      ),
    ]),
  )

  const { data: selectableRestaurants } = isAdmin
    ? await supabaseAdmin
        .from('restaurants')
        .select('id, name, owner_id, email')
        .order('name', { ascending: true })
    : allowedRestaurantIds.length > 0
      ? await supabaseAdmin
          .from('restaurants')
          .select('id, name, owner_id, email')
          .in('id', allowedRestaurantIds)
          .order('name', { ascending: true })
      : { data: [] }

  const restaurantRows = (selectableRestaurants || []) as Restaurant[]
  const canFilterRestaurant =
    requestedRestaurantId &&
    restaurantRows.some((restaurant) => restaurant.id === requestedRestaurantId)

  let paymentsQuery = supabaseAdmin
    .from('payments')
    .select(
      'id, order_id, restaurant_id, method, status, amount, provider, provider_reference, paid_at, created_at, orders(order_no), restaurants(name)',
    )
    .order('created_at', { ascending: false })
    .limit(250)

  if (!isAdmin) {
    paymentsQuery = paymentsQuery.in(
      'restaurant_id',
      allowedRestaurantIds.length > 0 ? allowedRestaurantIds : [noRestaurantId],
    )
  }

  if (canFilterRestaurant) {
    paymentsQuery = paymentsQuery.eq('restaurant_id', requestedRestaurantId)
  }
  if (selectedMethod) paymentsQuery = paymentsQuery.eq('method', selectedMethod)
  if (selectedStatus) paymentsQuery = paymentsQuery.eq('status', selectedStatus)

  const { data: payments, error: paymentsError } = await paymentsQuery
  const paymentRows = (payments || []) as unknown as PaymentRow[]
  const paidTotal = paymentRows
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + Number(payment.amount || 0), 0)
  const pendingTotal = paymentRows
    .filter((payment) => payment.status === 'pending')
    .reduce((total, payment) => total + Number(payment.amount || 0), 0)

  return (
    <div className="space-y-5 sm:space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
            Payment workspace
          </p>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            การชำระเงิน{isAdmin ? 'ทุกร้าน' : 'ของร้านที่คุณดูแล'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            ติดตามเงินสด, QR Payment และบัตรเครดิตแยกตามร้านอย่างปลอดภัย
          </p>
        </div>
        <a
          href="/admin/payments"
          className="inline-flex items-center justify-center rounded-xl border border-neutral-700 px-4 py-2.5 text-sm font-black text-neutral-200 transition hover:border-neutral-500 hover:text-white"
        >
          ล้างตัวกรอง
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
          <p className="text-xs font-bold text-neutral-500">รายการที่แสดง</p>
          <p className="mt-2 text-2xl font-black text-white">{paymentRows.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-bold text-emerald-200/70">ชำระแล้ว</p>
          <p className="mt-2 text-2xl font-black text-emerald-300">฿{formatAmount(paidTotal)}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-bold text-amber-100/70">รอชำระ</p>
          <p className="mt-2 text-2xl font-black text-amber-300">฿{formatAmount(pendingTotal)}</p>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-xs font-bold text-sky-100/70">ร้านในขอบเขต</p>
          <p className="mt-2 text-2xl font-black text-sky-300">{restaurantRows.length}</p>
        </div>
      </div>

      <form className="grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4 md:grid-cols-4">
        <label className="text-xs font-bold text-neutral-400">
          ร้านอาหาร
          <select
            name="restaurantId"
            defaultValue={canFilterRestaurant ? requestedRestaurantId : ''}
            className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-amber-400"
          >
            <option value="">{isAdmin ? 'ทุกร้าน' : 'ร้านทั้งหมดของฉัน'}</option>
            {restaurantRows.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-neutral-400">
          ช่องทางชำระเงิน
          <select
            name="method"
            defaultValue={selectedMethod}
            className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-amber-400"
          >
            <option value="">ทุกช่องทาง</option>
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {paymentMethodMeta[method].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-neutral-400">
          สถานะ
          <select
            name="status"
            defaultValue={selectedStatus}
            className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-amber-400"
          >
            <option value="">ทุกสถานะ</option>
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {paymentStatusMeta[status].label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-neutral-950 transition hover:bg-amber-400"
        >
          ใช้ตัวกรอง
        </button>
      </form>

      {paymentsError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          ยังไม่พบตาราง Payment กรุณารันไฟล์{' '}
          <code className="font-bold">supabase/sql/payments_dashboard.sql</code>{' '}
          ใน Supabase SQL Editor ก่อนใช้งาน
        </div>
      ) : paymentRows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 px-5 py-16 text-center">
          <p className="text-lg font-black text-white">ยังไม่มีรายการชำระเงิน</p>
          <p className="mt-2 text-sm text-neutral-500">
            รายการใหม่จะแยกตามร้านและแสดงตามช่องทางชำระเงินที่เลือก
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/40">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-900/70 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-black">ออเดอร์ / ร้าน</th>
                  <th className="px-4 py-3 font-black">ช่องทาง</th>
                  <th className="px-4 py-3 font-black">ยอดเงิน</th>
                  <th className="px-4 py-3 font-black">สถานะ</th>
                  <th className="px-4 py-3 font-black">เวลา</th>
                  <th className="px-4 py-3 font-black">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {paymentRows.map((payment) => (
                  <tr key={payment.id} className="align-top text-neutral-300">
                    <td className="px-4 py-4">
                      <p className="font-black text-white">
                        Order #{payment.orders?.order_no || payment.order_id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {payment.restaurants?.name || 'ไม่พบชื่อร้าน'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${paymentMethodMeta[payment.method].className}`}>
                        {paymentMethodMeta[payment.method].label}
                      </span>
                      {payment.provider && (
                        <p className="mt-1 text-xs text-neutral-500">{payment.provider}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 font-black text-white">฿{formatAmount(payment.amount)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${paymentStatusMeta[payment.status].className}`}>
                        {paymentStatusMeta[payment.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-neutral-500">
                      <p>สร้าง {formatDateTime(payment.created_at)}</p>
                      {payment.paid_at && <p className="mt-1 text-emerald-400">ชำระ {formatDateTime(payment.paid_at)}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <PaymentStatusActions
                        paymentId={payment.id}
                        method={payment.method}
                        status={payment.status}
                        canManage={isAdmin || payment.method === 'cash'}
                        isAdmin={isAdmin}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
