create sequence if not exists public.orders_order_no_seq start 1001;

alter table public.orders
add column if not exists order_no bigint;

with numbered_orders as (
  select
    id,
    row_number() over (order by created_at, id) + 1000 as generated_order_no
  from public.orders
  where order_no is null
)
update public.orders
set order_no = numbered_orders.generated_order_no
from numbered_orders
where orders.id = numbered_orders.id;

select setval(
  'public.orders_order_no_seq',
  greatest(coalesce((select max(order_no) from public.orders), 1000), 1000) + 1,
  false
);

alter table public.orders
alter column order_no set default nextval('public.orders_order_no_seq');

alter sequence public.orders_order_no_seq owned by public.orders.order_no;

create unique index if not exists orders_order_no_key
on public.orders(order_no);

alter table public.orders
alter column order_no set not null;
