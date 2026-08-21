create table if not exists public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null check (access_level in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

alter table public.restaurant_members enable row level security;

drop policy if exists "Admins can manage restaurant members" on public.restaurant_members;
create policy "Admins can manage restaurant members"
on public.restaurant_members
for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Restaurant members can read own access" on public.restaurant_members;
create policy "Restaurant members can read own access"
on public.restaurant_members
for select
using (user_id = auth.uid());
