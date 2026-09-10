'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import CancelOrderButton from '@/components/cancel-order-button'

interface QrState {
  orderId: string
  amount: number
  status: string
  qrImage: string | null
  accountName: string | null
  expiresAt: string | null
  expired: boolean
  processing: boolean
  canRetry: boolean
  verificationError: string | null
  qrCancelled: boolean
}

function QrOrder({ orderId }: { orderId: string }) {
  const [payment, setPayment] = useState<QrState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(0)
  const inFlight = useRef(false)

  const refresh = useCallback(async (create = false, signal?: AbortSignal) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const response = await fetch(`/api/payments/qr/${orderId}`, {
        method: create ? 'POST' : 'GET', cache: 'no-store', signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'ไม่สามารถตรวจสอบ QR ได้')
      if (!signal?.aborted) { setPayment(result); setError(result.verificationError || ''); setNow(Date.now()) }
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
    } finally {
      inFlight.current = false
      if (!signal?.aborted) setBusy(false)
    }
  }, [orderId])

  useEffect(() => {
    // GET first: reopening or Strict Mode must never create a second QR.
    const controller = new AbortController()
    const timer = window.setTimeout(() => void refresh(false, controller.signal), 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [refresh])

  useEffect(() => {
    if (payment?.status !== 'pending' || payment.expiresAt) return
    const timer = window.setTimeout(() => void refresh(true), 0)
    return () => window.clearTimeout(timer)
  }, [payment?.status, payment?.expiresAt, refresh])

  useEffect(() => {
    if (payment?.status !== 'pending') return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 10000)
    return () => window.clearInterval(timer)
  }, [payment?.status, refresh])

  useEffect(() => {
    if (!payment?.expiresAt || payment.status !== 'pending') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [payment?.expiresAt, payment?.status])

  const remaining = payment?.expiresAt ? Math.max(0, Math.ceil((Date.parse(payment.expiresAt) - now) / 1000)) : 0
  const expired = Boolean(payment?.expiresAt && (payment.expired || remaining === 0))
  const paid = payment?.status === 'paid'
  const pending = payment?.status === 'pending'
  return (
    <section className="rounded-2xl border border-neutral-800 p-5 text-center sm:p-7">
      <h2 className="font-black">ออเดอร์ #{orderId.slice(0, 8)}</h2>
      {payment && <p className="mt-2 text-3xl font-black text-amber-400">฿{payment.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>}
      <div aria-live="polite" className="mt-4">
        {paid ? <p className="font-bold text-emerald-400">ชำระเงินสำเร็จแล้ว</p>
          : pending && payment.qrCancelled ? <p className="text-amber-300">QR ถูกยกเลิกแล้ว กรุณากดยกเลิกออเดอร์เพื่อดำเนินการให้เสร็จ</p>
          : pending && expired ? <p className="text-amber-300">QR หมดอายุแล้ว หากชำระไปแล้วให้ตรวจสอบสถานะ ห้ามชำระซ้ำ</p>
          : pending && payment.qrImage ? <>
            <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-4">
              {/* KGP's PNG is returned by our authenticated API; never pass secret keys to an image URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment.qrImage} alt="QR สำหรับชำระค่าอาหารผ่านแอปธนาคาร" width={280} height={280} className="h-auto max-w-full" />
            </div>
            <p className="mt-3 font-bold">{payment.accountName}</p>
            <p className="mt-1 text-sm text-neutral-400">ตรวจสอบชื่อผู้รับและยอดเงินในแอปธนาคารก่อนยืนยัน</p>
            <p className="mt-2 text-sm text-amber-300">หมดอายุใน {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>
            <a href={payment.qrImage} download={`payment-${orderId}.png`} className="mt-3 inline-block text-sm text-amber-400 underline">บันทึกรูป QR</a>
          </> : pending && payment.canRetry ? <p className="text-sm text-neutral-400">ยังไม่ได้รับ QR สำหรับออเดอร์นี้ สามารถลองสร้างใหม่ด้วยเลขอ้างอิงเดิมได้</p>
          : pending && payment.processing ? <p className="text-sm text-neutral-400">ยังไม่ได้รับ QR สำหรับออเดอร์นี้ กรุณาติดต่อผู้ดูแลระบบพร้อมเลขออเดอร์</p>
          : payment && !pending ? <p>สถานะ: {payment.status === 'cancelled' ? 'ยกเลิกแล้ว' : payment.status === 'refunded' ? 'คืนเงินแล้ว' : 'ชำระไม่สำเร็จ'}</p>
          : !payment && <p className="text-sm text-neutral-400">{error ? 'โหลดข้อมูลชำระเงินไม่สำเร็จ' : 'กำลังโหลดข้อมูลชำระเงิน'}</p>}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      {!paid && <button type="button" disabled={busy} onClick={() => void refresh(Boolean(pending && (!payment?.expiresAt || payment.canRetry)))}
        className="mt-5 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-neutral-950 disabled:opacity-50">
        {busy ? 'กำลังตรวจสอบ...' : payment?.canRetry ? 'ลองสร้าง QR อีกครั้ง' : pending && !payment?.expiresAt ? 'แสดง QR ชำระเงิน' : 'ตรวจสอบสถานะอีกครั้ง'}
      </button>}
      {payment && ['pending', 'failed'].includes(payment.status) && <CancelOrderButton orderId={orderId} redirectToOrder />}
      <Link href={`/orders?order=${orderId}`} className="mt-4 block text-sm text-amber-400 underline">ดูรายละเอียดออเดอร์</Link>
    </section>
  )
}

export default function QrPaymentPanel({ orderIds }: { orderIds: string[] }) {
  return <div className="mx-auto max-w-4xl">
    <h1 className="text-2xl font-black">ชำระเงินด้วย QR พร้อมเพย์</h1>
    <p className="mt-2 text-sm text-neutral-400">{orderIds.length > 1 ? 'กรุณาชำระแต่ละออเดอร์แยกกัน ระบบจะตรวจสอบผลให้อัตโนมัติ' : 'สแกนด้วยแอปธนาคาร ระบบจะตรวจสอบผลให้อัตโนมัติ'}</p>
    <div className="mt-6 grid gap-5 md:grid-cols-2">{orderIds.map(id => <QrOrder key={id} orderId={id} />)}</div>
    <Link href="/cart" className="mt-6 inline-block text-sm text-neutral-400 underline">กลับไปตะกร้า</Link>
  </div>
}
