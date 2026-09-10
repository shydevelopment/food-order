-- Run payments_dashboard.sql first, then this entire file in Supabase SQL Editor.
begin;

alter table public.payments add column if not exists checkout_key uuid;
alter table public.payments add column if not exists checkout_fingerprint text;
create unique index if not exists payments_checkout_key_idx
  on public.payments(customer_id, checkout_key) where checkout_key is not null;
create unique index if not exists payments_kgp_charge_idx
  on public.payments(provider_reference) where provider = 'kgp' and provider_reference is not null;

create table if not exists public.kgp_qr_payments (
  payment_id uuid primary key references public.payments(id) on delete cascade,
  reference_order varchar(20) not null unique,
  qr_id text unique,
  gateway_order_id text unique,
  image_data_url text,
  account_name text,
  expires_at timestamptz not null,
  request_state text not null check (request_state in ('creating', 'ready', 'failed')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.kgp_qr_payments enable row level security;
revoke all on public.kgp_qr_payments from anon, authenticated;
grant all on public.kgp_qr_payments to service_role;

-- Serialize claiming a QR with order cancellation; a cancelled order must never get a new QR.
create or replace function public.guard_kgp_qr_claim() returns trigger
language plpgsql security definer set search_path = public as $$
declare target_order public.orders%rowtype;
begin
  select o.* into target_order from public.orders o join public.payments p on p.order_id = o.id
    where p.id = new.payment_id and p.method = 'qr' and p.status = 'pending' for update of o;
  if not found or target_order.status = 'cancelled' then raise exception 'Order cannot accept QR payment'; end if;
  return new;
end;
$$;
drop trigger if exists guard_kgp_qr_claim on public.kgp_qr_payments;
create trigger guard_kgp_qr_claim before insert on public.kgp_qr_payments
  for each row execute function public.guard_kgp_qr_claim();

-- Only the server may call this function. Prices and items come from the server's menu lookup.
-- Advisory lock + transaction prevent duplicate and partially created orders on retries.
create or replace function public.create_kgp_order(
  p_customer uuid, p_checkout_key uuid, p_fingerprint text, p_order jsonb, p_items jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  existing_payment public.payments%rowtype;
  new_order public.orders%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text || p_checkout_key::text, 0));
  select * into existing_payment from public.payments
    where customer_id = p_customer and checkout_key = p_checkout_key;
  if found then
    if existing_payment.checkout_fingerprint is distinct from p_fingerprint then
      raise exception 'CHECKOUT_CONFLICT';
    end if;
    select * into new_order from public.orders where id = existing_payment.order_id;
    return jsonb_build_object('id', new_order.id, 'order_no', new_order.order_no,
      'total_price', existing_payment.amount, 'created', false);
  end if;
  if (p_order->>'total_price')::numeric <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.orders(user_id, restaurant_id, total_price, status, delivery_address,
    pickup_time, pickup_note, needs_cutlery)
  select p_customer, r.restaurant_id, r.total_price, 'pending', r.delivery_address,
    r.pickup_time, r.pickup_note, false
  from jsonb_populate_record(null::public.orders, p_order) r
  returning * into new_order;
  insert into public.order_items(order_id, menu_id, custom_name, is_special, item_note, quantity, price)
  select new_order.id, r.menu_id, r.custom_name, r.is_special, r.item_note, r.quantity, r.price
  from jsonb_populate_recordset(null::public.order_items, p_items) r;
  insert into public.payments(order_id, restaurant_id, customer_id, method, status, amount,
    provider, checkout_key, checkout_fingerprint)
  values(new_order.id, new_order.restaurant_id, p_customer, 'qr', 'pending',
    new_order.total_price, 'kgp', p_checkout_key, p_fingerprint);
  return jsonb_build_object('id', new_order.id, 'order_no', new_order.order_no,
    'total_price', new_order.total_price, 'created', true);
end;
$$;
revoke all on function public.create_kgp_order(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_kgp_order(uuid, uuid, text, jsonb, jsonb) to service_role;

-- Existing restaurant UPDATE policies must not allow a browser to mark a QR payment as paid,
-- change its amount, or switch its method to cash to bypass provider verification.
create or replace function public.protect_kgp_payment() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.method = 'qr' or new.method = 'qr' then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'QR payments must be updated by the payment server';
    end if;
    if old.method = 'qr' and (new.amount is distinct from old.amount
      or new.method is distinct from old.method or new.order_id is distinct from old.order_id
      or new.customer_id is distinct from old.customer_id or new.provider is distinct from old.provider) then
      raise exception 'QR payment details are immutable';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_kgp_payment on public.payments;
create trigger protect_kgp_payment before update on public.payments
  for each row execute function public.protect_kgp_payment();

create or replace function public.protect_kgp_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare payment public.payments%rowtype;
begin
  select * into payment from public.payments where order_id = old.id and method = 'qr';
  if found then
    if new.total_price is distinct from old.total_price then
      raise exception 'Cannot change the amount of a QR order';
    end if;
    if new.status is distinct from old.status then
      if new.status in ('preparing', 'delivering', 'completed') and payment.status <> 'paid' then
        raise exception 'กรุณารอให้ลูกค้าชำระ QR ก่อนรับออเดอร์';
      end if;
      if new.status = 'cancelled' and payment.status = 'pending' and exists (
        select 1 from public.kgp_qr_payments where payment_id = payment.id and expires_at > now()
      ) then
        raise exception 'QR ยังใช้งานอยู่ กรุณารอ QR หมดอายุก่อนยกเลิก';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_kgp_order on public.orders;
create trigger protect_kgp_order before update on public.orders
  for each row execute function public.protect_kgp_order();
commit;
