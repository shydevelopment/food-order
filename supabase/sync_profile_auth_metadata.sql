begin;

-- Backfill Auth metadata from public.profiles so Supabase Auth "Display name"
-- matches the app profile full_name for existing users.
update auth.users as auth_user
set raw_user_meta_data =
  coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
  || jsonb_strip_nulls(
    jsonb_build_object(
      'username', profile.username,
      'full_name', profile.full_name,
      'display_name', profile.full_name,
      'phone', profile.phone,
      'student_id', profile.student_id,
      'role', profile.role
    )
  )
from public.profiles as profile
where auth_user.id = profile.id;

create or replace function public.sync_profile_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_strip_nulls(
      jsonb_build_object(
        'username', new.username,
        'full_name', new.full_name,
        'display_name', new.full_name,
        'phone', new.phone,
        'student_id', new.student_id,
        'role', new.role
      )
    )
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists sync_profile_auth_metadata_on_profiles on public.profiles;

create trigger sync_profile_auth_metadata_on_profiles
after insert or update of username, full_name, phone, student_id, role
on public.profiles
for each row
execute function public.sync_profile_auth_metadata();

commit;
