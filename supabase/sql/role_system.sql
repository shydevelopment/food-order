-- Account roles are intentionally separate from restaurant permissions.
-- Account role: customer | student | restaurant | admin
-- Restaurant permission: restaurant_members.access_level = owner | staff

insert into public.roles (role_name)
values ('customer'), ('student'), ('restaurant'), ('admin')
on conflict (role_name) do nothing;

delete from public.roles
where role_name in ('teacher');

update public.profiles
set role = case
  when lower(coalesce(email, '')) like '%@email.kmutnb.ac.th' then 'student'
  else 'customer'
end
where role in ('teacher') or role is null;

update public.profiles
set role = 'student'
where lower(coalesce(email, '')) like '%@email.kmutnb.ac.th'
  and role = 'customer';

delete from public.restaurant_members
where user_id in (
  select id
  from public.profiles
  where role not in ('restaurant', 'admin')
);

update public.restaurants
set owner_id = null
where owner_id in (
  select id
  from public.profiles
  where role not in ('restaurant', 'admin')
);
