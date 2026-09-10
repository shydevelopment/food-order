import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const customer = randomUUID()
const restaurant = randomUUID()
const menu = randomUUID()
let db

before(async () => {
  db = new PGlite()
  // Minimal surrounding application schema; run both real migrations against PostgreSQL.
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create role supabase_admin;
    create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';
    create table auth.users(id uuid primary key);
    create table profiles(id uuid primary key, role text);
    create table restaurants(id uuid primary key, owner_id uuid, email text);
    create table restaurant_members(restaurant_id uuid, user_id uuid);
    create table menus(id uuid primary key);
    create table orders(id uuid primary key default gen_random_uuid(), order_no serial,
      user_id uuid references auth.users(id), restaurant_id uuid references restaurants(id),
      total_price numeric(12,2), status text, delivery_address text, pickup_time time,
      pickup_note text, needs_cutlery boolean, created_at timestamptz default now());
    create table order_items(id uuid primary key default gen_random_uuid(),
      order_id uuid references orders(id) on delete cascade, menu_id uuid references menus(id),
      custom_name text, is_special boolean, item_note text,
      quantity integer check(quantity > 0), price numeric(12,2));
  `)
  await db.query('insert into auth.users values ($1)', [customer])
  await db.query('insert into restaurants(id) values ($1)', [restaurant])
  await db.query('insert into menus values ($1)', [menu])
  await db.exec(await readFile(new URL('../supabase/sql/payments_dashboard.sql', import.meta.url), 'utf8'))
  const migration = await readFile(new URL('../supabase/sql/kgp_qr_payments.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration) // Installation is rerunnable.
  const cancellation = await readFile(new URL('../supabase/sql/customer_order_cancellation.sql', import.meta.url), 'utf8')
  await db.exec(cancellation)
  await db.exec(cancellation)
})
after(async () => { await db?.close() })

async function cancelOrder(orderId, reference = null, userId = customer, reason = 'สั่งรายการผิด') {
  const { rows } = await db.query('select cancel_customer_order($1, $2, $3, $4) as result', [orderId, userId, reason, reference])
  return rows[0].result
}

async function qrReference(paymentId) {
  return (await db.query('select reference_order from kgp_qr_payments where payment_id = $1', [paymentId])).rows[0].reference_order
}

async function createOrder(key = randomUUID(), fingerprint = 'same-cart', itemMenu = menu) {
  const { rows } = await db.query('select create_kgp_order($1, $2, $3, $4, $5) as result', [
    customer, key, fingerprint,
    JSON.stringify({ restaurant_id: restaurant, total_price: 125.5, delivery_address: 'pickup', pickup_time: '12:30', pickup_note: null }),
    JSON.stringify([{ menu_id: itemMenu, quantity: 2, price: 62.75, is_special: false }]),
  ])
  return rows[0].result
}

async function claim(orderId) {
  const { rows } = await db.query(`insert into kgp_qr_payments(payment_id, reference_order, expires_at, request_state)
    select id, $2, now() + interval '10 minutes', 'creating' from payments where order_id = $1 returning payment_id`,
  [orderId, randomUUID().replaceAll('-', '').slice(0, 20)])
  return rows[0].payment_id
}

test('checkout retry reuses exactly one complete order and rejects a changed cart', async () => {
  const key = randomUUID()
  const [first, second] = await Promise.all([createOrder(key), createOrder(key)])
  assert.equal(first.id, second.id)
  assert.equal(first.created, true)
  assert.equal(second.created, false)
  const { rows } = await db.query('select count(*)::int as count from order_items where order_id = $1', [first.id])
  assert.equal(rows[0].count, 1)
  await assert.rejects(createOrder(key, 'changed-cart'), /CHECKOUT_CONFLICT/)
})

test('failed item insert rolls back order and payment together', async () => {
  const before = await db.query('select count(*)::int as count from orders')
  await assert.rejects(createOrder(randomUUID(), 'bad-menu', randomUUID()), /foreign key/)
  const after = await db.query('select count(*)::int as count from orders')
  assert.equal(after.rows[0].count, before.rows[0].count)
})

test('unpaid QR cannot be accepted, and a live QR cannot be cancelled', async () => {
  const order = await createOrder()
  await assert.rejects(db.query("update orders set status = 'preparing' where id = $1", [order.id]), /ชำระ QR/)
  const paymentId = await claim(order.id)
  await assert.rejects(claim(order.id), /unique constraint/)
  await assert.rejects(db.query("update orders set status = 'cancelled' where id = $1", [order.id]), /หมดอายุ/)
  await db.query("update payments set status = 'paid' where id = $1", [paymentId])
  await db.query("update orders set status = 'preparing' where id = $1", [order.id])
  const { rows } = await db.query('select status from orders where id = $1', [order.id])
  assert.equal(rows[0].status, 'preparing')
})

test('cancelled orders cannot claim a new QR, while expired QR orders can be cancelled', async () => {
  const order = await createOrder()
  const paymentId = await claim(order.id)
  await db.query("update kgp_qr_payments set expires_at = now() - interval '1 second' where payment_id = $1", [paymentId])
  await db.query("update orders set status = 'cancelled' where id = $1", [order.id])
  const other = await createOrder()
  await db.query("update orders set status = 'cancelled' where id = $1", [other.id])
  await assert.rejects(claim(other.id), /cannot accept QR/)
})

test('QR amount and method are immutable, and clients cannot execute checkout RPC', async () => {
  const order = await createOrder()
  await assert.rejects(db.query('update payments set amount = 1 where order_id = $1', [order.id]), /immutable/)
  await assert.rejects(db.query("update payments set method = 'cash' where order_id = $1", [order.id]), /immutable/)
  await assert.rejects(db.query('update orders set total_price = 1 where id = $1', [order.id]), /Cannot change/)
  await db.exec('set role authenticated')
  try { await assert.rejects(createOrder(), /permission denied/) }
  finally { await db.exec('reset role') }
})

test('browser payment updates cannot bypass provider verification even with a permissive policy', async () => {
  const order = await createOrder()
  await db.exec(`grant usage on schema public to authenticated;
    grant select, update on payments to authenticated;
    create policy test_permissive on payments for all to authenticated using (true) with check (true);
    set role authenticated;`)
  try {
    await assert.rejects(db.query("update payments set status = 'paid' where order_id = $1", [order.id]), /payment server/)
    await assert.rejects(db.query('select * from kgp_qr_payments'), /permission denied/)
  } finally { await db.exec('reset role; drop policy test_permissive on payments;') }
})

test('customer cancels an unissued unpaid order and payment atomically; retries are idempotent', async () => {
  const order = await createOrder()
  await cancelOrder(order.id)
  const { rows } = await db.query(`select o.status, o.cancelled_at, o.cancelled_by, p.status as payment_status
    from orders o join payments p on p.order_id = o.id where o.id = $1`, [order.id])
  assert.equal(rows[0].status, 'cancelled')
  assert.equal(rows[0].payment_status, 'cancelled')
  assert.equal(rows[0].cancelled_by, customer)
  assert.equal((await db.query('select cancellation_reason from orders where id = $1', [order.id])).rows[0].cancellation_reason, 'สั่งรายการผิด')
  const originalTime = rows[0].cancelled_at
  await cancelOrder(order.id)
  assert.equal((await db.query('select cancelled_at from orders where id = $1', [order.id])).rows[0].cancelled_at.getTime(), originalTime.getTime())
  await assert.rejects(claim(order.id), /cannot accept QR/)
})

test('customers cannot cancel another user, paid, refunded, or completed order', async () => {
  const order = await createOrder()
  await assert.rejects(cancelOrder(order.id, null, randomUUID()), /ORDER_NOT_FOUND/)
  await db.query("update payments set status = 'paid' where order_id = $1", [order.id])
  await assert.rejects(cancelOrder(order.id), /ORDER_ALREADY_PAID/)
  await db.query("update orders set status = 'completed' where id = $1", [order.id])
  await db.query("update payments set status = 'refunded' where order_id = $1", [order.id])
  await assert.rejects(cancelOrder(order.id), /ORDER_ALREADY_PAID/)
  await db.query("update payments set status = 'pending' where order_id = $1", [order.id])
  await assert.rejects(cancelOrder(order.id), /ORDER_NOT_CANCELLABLE/)
})

test('issued QR requires gateway cancellation; newly arrived payment prevents local cancellation', async () => {
  const order = await createOrder()
  const id = await claim(order.id)
  const reference = await qrReference(id)
  await db.query("update kgp_qr_payments set qr_id = $2, request_state = 'ready' where payment_id = $1", [id, randomUUID()])
  await assert.rejects(cancelOrder(order.id, reference), /QR_CANCEL_REQUIRED/)
  await db.query('update kgp_qr_payments set gateway_cancelled_at = now() where payment_id = $1', [id])
  await db.query("update payments set status = 'paid' where id = $1", [id])
  await assert.rejects(cancelOrder(order.id, reference), /ORDER_ALREADY_PAID/)
  assert.equal((await db.query('select status from orders where id = $1', [order.id])).rows[0].status, 'pending')
})

test('gateway-confirmed QR cancellation succeeds without waiting for expiry', async () => {
  const order = await createOrder()
  const id = await claim(order.id)
  await db.query('update kgp_qr_payments set qr_id = $2, gateway_cancelled_at = now() where payment_id = $1', [id, randomUUID()])
  assert.equal((await cancelOrder(order.id, await qrReference(id))).status, 'cancelled')
})

test('failed creates cancel immediately; unknown creates wait until expiry and retain their reference', async () => {
  const order = await createOrder()
  const id = await claim(order.id)
  const reference = await qrReference(id)
  await assert.rejects(cancelOrder(order.id, reference), /QR_CREATION_PENDING/)
  await db.query("update kgp_qr_payments set expires_at = now() - interval '1 second' where payment_id = $1", [id])
  await cancelOrder(order.id, reference)
  assert.equal(await qrReference(id), reference)
  const failed = await createOrder()
  const failedId = await claim(failed.id)
  await db.query("update kgp_qr_payments set request_state = 'failed' where payment_id = $1", [failedId])
  assert.equal((await cancelOrder(failed.id, await qrReference(failedId))).status, 'cancelled')
})

test('a QR created after the API snapshot prevents cancellation with a stale reference', async () => {
  const order = await createOrder()
  await claim(order.id)
  await assert.rejects(cancelOrder(order.id), /QR_CHANGED/)
})

test('failed order update rolls back payment cancellation', async () => {
  const order = await createOrder()
  await db.exec(`create function test_reject_cancel() returns trigger language plpgsql as $$
    begin raise exception 'TEST_ORDER_WRITE_FAILED'; end $$;
    create trigger test_reject_cancel before update on orders for each row execute function test_reject_cancel();`)
  try { await assert.rejects(cancelOrder(order.id), /TEST_ORDER_WRITE_FAILED/) }
  finally { await db.exec('drop trigger test_reject_cancel on orders; drop function test_reject_cancel();') }
  assert.equal((await db.query('select status from payments where order_id = $1', [order.id])).rows[0].status, 'pending')
})

test('unpaid cash orders can be cancelled and the cancellation RPC is server-only', async () => {
  const id = randomUUID()
  await db.query("insert into orders(id, user_id, restaurant_id, status, total_price) values ($1, $2, $3, 'preparing', 55)", [id, customer, restaurant])
  await db.query("insert into payments(order_id, customer_id, restaurant_id, method, amount) values ($1, $2, $3, 'cash', 55)", [id, customer, restaurant])
  await db.exec('set role authenticated')
  try { await assert.rejects(cancelOrder(id), /permission denied/) }
  finally { await db.exec('reset role') }
  assert.equal((await cancelOrder(id)).status, 'cancelled')
})

test('cancellation reason is mandatory, bounded, and unchanged by an idempotent retry', async () => {
  const order = await createOrder()
  await assert.rejects(cancelOrder(order.id, null, customer, '  '), /INVALID_CANCELLATION_REASON/)
  await assert.rejects(cancelOrder(order.id, null, customer, 'x'.repeat(201)), /INVALID_CANCELLATION_REASON/)
  await cancelOrder(order.id, null, customer, '  เปลี่ยนใจแล้ว  ')
  await cancelOrder(order.id, null, customer, 'เหตุผลใหม่')
  const { rows } = await db.query('select cancellation_reason from orders where id = $1', [order.id])
  assert.equal(rows[0].cancellation_reason, 'เปลี่ยนใจแล้ว')
})
