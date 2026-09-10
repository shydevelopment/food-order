import { NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/admin'
import { kgpConfig, PaymentError, readQrRecord, reconcileQrPayment } from '@/lib/kgp'
import { verifyKgpChecksum, type KgpCharge } from '@/lib/kgp-protocol'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json() as KgpCharge
    if (!body || !verifyKgpChecksum(body, kgpConfig().key)
      || typeof body.reference_order !== 'string' || body.reference_order.length > 50) {
      return NextResponse.json({ failure_code: '1012', failure_message: 'Invalid notification' }, { status: 400 })
    }
    const db = createAdminClient()
    const { data: reference, error } = await db.from('kgp_qr_payments').select('payment_id')
      .eq('reference_order', body.reference_order).maybeSingle()
    if (error) throw new PaymentError('Database unavailable', 503)
    if (!reference) return NextResponse.json({ failure_code: '1028', failure_message: 'Unknown reference' }, { status: 404 })
    const { data: payment, error: paymentError } = await db.from('payments')
      .select('id, order_id, customer_id, amount, status, method').eq('id', reference.payment_id).single()
    if (paymentError) throw new PaymentError('Database unavailable', 503)
    const record = await readQrRecord(payment.id)
    if (!record) throw new PaymentError('Database unavailable', 503)
    // The checksum does not cover reference_order/source. Inquiry prevents reference substitution.
    const status = await reconcileQrPayment(payment, record, true)
    if (!['paid', 'refunded'].includes(status)) throw new PaymentError('Payment not confirmed yet', 503)
    return NextResponse.json({})
  } catch (error) {
    return NextResponse.json({ failure_code: '1011', failure_message: 'Unable to confirm payment' }, {
      status: error instanceof SyntaxError ? 400 : error instanceof PaymentError ? error.status : 500,
    })
  }
}
