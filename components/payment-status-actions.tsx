'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { type PaymentMethod, type PaymentStatus } from '@/lib/payments'

interface PaymentStatusActionsProps {
  paymentId: string
  method: PaymentMethod
  status: PaymentStatus
  canManage: boolean
  isAdmin: boolean
}

const statusActions: Array<{ status: PaymentStatus; label: string }> = [
  { status: 'paid', label: 'ยืนยันชำระแล้ว' },
  { status: 'failed', label: 'ชำระไม่สำเร็จ' },
  { status: 'cancelled', label: 'ยกเลิกรายการ' },
  { status: 'refunded', label: 'คืนเงินแล้ว' },
]

export default function PaymentStatusActions({
  paymentId,
  method,
  status,
  canManage,
  isAdmin,
}: PaymentStatusActionsProps) {
  const router = useRouter()
  const [updating, setUpdating] = useState<PaymentStatus | null>(null)

  const updatePayment = async (nextStatus: PaymentStatus) => {
    setUpdating(nextStatus)

    try {
      const response = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถอัปเดตสถานะการชำระเงินได้')
      }

      router.refresh()
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'ไม่สามารถอัปเดตสถานะการชำระเงินได้',
      )
    } finally {
      setUpdating(null)
    }
  }

  if (status === 'cancelled' || status === 'refunded') {
    return null
  }

  if (method === 'qr' || (!isAdmin && method !== 'cash')) {
    return (
      <span className="text-xs font-medium text-neutral-500">
        รอผู้ให้บริการยืนยัน
      </span>
    )
  }

  if (!canManage) return null

  const availableActions = isAdmin
    ? statusActions.filter((action) => action.status !== status)
    : status === 'pending'
      ? statusActions.filter((action) => action.status === 'paid')
      : []

  return (
    <div className="flex flex-wrap gap-2">
      {availableActions.map((action) => (
        <button
          key={action.status}
          type="button"
          disabled={Boolean(updating)}
          onClick={() => void updatePayment(action.status)}
          className={`rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
            action.status === 'paid'
              ? 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400'
              : action.status === 'refunded'
                ? 'border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20'
                : 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
          }`}
        >
          {updating === action.status ? 'กำลังบันทึก...' : action.label}
        </button>
      ))}
    </div>
  )
}
