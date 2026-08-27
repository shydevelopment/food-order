'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getOrderStatusLabel } from '@/lib/order-status'

interface OrderStatusActionsProps {
  orderId: string
  status: string | null
}

const nextActions = [
  { status: 'preparing', label: 'รับออเดอร์', visibleFrom: ['pending', null] },
  {
    status: 'delivering',
    label: getOrderStatusLabel('delivering'),
    visibleFrom: ['preparing'],
  },
  {
    status: 'completed',
    label: 'เสร็จสิ้น',
    visibleFrom: ['delivering', 'preparing'],
  },
  {
    status: 'cancelled',
    label: 'ยกเลิก',
    visibleFrom: ['pending', 'preparing'],
  },
]

export default function OrderStatusActions({
  orderId,
  status,
}: OrderStatusActionsProps) {
  const router = useRouter()
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')

  const handleUpdateStatus = async (nextStatus: string, reason?: string) => {
    const cleanedReason = String(reason || '').trim()

    setUpdatingStatus(nextStatus)

    try {
      const res = await fetch('/api/admin/orders/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: nextStatus,
          cancellationReason:
            nextStatus === 'cancelled' ? cleanedReason : undefined,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถอัปเดตสถานะได้')
      }

      router.refresh()
      if (nextStatus === 'cancelled') {
        setShowCancelDialog(false)
        setCancellationReason('')
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'เกิดข้อผิดพลาดในการอัปเดตสถานะ'
      alert(message)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleCancelOrder = () => {
    const cleanedReason = cancellationReason.trim()
    if (cleanedReason.length < 3) {
      alert('กรุณากรอกเหตุผลการยกเลิกอย่างน้อย 3 ตัวอักษร')
      return
    }

    void handleUpdateStatus('cancelled', cleanedReason)
  }

  if (status === 'completed' || status === 'cancelled') {
    return null
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {nextActions
          .filter((action) => action.visibleFrom.includes(status))
          .map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={Boolean(updatingStatus)}
              onClick={() => {
                if (action.status === 'cancelled') {
                  setShowCancelDialog(true)
                  return
                }

                void handleUpdateStatus(action.status)
              }}
              className={`rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                action.status === 'cancelled'
                  ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'bg-orange-500 text-black hover:bg-orange-400'
              }`}
            >
              {updatingStatus === action.status
                ? 'กำลังบันทึก...'
                : action.label}
            </button>
          ))}
      </div>

      {showCancelDialog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 px-4 py-6 text-white backdrop-blur-sm food-alert-overlay">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-800  p-5 shadow-2xl shadow-black/60 food-alert-panel">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-2xl font-black text-red-400">
              !
            </div>
            <p className="mt-4 text-center text-xs font-black uppercase tracking-wide text-red-400">
              ยกเลิกออเดอร์
            </p>
            <h2 className="mt-2 text-center text-2xl font-black text-white">
              กรอกเหตุผลให้ลูกค้าทราบ
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-neutral-400">
              เหตุผลนี้จะแสดงให้ลูกค้าเห็นในหน้า Track Order
              และการแจ้งเตือนสถานะ
            </p>

            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-neutral-400">
              เหตุผลการยกเลิก
            </label>
            <textarea
              rows={4}
              value={cancellationReason}
              onChange={(event) =>
                setCancellationReason(event.target.value.slice(0, 300))
              }
              placeholder="เช่น วัตถุดิบหมด, ร้านปิดฉุกเฉิน, ทำออเดอร์นี้ไม่ทัน"
              className="mt-2 w-full resize-none rounded-xl border border-neutral-800  px-3 py-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-red-500"
            />
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-neutral-500">
              <span>บังคับกรอกก่อนยกเลิก</span>
              <span>{cancellationReason.length}/300</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                disabled={Boolean(updatingStatus)}
                onClick={handleCancelOrder}
                className="rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed  disabled:text-neutral-500"
              >
                {updatingStatus === 'cancelled'
                  ? 'กำลังยกเลิก...'
                  : 'ยืนยันยกเลิกออเดอร์'}
              </button>
              <button
                type="button"
                disabled={Boolean(updatingStatus)}
                onClick={() => {
                  setShowCancelDialog(false)
                  setCancellationReason('')
                }}
                className="rounded-xl border border-neutral-700  px-5 py-3 text-sm font-bold text-neutral-300 transition  hover:text-white disabled:opacity-50"
              >
                กลับ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
