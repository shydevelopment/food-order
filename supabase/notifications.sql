-- Create a persistent notifications table for /notifications.
-- Run this in Supabase SQL Editor before using persisted notification reads.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  type text not null check (type in ('order', 'chat')),
  title text not null,
  detail text not null,
  href text not null,
  tone text not null default 'orange' check (tone in ('orange', 'emerald', 'sky')),
  is_read boolean not null default false,
  source_created_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_key)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, source_created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
