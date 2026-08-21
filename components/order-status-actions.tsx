'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface OrderStatusActionsProps {
  orderId: string
  status: string | null
}

const nextActions = [
  { status: 'preparing', label: 'รับออเดอร์', visibleFrom: ['pending', null] },
  { status: 'delivering', label: 'กำลังจัดส่ง', visibleFrom: ['preparing'] },
  { status: 'completed', label: 'เสร็จสิ้น', visibleFrom: ['delivering', 'preparing'] },
  { status: 'cancelled', label: 'ยกเลิก', visibleFrom: ['pending', 'preparing'] },
]

export default function OrderStatusActions({ orderId, status }: OrderStatusActionsProps) {
  const router = useRouter()
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  const handleUpdateStatus = async (nextStatus: string) => {
    if (nextStatus === 'cancelled') {
      const shouldCancel = window.confirm('ต้องการยกเลิกออร์เดอร์นี้ใช่ไหม?')
      if (!shouldCancel) return
    }

    setUpdatingStatus(nextStatus)

    try {
      const res = await fetch('/api/admin/orders/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: nextStatus }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'ไม่สามารถอัปเดตสถานะได้')
      }

      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปเดตสถานะ'
      alert(message)
    } finally {
      setUpdatingStatus(null)
    }
  }

  if (status === 'completed' || status === 'cancelled') {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextActions
        .filter((action) => action.visibleFrom.includes(status))
        .map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={Boolean(updatingStatus)}
            onClick={() => handleUpdateStatus(action.status)}
            className={`rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
              action.status === 'cancelled'
                ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-orange-500 text-black hover:bg-orange-400'
            }`}
          >
            {updatingStatus === action.status ? 'กำลังบันทึก...' : action.label}
          </button>
        ))}
    </div>
  )
}
