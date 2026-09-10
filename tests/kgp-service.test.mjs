import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import ts from 'typescript'
import * as protocol from '../lib/kgp-protocol.ts'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../lib/kgp.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0X8AAAAASUVORK5CYII='
const payment = { id: 'payment', order_id: 'order', customer_id: 'customer', method: 'qr', status: 'pending', amount: 125.5 }
const record = {
  payment_id: 'payment', reference_order: 'reference', qr_id: 'qr', gateway_order_id: 'gateway-order',
  image_data_url: `data:image/png;base64,${png}`, account_name: 'Test merchant',
  expires_at: new Date(Date.now() + 600000).toISOString(), request_state: 'ready', last_checked_at: null,
  gateway_cancelled_at: null,
}

function harness(fetch, initialRecord = record) {
  const rows = { payments: [{ ...payment }], orders: [{ id: 'order', status: 'pending' }], kgp_qr_payments: initialRecord ? [{ ...initialRecord }] : [] }
  const db = { from(table) {
    let operation = 'read', values
    const filters = []
    const query = {
      select() { return query },
      eq(key, value) { filters.push(row => row[key] === value); return query },
      is(key, value) { filters.push(row => row[key] === value); return query },
      in(key, values) { filters.push(row => values.includes(row[key])); return query },
      or() { return query },
      insert(value) { operation = 'insert'; values = value; return query },
      update(value) { operation = 'update'; values = value; return query },
      delete() { operation = 'delete'; return query },
      async maybeSingle() { const result = await query; return { ...result, data: result.data?.[0] || null } },
      single() { return query.maybeSingle() },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          let matched = rows[table].filter(row => filters.every(filter => filter(row)))
          if (operation === 'insert') {
            if (rows[table].some(row => row.payment_id === values.payment_id)) return { data: null, error: { code: '23505' } }
            rows[table].push({ ...values }); matched = [values]
          } else if (operation === 'update') matched.forEach(row => Object.assign(row, values))
          else if (operation === 'delete') rows[table] = rows[table].filter(row => !matched.includes(row))
          return { data: matched.map(row => ({ ...row })), error: null }
        }).then(resolve, reject)
      },
    }
    return query
  } }
  const logs = []
  const testModule = { exports: {} }
  const localRequire = name => name === 'server-only' ? {}
    : name === '@/supabase/admin' ? { createAdminClient: () => db }
    : name === '@/lib/kgp-protocol' ? protocol : require(name)
  // Run the real service with isolated env/transport/database; never load .env or contact KGP.
  new Function('require', 'module', 'exports', 'process', 'fetch', 'console', compiled)(
    localRequire, testModule, testModule.exports,
    { env: { KGP_API_KEY: 'test-secret-do-not-log', KGP_API_BASE_URL: 'https://openapi-uat.kgppayments.com' } },
    fetch, { error: (...args) => logs.push(args) },
  )
  return { service: testModule.exports, rows, logs }
}

const unauthorized = () => Promise.resolve(Response.json({
  failure_code: '9999', failure_message: 'Authentication Fail test-secret-do-not-log',
}, { status: 401 }))

test('inquiry authentication failure preserves saved QR and reports a specific error without logging keys', async () => {
  const { service, rows, logs } = harness(unauthorized)
  const state = await service.getQrPaymentState(payment)
  assert.equal(state.amount, 125.5)
  assert.equal(state.qrImage, record.image_data_url)
  assert.equal(state.status, 'pending')
  assert.match(state.verificationError, /KGP 401/)
  assert.equal(rows.payments[0].status, 'pending')
  assert.equal(JSON.stringify(logs).includes('test-secret'), false)
})

test('an uncertain create is retryable only by explicit action and keeps its reference', async () => {
  const { service, rows } = harness(unauthorized, { ...record, request_state: 'creating', qr_id: null, gateway_order_id: null, image_data_url: null })
  const state = await service.getQrPaymentState(payment)
  assert.equal(state.canRetry, true)
  assert.equal(rows.kgp_qr_payments[0].request_state, 'creating')
})

test('explicitly rejected create can be retried, while a completed create is reused', async () => {
  let calls = 0
  const { service, rows } = harness(async (_url, options) => {
    calls++
    if (calls === 1) return unauthorized()
    const request = JSON.parse(options.body)
    return Response.json({ status: 'success', reference_order: request.reference_order,
      qr_id: 'new-qr', order_id: 'new-order', image_with_base64: png, account_name: 'Test merchant' })
  }, null)
  const failed = await service.getQrPaymentState(payment, true)
  assert.equal(failed.canRetry, true)
  assert.match(failed.verificationError, /KGP 401/)
  assert.equal(rows.kgp_qr_payments[0].request_state, 'failed')
  const retried = await service.getQrPaymentState(payment, true)
  assert.equal(retried.verificationError, null)
  assert.ok(retried.qrImage)
  await service.getQrPaymentState(payment, true)
  assert.equal(calls, 2)
  assert.equal(rows.kgp_qr_payments.length, 1)
})

test('Create QR follows KGP UAT example by serializing expiry seconds as a string', async () => {
  let request
  const { service } = harness(async (_url, options) => {
    request = JSON.parse(options.body)
    return Response.json({ status: 'success', reference_order: request.reference_order,
      qr_id: 'new-qr', order_id: 'new-order', image_with_base64: png, account_name: 'Test merchant' })
  }, null)
  const result = await service.getQrPaymentState(payment, true)
  assert.equal(result.verificationError, null)
  assert.equal(request.source_type, 'ThaiQR')
  assert.equal(request.currency, 'THB')
  assert.equal(request.qr_expire_time, '600')
  assert.equal(typeof request.qr_expire_time, 'string')
  assert.match(request.reference_order, /^\d{20}$/)
})

test('KGP reference matches the numeric Bangkok timestamp format used by the UAT example', () => {
  const value = harness(() => { throw new Error('not used') }).service.createKgpReferenceOrder(new Date('2026-09-09T03:04:05.000Z'))
  assert.match(value, /^20260909100405\d{6}$/)
})

test('create timeout retains its reference when an explicit retry resends the request', async () => {
  let calls = 0
  const references = []
  const { service, rows } = harness(async (_url, options) => {
    calls++
    references.push(JSON.parse(options.body).reference_order)
    throw new Error('timeout')
  }, null)
  const first = await service.getQrPaymentState(payment, true)
  const reference = rows.kgp_qr_payments[0].reference_order
  assert.equal(first.canRetry, true)
  await service.getQrPaymentState(payment, true)
  assert.equal(calls, 2)
  assert.deepEqual(references, [reference, reference])
  assert.equal(rows.kgp_qr_payments[0].reference_order, reference)
})

test('provider outage keeps existing QR usable and does not mark payment failed', async () => {
  const { service } = harness(async () => { throw new Error('offline') })
  const state = await service.getQrPaymentState(payment)
  assert.equal(state.status, 'pending')
  assert.equal(state.qrImage, record.image_data_url)
  assert.ok(state.verificationError)
})

test('payment ownership is checked before exposing an order', async () => {
  const { service } = harness(() => { throw new Error('must not contact gateway') })
  await assert.rejects(service.loadQrPayment('order', 'another-customer'), error => error.status === 404)
})

test('gateway cancellation first checks for payment and only records an exact confirmed QR', async () => {
  const requests = []
  const { service, rows } = harness(async (url, options) => {
    requests.push({ url, method: options.method })
    if (options.method === 'GET') return Response.json({ failure_code: '1028' }, { status: 417 })
    return Response.json({ qr_id: 'qr', status: 'success' })
  })
  await service.cancelQrAtGateway(payment, record)
  assert.equal(requests.length, 2)
  assert.ok(requests[1].url.endsWith('/api/v2/qr/cancel/qr'))
  assert.equal(requests[1].method, 'POST')
  assert.ok(rows.kgp_qr_payments[0].gateway_cancelled_at)
  assert.equal(rows.payments[0].status, 'pending') // Local order/payment cancellation is a separate atomic RPC.
})

test('gateway authentication failure and wrong QR response cannot authorize cancellation', async () => {
  const denied = harness(unauthorized)
  await assert.rejects(denied.service.cancelQrAtGateway(payment, record), /KGP 401/)
  assert.equal(denied.rows.kgp_qr_payments[0].gateway_cancelled_at, null)
  const wrong = harness(async (_url, options) => options.method === 'GET'
    ? Response.json({ failure_code: '1028' }, { status: 417 })
    : Response.json({ qr_id: 'another-qr', status: 'success' }))
  await assert.rejects(wrong.service.cancelQrAtGateway(payment, record), /ยังยกเลิก QR/)
  assert.equal(wrong.rows.kgp_qr_payments[0].gateway_cancelled_at, null)
})

test('payment winning the race at KGP prevents cancellation', async () => {
  let calls = 0
  const { service, rows } = harness(async (_url, options) => {
    calls++
    if (options.method === 'POST') return Response.json({ failure_code: '2003' }, { status: 417 })
    if (calls === 1) return Response.json({ failure_code: '1028' }, { status: 417 })
    return Response.json({ charge_id: 'charge', object: 'charge', status: 'success', amount: 125.5,
      currency: 'THB', transaction_state: 'Authorized', reference_order: 'reference', order_id: 'gateway-order',
      source: [{ source_id: 'qr', object: 'qr', brand: 'ThaiQR' }] })
  })
  await assert.rejects(service.cancelQrAtGateway(payment, record), /ชำระเงินแล้ว/)
  assert.equal(rows.payments[0].status, 'paid')
  assert.equal(rows.kgp_qr_payments[0].gateway_cancelled_at, null)
})
