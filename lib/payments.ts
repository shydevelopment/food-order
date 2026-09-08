export const paymentMethods = ['cash', 'qr', 'card'] as const
export const paymentStatuses = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
] as const

export type PaymentMethod = (typeof paymentMethods)[number]
export type PaymentStatus = (typeof paymentStatuses)[number]

export const paymentMethodMeta: Record<
  PaymentMethod,
  { label: string; className: string }
> = {
  cash: {
    label: 'เงินสด',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  qr: {
    label: 'QR Payment',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  card: {
    label: 'บัตรเครดิต',
    className: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
}

export const paymentStatusMeta: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'รอชำระ',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  paid: {
    label: 'ชำระแล้ว',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  failed: {
    label: 'ไม่สำเร็จ',
    className: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  cancelled: {
    label: 'ยกเลิก',
    className: 'border-neutral-600 bg-neutral-800 text-neutral-300',
  },
  refunded: {
    label: 'คืนเงินแล้ว',
    className: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300',
  },
}

export const isPaymentMethod = (value: string): value is PaymentMethod =>
  paymentMethods.includes(value as PaymentMethod)

export const isPaymentStatus = (value: string): value is PaymentStatus =>
  paymentStatuses.includes(value as PaymentStatus)
