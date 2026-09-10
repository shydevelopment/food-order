'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelOrderButton({ orderId, redirectToOrder = false, cancellationRequested = false }: { orderId: string; redirectToOrder?: boolean; cancellationRequested?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const cancel = async () => {
    const cleanedReason = reason.trim()
    if (busy) return
    if (cleanedReason.length < 3) {
      setError('กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cleanedReason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'ไม่สามารถส่งคำขอยกเลิกออเดอร์ได้')
      if (redirectToOrder) router.push(`/orders?order=${orderId}`)
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ไม่สามารถส่งคำขอยกเลิกออเดอร์ได้')
    } finally { setBusy(false) }
  }
  return <div className="mt-3">
    {cancellationRequested ? (
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200">
        ส่งคำขอยกเลิกให้ร้านแล้ว รอร้านยืนยันการยกเลิก
      </p>
    ) : !open ? (
      <button type="button" onClick={() => { setOpen(true); setError('') }}
        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20">
        ขอให้ร้านยกเลิกออเดอร์
      </button>
    ) : (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
        <label htmlFor={`cancel-reason-${orderId}`} className="block text-sm font-bold text-red-200">
          เหตุผลที่ขอยกเลิก
        </label>
        <textarea
          id={`cancel-reason-${orderId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          rows={3}
          disabled={busy}
          placeholder="เช่น เปลี่ยนใจ หรือเลือกรายการผิด"
          className="mt-2 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-red-400 disabled:opacity-60"
        />
        <p className="mt-1 text-right text-xs text-neutral-500">{reason.length}/200</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void cancel()} disabled={busy || reason.trim().length < 3}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-50">
            {busy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอยกเลิกให้ร้าน'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setOpen(false); setReason(''); setError('') }}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-bold text-neutral-300 disabled:opacity-50">
            ไม่ยกเลิก
          </button>
        </div>
      </div>
    )}
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
  </div>
}
