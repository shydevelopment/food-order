insert into public.roles (role_name)
values ('student')
on conflict (role_name) do nothing;

update public.profiles
set
  role = 'student',
  username = regexp_replace(lower(split_part(trim(coalesce(email, '')), '@', 1)), '^s(?=[0-9])', '')
where lower(trim(coalesce(email, ''))) like '%@email.kmutnb.ac.th'
  and coalesce(role, 'customer') not in ('admin', 'restaurant');
