alter table public.notifications
  add column if not exists order_id uuid;

update public.notifications as notification
set order_id = orders.id
from public.orders as orders
where notification.order_id is null
  and (
    notification.item_key = 'order-' || orders.id::text
    or notification.item_key like 'order-status-' || orders.id::text || '-%'
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_order_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_order_id_fkey
      foreign key (order_id)
      references public.orders(id)
      on delete cascade;
  end if;
end $$;

create index if not exists notifications_order_id_idx
  on public.notifications (order_id);
