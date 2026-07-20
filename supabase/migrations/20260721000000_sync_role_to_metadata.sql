-- 20260721000000_sync_role_to_metadata.sql

-- 1. Create the sync function
create or replace function public.sync_profile_role_to_user_metadata()
returns trigger as $$
begin
  update auth.users
  set raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

-- 2. Create the trigger on public.profiles
create or replace trigger trg_sync_profile_role_to_user_metadata
  after insert or update of role on public.profiles
  for each row
  execute function public.sync_profile_role_to_user_metadata();

-- 3. Backfill all existing users
update auth.users u
set raw_app_meta_data = 
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
from public.profiles p
where u.id = p.id;
