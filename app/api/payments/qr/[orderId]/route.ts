import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/service'
import { getQrPaymentState, loadQrPayment, PaymentError } from '@/lib/kgp'

export const runtime = 'nodejs'
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

async function handle(req: NextRequest, context: { params: Promise<{ orderId: string }> }, create: boolean) {
  try {
    if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) {
      return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 })
    }
    const { orderId } = await context.params
    if (!uuid.test(orderId)) throw new PaymentError('รหัสออเดอร์ไม่ถูกต้อง', 400)
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new PaymentError('กรุณาเข้าสู่ระบบก่อน', 401)
    const payment = await loadQrPayment(orderId, user.id)
    return NextResponse.json(await getQrPaymentState(payment, create), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentError ? error.message : 'ไม่สามารถดำเนินการชำระเงินได้' }, {
      status: error instanceof PaymentError ? error.status : 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  return handle(req, context, true)
}

export async function GET(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  return handle(req, context, false)
}
