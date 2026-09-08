create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete set null,
  method text not null check (method in ('cash', 'qr', 'card')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  amount numeric(12, 2) not null check (amount >= 0),
  provider text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_restaurant_created_at_idx
  on public.payments (restaurant_id, created_at desc);

create index if not exists payments_status_created_at_idx
  on public.payments (status, created_at desc);

insert into public.payments (
  order_id,
  restaurant_id,
  customer_id,
  method,
  status,
  amount,
  created_at,
  updated_at
)
select
  orders.id,
  orders.restaurant_id,
  orders.user_id,
  'cash',
  case when orders.status = 'cancelled' then 'cancelled' else 'pending' end,
  orders.total_price,
  orders.created_at,
  now()
from public.orders
on conflict (order_id) do nothing;

alter table public.payments enable row level security;

create or replace function public.can_access_restaurant_payments(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  )
  or exists (
    select 1
    from public.restaurants
    where id = target_restaurant_id
      and (owner_id = auth.uid() or email = auth.jwt() ->> 'email')
  )
  or exists (
    select 1
    from public.restaurant_members
    where restaurant_id = target_restaurant_id and user_id = auth.uid()
  );
$$;

revoke all on function public.can_access_restaurant_payments(uuid) from public;
grant execute on function public.can_access_restaurant_payments(uuid) to authenticated;

drop policy if exists payments_read_own_or_restaurant on public.payments;
create policy payments_read_own_or_restaurant
  on public.payments
  for select
  to authenticated
  using (
    customer_id = auth.uid()
    or public.can_access_restaurant_payments(restaurant_id)
  );

drop policy if exists payments_update_restaurant on public.payments;
create policy payments_update_restaurant
  on public.payments
  for update
  to authenticated
  using (public.can_access_restaurant_payments(restaurant_id))
  with check (public.can_access_restaurant_payments(restaurant_id));
