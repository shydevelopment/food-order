import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { requestCustomerOrderCancellation } from '@/lib/cancel-customer-order'
import { PaymentError } from '@/lib/kgp'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) {
      throw new PaymentError('คำขอไม่ถูกต้อง', 403)
    }
    const { orderId } = await params
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(orderId)) throw new PaymentError('รหัสออเดอร์ไม่ถูกต้อง', 400)
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new PaymentError('กรุณาเข้าสู่ระบบก่อน', 401)
    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 3) throw new PaymentError('กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร', 400)
    if (reason.length > 200) throw new PaymentError('เหตุผลต้องไม่เกิน 200 ตัวอักษร', 400)
    return NextResponse.json(await requestCustomerOrderCancellation(orderId, user.id, reason), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'ไม่สามารถส่งคำขอยกเลิกออเดอร์ได้' }, {
      status: error instanceof PaymentError ? error.status : 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
