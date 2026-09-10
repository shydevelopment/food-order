import { createHash, timingSafeEqual } from 'node:crypto'

export interface KgpCharge {
  charge_id: string
  object: string
  amount: number
  currency: string
  status: string
  transaction_state: string
  reference_order: string
  order_id?: string
  source: { source_id: string; object: string; brand: string }[] | { source_id: string; object: string; brand: string }
  authorized_datetime?: string
  checksum?: string
}

export function verifyKgpChecksum(charge: KgpCharge, secret: string): boolean {
  if (!secret || typeof charge.amount !== 'number' || !Number.isFinite(charge.amount)
    || typeof charge.checksum !== 'string' || !/^[a-f\d]{64}$/i.test(charge.checksum)) return false
  const expected = createHash('sha256').update(
    `${charge.charge_id}${charge.amount.toFixed(4)}${charge.currency}${charge.status}${charge.transaction_state}${secret}`,
  ).digest()
  return timingSafeEqual(expected, Buffer.from(charge.checksum, 'hex'))
}

export function matchesPaidCharge(charge: KgpCharge, expected: {
  amount: number; reference: string; qrId: string | null; orderId: string | null
}): boolean {
  const sources = Array.isArray(charge.source) ? charge.source : [charge.source]
  return charge.object === 'charge'
    && typeof charge.charge_id === 'string' && charge.charge_id.length > 0
    && charge.status === 'success'
    && ['Authorized', 'Settled'].includes(charge.transaction_state)
    && charge.currency === 'THB'
    && typeof charge.amount === 'number' && Number.isFinite(charge.amount)
    && Math.abs(charge.amount - expected.amount) < 0.000001
    && charge.reference_order === expected.reference
    && (!expected.orderId || charge.order_id === expected.orderId)
    && sources.some(source => source?.object === 'qr' && source.brand === 'ThaiQR'
      && typeof source.source_id === 'string' && source.source_id.length > 0
      && (!expected.qrId || source.source_id === expected.qrId))
}

export function qrImageDataUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2_000_000) return null
  const raw = value.replace(/^data:image\/png;base64,/, '').replace(/\s/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) return null
  const bytes = Buffer.from(raw, 'base64')
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null
  return `data:image/png;base64,${raw}`
}
