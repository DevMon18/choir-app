-- Ensure handle_new_user properly handles Google OAuth metadata and fallback full_name
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    case
      when exists (select 1 from public.super_admin_bootstrap_allowlist where email = new.email)
      then 'super_admin'::public.app_role
      else 'pending'::public.app_role
    end
  )
  on conflict (id) do update set
    full_name = case 
      when public.profiles.full_name = '' or public.profiles.full_name is null 
      then excluded.full_name 
      else public.profiles.full_name 
    end;
  
  -- Consume the bootstrap match
  delete from public.super_admin_bootstrap_allowlist where email = new.email;
  
  return new;
end;
$$ language plpgsql security definer set search_path = public;
