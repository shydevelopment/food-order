import 'server-only'
import { randomInt, randomUUID } from 'node:crypto'
import { createAdminClient } from '@/supabase/admin'
import { matchesPaidCharge, qrImageDataUrl, type KgpCharge } from '@/lib/kgp-protocol'

export class PaymentError extends Error {
  constructor(message: string, public status = 502) { super(message) }
}

export function kgpConfig() {
  const key = process.env.KGP_API_KEY?.trim()
  const baseUrl = process.env.KGP_API_BASE_URL?.trim() || 'https://openapi-uat.kgppayments.com'
  const expireSeconds = Number(process.env.KGP_QR_EXPIRE_SECONDS || 600)
  if (!key) throw new PaymentError('ช่องทาง QR ยังไม่เปิดใช้งาน กรุณาเลือกเงินสดหรือติดต่อผู้ดูแลระบบ', 503)
  if (!['https://openapi-uat.kgppayments.com', 'https://openapi.kgppayments.com'].includes(baseUrl)
    || !Number.isInteger(expireSeconds) || expireSeconds < 60 || expireSeconds > 86400) {
    throw new PaymentError('การตั้งค่าระบบ QR ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ', 503)
  }
  return { key, baseUrl, expireSeconds }
}

async function kgpRequest(path: string, body?: object) {
  const { key, baseUrl } = kgpConfig()
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'x-request-id': randomUUID() },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    })
    const data = await response.json()
    if (!response.ok) {
      // Never log credentials, headers, or the provider's free-text response.
      console.error('KGP request rejected', {
        operation: path.startsWith('/api/v2/qr/cancel/') ? 'cancel-qr' : body ? 'create-qr' : 'inquiry', httpStatus: response.status,
        failureCode: /^\d{4}$/.test(String(data?.failure_code)) ? String(data.failure_code) : undefined,
      })
    }
    return { ok: response.ok, httpStatus: response.status, data }
  } catch {
    throw new PaymentError('ติดต่อระบบชำระเงินไม่ได้ กรุณาตรวจสอบสถานะอีกครั้ง')
  }
}

function gatewayAuthenticationError(httpStatus: number) {
  return new PaymentError(`ไม่สามารถยืนยันตัวตนกับผู้ให้บริการชำระเงินได้ กรุณาติดต่อผู้ดูแลระบบ (KGP ${httpStatus})`, 503)
}

const kgpFailureMessages: Record<string, string> = {
  '1004': 'ยอดชำระไม่ถูกต้อง',
  '1009': 'ไม่พบบัญชีร้านค้า',
  '1010': 'บัญชีร้านค้ายังไม่ได้รับสิทธิ์ใช้ฟังก์ชันนี้',
  '1012': 'ข้อมูลที่ส่งไปไม่ถูกต้อง',
  '1018': 'ข้อมูลที่จำเป็นไม่ครบหรือรูปแบบไม่ถูกต้อง',
  '1019': 'ข้อมูลอ้างอิงซ้ำ',
  '1026': 'หมายเลขออเดอร์ถูกใช้งานแล้ว',
  '1027': 'อยู่นอกเวลาที่ผู้ให้บริการเปิดให้ทำรายการ',
  '1030': 'เลขอ้างอิงถูกใช้งานแล้ว',
  '1031': 'เลขอ้างอิงออเดอร์ถูกใช้งานแล้ว',
}

function kgpFailureError(data: { failure_code?: unknown }, fallback: string) {
  const code = /^\d{4}$/.test(String(data.failure_code)) ? String(data.failure_code) : null
  const detail = code ? kgpFailureMessages[code] : null
  return new PaymentError(`${detail || fallback}${code ? ` (KGP ${code})` : ''}`)
}

export function createKgpReferenceOrder(now = new Date()): string {
  // KGP's UAT sample reference is numeric and timestamp-shaped. Use Bangkok time,
  // then add six random digits to remain unique when multiple orders start per second.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${fields.year}${fields.month}${fields.day}${fields.hour}${fields.minute}${fields.second}${randomInt(0, 1_000_000).toString().padStart(6, '0')}`
}

export interface QrRecord {
  payment_id: string
  reference_order: string
  qr_id: string | null
  gateway_order_id: string | null
  image_data_url: string | null
  account_name: string | null
  expires_at: string
  request_state: 'creating' | 'ready' | 'failed'
  last_checked_at: string | null
  gateway_cancelled_at?: string | null
}

export interface QrPayment {
  id: string; order_id: string; customer_id: string; amount: number | string
  status: string; method: string
}

export async function loadQrPayment(orderId: string, userId: string) {
  const db = createAdminClient()
  const { data, error } = await db.from('payments')
    .select('id, order_id, customer_id, amount, status, method')
    .eq('order_id', orderId).eq('customer_id', userId).eq('method', 'qr').maybeSingle()
  if (error) throw new PaymentError('ไม่สามารถอ่านข้อมูลชำระเงินได้', 503)
  if (!data) throw new PaymentError('ไม่พบรายการชำระเงิน', 404)
  return data as QrPayment
}

export async function readQrRecord(paymentId: string) {
  const { data, error } = await createAdminClient().from('kgp_qr_payments')
    .select('*').eq('payment_id', paymentId).maybeSingle()
  if (error) throw new PaymentError('ช่องทาง QR ยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ', 503)
  return data as QrRecord | null
}

// Webhook data is only a notification. Confirm all payment fields using the secret-key inquiry API.
export async function reconcileQrPayment(payment: QrPayment, record: QrRecord, force = false) {
  if (payment.status === 'paid' || payment.status === 'refunded') return payment.status
  const db = createAdminClient()
  if (!force) {
    const cutoff = new Date(Date.now() - 8000).toISOString()
    const { data, error } = await db.from('kgp_qr_payments')
      .update({ last_checked_at: new Date().toISOString() }).eq('payment_id', payment.id)
      .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`).select('payment_id').maybeSingle()
    if (error) throw new PaymentError('ไม่สามารถตรวจสอบสถานะได้', 503)
    if (!data) return payment.status
  }
  const { ok, httpStatus, data } = await kgpRequest(`/api/v2/charge/${encodeURIComponent(record.reference_order)}`)
  if (httpStatus === 401 || httpStatus === 403) throw gatewayAuthenticationError(httpStatus)
  if (!ok || data.status !== 'success') {
    // These codes explicitly mean unpaid, processing, or no charge yet (spec pp. 22–23).
    if (['1008', '1017', '1022', '1025', '1028', '2001', '2002'].includes(String(data.failure_code))) return payment.status
    throw new PaymentError('ยังตรวจสอบผลจากผู้ให้บริการไม่ได้ กรุณาลองอีกครั้ง')
  }
  const charge = data as KgpCharge
  if (!matchesPaidCharge(charge, {
    amount: Number(payment.amount), reference: record.reference_order,
    qrId: record.qr_id, orderId: record.gateway_order_id,
  })) throw new PaymentError('ข้อมูลการชำระเงินไม่ตรงกับออเดอร์ กรุณาติดต่อผู้ดูแลระบบ', 409)

  const { error } = await db.from('payments').update({
    status: 'paid', provider_reference: charge.charge_id,
    paid_at: charge.authorized_datetime && Number.isFinite(Date.parse(charge.authorized_datetime))
      ? charge.authorized_datetime : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', payment.id).in('status', ['pending', 'failed', 'cancelled'])
  if (error) throw new PaymentError('บันทึกผลชำระเงินไม่ได้ กรุณาตรวจสอบอีกครั้ง', 503)
  const { data: saved, error: readError } = await db.from('payments').select('status').eq('id', payment.id).single()
  if (readError) throw new PaymentError('ไม่สามารถอ่านผลชำระเงินได้', 503)
  return saved.status as string
}

export async function createQrPayment(payment: QrPayment) {
  const config = kgpConfig()
  const db = createAdminClient()
  const existing = await readQrRecord(payment.id)
  if (payment.status !== 'pending') return existing
  let retryRecord: QrRecord | null = null
  if (existing) {
    if (existing.request_state === 'ready' || existing.qr_id || existing.gateway_order_id || existing.image_data_url) return existing
    if (existing.request_state === 'creating') {
      // Reuse the same merchant reference. If KGP created it despite a lost response,
      // its unique-reference check prevents a second payable QR.
      retryRecord = existing
    } else {
      const { data: removed, error } = await db.from('kgp_qr_payments').delete()
        .eq('payment_id', payment.id).eq('request_state', 'failed')
        .is('qr_id', null).is('gateway_order_id', null).select('payment_id').maybeSingle()
      if (error) throw new PaymentError('ไม่สามารถเริ่มชำระเงินใหม่ได้', 503)
      if (!removed) return readQrRecord(payment.id)
    }
  }
  const { data: order, error: orderError } = await db.from('orders').select('status').eq('id', payment.order_id).single()
  if (orderError || order.status === 'cancelled') throw new PaymentError('ออเดอร์นี้ไม่สามารถชำระเงินได้', 409)
  const createdAt = new Date()
  const record: QrRecord = retryRecord || {
    payment_id: payment.id, reference_order: createKgpReferenceOrder(createdAt),
    qr_id: null, gateway_order_id: null, image_data_url: null, account_name: null,
    expires_at: new Date(createdAt.getTime() + config.expireSeconds * 1000).toISOString(),
    request_state: 'creating', last_checked_at: null,
  }
  // A unique payment_id claims the request before calling KGP, including concurrent tabs/retries.
  if (!retryRecord) {
    const { error: claimError } = await db.from('kgp_qr_payments').insert(record)
    if (claimError?.code === '23505') return readQrRecord(payment.id)
    if (claimError) throw new PaymentError('ไม่สามารถเริ่มชำระเงินได้', 503)
  }
  const { ok, httpStatus, data } = await kgpRequest('/api/v2/qr', {
    created_datetime: createdAt.toISOString(), amount: Number(payment.amount), currency: 'THB',
    description: `Food order ${payment.order_id}`, source_type: 'ThaiQR',
    // KGP's parameter table says integer, but its Create QR request example serializes
    // this field as a string. Follow the example used by the UAT implementation.
    reference_order: record.reference_order, qr_expire_time: String(config.expireSeconds),
  })
  if (httpStatus === 401 || httpStatus === 403) {
    const { error } = await db.from('kgp_qr_payments').update({ request_state: 'failed' })
      .eq('payment_id', payment.id).eq('request_state', 'creating')
    if (error) throw new PaymentError('บันทึกผลการสร้าง QR ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ', 503)
    throw gatewayAuthenticationError(httpStatus)
  }
  if (!ok || data.status !== 'success') {
    const code = String(data.failure_code || '')
    // A received validation/business rejection is definitive. Internal and duplicate-reference
    // responses stay recoverable only with this same reference.
    if (httpStatus === 417 && !['1030', '1031', '5001', '9000', '9001', '9999'].includes(code)) {
      await db.from('kgp_qr_payments').update({ request_state: 'failed' })
        .eq('payment_id', payment.id).eq('reference_order', record.reference_order)
    }
    throw kgpFailureError(data, 'ยังสร้าง QR ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ')
  }
  const image = qrImageDataUrl(data.image_with_base64)
  if (data.reference_order !== record.reference_order || typeof data.qr_id !== 'string'
    || !data.qr_id || typeof data.order_id !== 'string' || !data.order_id || !image) {
    throw new PaymentError('ข้อมูล QR จากผู้ให้บริการไม่สมบูรณ์ กรุณาติดต่อผู้ดูแลระบบ')
  }
  const updated = {
    qr_id: data.qr_id, gateway_order_id: data.order_id, image_data_url: image,
    account_name: typeof data.account_name === 'string' ? data.account_name : null,
    expires_at: typeof data.expired_datetime === 'string' && Number.isFinite(Date.parse(data.expired_datetime))
      ? data.expired_datetime : record.expires_at,
    request_state: 'ready' as const,
  }
  const { error } = await db.from('kgp_qr_payments').update(updated).eq('payment_id', payment.id)
  if (error) throw new PaymentError('บันทึก QR ไม่สำเร็จ กรุณาตรวจสอบสถานะก่อนชำระเงิน', 503)
  return { ...record, ...updated }
}

export async function cancelQrAtGateway(payment: QrPayment, record: QrRecord) {
  if (!Object.hasOwn(record, 'gateway_cancelled_at')) throw new PaymentError('ระบบยกเลิกยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ', 503)
  if (record.gateway_cancelled_at) return
  if (!record.qr_id) throw new PaymentError('ยังยืนยันการสร้าง QR ไม่ได้ กรุณารอ QR หมดอายุแล้วลองยกเลิกอีกครั้ง', 409)
  const status = await reconcileQrPayment(payment, record, true)
  if (status === 'paid' || status === 'refunded') throw new PaymentError('ออเดอร์นี้ชำระเงินแล้ว ไม่สามารถยกเลิกได้', 409)
  const { ok, httpStatus, data } = await kgpRequest(`/api/v2/qr/cancel/${encodeURIComponent(record.qr_id)}`, {})
  if (httpStatus === 401 || httpStatus === 403) throw gatewayAuthenticationError(httpStatus)
  if (String(data.failure_code) === '2003') {
    // KGP may receive payment between the inquiry and the cancellation request.
    await reconcileQrPayment(payment, record, true)
    throw new PaymentError('QR นี้มีการชำระเงินแล้ว ไม่สามารถยกเลิกได้', 409)
  }
  const cancelled = ok && data.status === 'success' && data.qr_id === record.qr_id
  const alreadyInactive = httpStatus === 417 && ['2001', '2002'].includes(String(data.failure_code))
  if (!cancelled && !alreadyInactive) throw new PaymentError('ยังยกเลิก QR กับผู้ให้บริการไม่ได้ กรุณาลองอีกครั้ง')
  const { error } = await createAdminClient().from('kgp_qr_payments')
    .update({ gateway_cancelled_at: new Date().toISOString() })
    .eq('payment_id', payment.id).eq('reference_order', record.reference_order).eq('qr_id', record.qr_id)
  if (error) throw new PaymentError('บันทึกการยกเลิก QR ไม่สำเร็จ กรุณาลองอีกครั้ง', 503)
}

export function qrResponse(payment: QrPayment, record: QrRecord | null, status = payment.status) {
  const canRetry = record
    ? status === 'pending'
      && !record.qr_id
      && !record.gateway_order_id
      && !record.image_data_url
      && ['creating', 'failed'].includes(record.request_state)
    : false

  return {
    orderId: payment.order_id, amount: Number(payment.amount), status,
    qrImage: status === 'pending' && !record?.gateway_cancelled_at ? record?.image_data_url ?? null : null,
    accountName: record?.account_name ?? null,
    expiresAt: record?.expires_at ?? null,
    expired: Boolean(record && Date.parse(record.expires_at) <= Date.now()),
    processing: record?.request_state === 'creating',
    canRetry,
    qrCancelled: Boolean(record?.gateway_cancelled_at),
  }
}

export async function getQrPaymentState(payment: QrPayment, create = false) {
  let record = await readQrRecord(payment.id)
  try {
    if (create) record = await createQrPayment(payment)
    const status = !create && record ? await reconcileQrPayment(payment, record) : payment.status
    if (create) {
      // Cancellation can finish while Create QR is in flight. Never return a stale payable QR.
      const { data: current, error } = await createAdminClient().from('payments').select('status').eq('id', payment.id).single()
      if (error) throw new PaymentError('ไม่สามารถอ่านสถานะชำระเงินล่าสุดได้', 503)
      return { ...qrResponse(payment, record, current.status), verificationError: null }
    }
    return { ...qrResponse(payment, record, status), verificationError: null }
  } catch (error) {
    if (!(error instanceof PaymentError)) throw error
    if (create) record = await readQrRecord(payment.id)
    // A failed inquiry must not hide the saved QR/amount or claim that payment failed.
    return { ...qrResponse(payment, record), verificationError: error.message }
  }
}
