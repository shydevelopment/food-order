import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { matchesPaidCharge, qrImageDataUrl, verifyKgpChecksum } from '../lib/kgp-protocol.ts'

const secret = 'unit-test-secret-not-a-merchant-key'
const charge = {
  charge_id: 'charge-1', object: 'charge', amount: 200.5, currency: 'THB', status: 'success',
  transaction_state: 'Authorized', reference_order: 'order-reference', order_id: 'gateway-order',
  source: [{ source_id: 'qr-1', object: 'qr', brand: 'ThaiQR' }],
}
const expected = { amount: 200.5, reference: 'order-reference', qrId: 'qr-1', orderId: 'gateway-order' }
const signed = { ...charge, checksum: createHash('sha256').update(`charge-1200.5000THBsuccessAuthorized${secret}`).digest('hex') }

test('checksum uses SHA-256, exact field order, and four decimal places', () => {
  assert.equal(verifyKgpChecksum(signed, secret), true)
  assert.equal(verifyKgpChecksum(signed, 'wrong-secret'), false)
  for (const changed of [{ amount: 200.51 }, { currency: 'USD' }, { status: 'fail' }, { charge_id: 'other' }, { transaction_state: 'Settled' }]) {
    assert.equal(verifyKgpChecksum({ ...signed, ...changed }, secret), false)
  }
})

test('invalid checksums and malformed amounts fail closed without throwing', () => {
  for (const checksum of ['', 'x'.repeat(64), 'a'.repeat(63), undefined, 123]) {
    assert.equal(verifyKgpChecksum({ ...charge, checksum }, secret), false)
  }
  for (const amount of [NaN, Infinity, '200.5', null]) {
    assert.equal(verifyKgpChecksum({ ...signed, amount }, secret), false)
  }
})

test('only a successful THB charge for this amount, order and QR is accepted', () => {
  assert.equal(matchesPaidCharge(charge, expected), true)
  assert.equal(matchesPaidCharge({ ...charge, source: charge.source[0], transaction_state: 'Settled' }, expected), true)
  for (const changed of [
    { object: 'qr' }, { amount: 200.501 }, { amount: '200.5' }, { status: 'fail' }, { currency: 'USD' },
    { transaction_state: 'Refunded' }, { transaction_state: 'Voided' }, { charge_id: '' },
    { reference_order: 'another-customer' }, { order_id: 'another-order' }, { source: [] },
    { source: [{ source_id: 'wrong-qr', object: 'qr', brand: 'ThaiQR' }] },
  ]) assert.equal(matchesPaidCharge({ ...charge, ...changed }, expected), false)
})

test('checksum alone cannot establish ownership: reference is not signed by KGP', () => {
  const substituted = { ...signed, reference_order: 'another-customer' }
  assert.equal(verifyKgpChecksum(substituted, secret), true)
  assert.equal(matchesPaidCharge(substituted, expected), false)
})

test('a lost create response can reconcile using the saved merchant reference', () => {
  assert.equal(matchesPaidCharge(charge, { ...expected, qrId: null, orderId: null }), true)
  assert.equal(matchesPaidCharge({ ...charge, amount: 1 }, { ...expected, qrId: null, orderId: null }), false)
})

test('only inline PNG data is accepted, never arbitrary provider URLs or SVG', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0X8AAAAASUVORK5CYII='
  assert.equal(qrImageDataUrl(png), `data:image/png;base64,${png}`)
  assert.equal(qrImageDataUrl(`data:image/png;base64,${png}`), `data:image/png;base64,${png}`)
  for (const value of [null, '', 'https://example.com/image?key=secret', 'data:image/svg+xml;base64,PHN2Zz4=', 'abcd', '<svg/>']) {
    assert.equal(qrImageDataUrl(value), null)
  }
})
