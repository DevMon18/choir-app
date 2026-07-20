-- Create app_role enum
create type app_role as enum ('super_admin', 'director', 'treasurer', 'secretary', 'member', 'pending', 'rejected');

-- Profiles table (stores user roles and details linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null unique,
  role app_role not null default 'pending',
  created_at timestamptz not null default now()
);

-- Songs table
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  composer text,
  arranger text,
  category text,
  created_at timestamptz not null default now()
);

-- Mass Sequences table
create table public.mass_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Sequence Items table
create table public.sequence_items (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.mass_sequences on delete cascade,
  song_id uuid references public.songs on delete set null,
  position integer not null,
  role_in_mass text,
  created_at timestamptz not null default now()
);

-- Practice Tracks table
create table public.practice_tracks (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs on delete cascade,
  voice_part text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

-- Live Sessions table
create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamptz not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Member Dues table
create table public.member_dues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  amount numeric(10, 2) not null,
  due_date date not null,
  status text not null default 'unpaid' check (status in ('paid', 'unpaid', 'overdue')),
  created_at timestamptz not null default now()
);

-- Join Requests table
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  voice_part text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Super Admin Bootstrap Allowlist table
create table public.super_admin_bootstrap_allowlist (
  email text primary key
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.mass_sequences enable row level security;
alter table public.sequence_items enable row level security;
alter table public.practice_tracks enable row level security;
alter table public.live_sessions enable row level security;
alter table public.member_dues enable row level security;
alter table public.join_requests enable row level security;

-- Helper function to check if the caller is a Super Admin
create or replace function public.is_super_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() and p.role = 'super_admin'
  );
$$;

-- RLS Super Admin bypass policies
create policy "super_admin_bypass_profiles" on public.profiles for all using (public.is_super_admin());
create policy "super_admin_bypass_songs" on public.songs for all using (public.is_super_admin());
create policy "super_admin_bypass_mass_sequences" on public.mass_sequences for all using (public.is_super_admin());
create policy "super_admin_bypass_sequence_items" on public.sequence_items for all using (public.is_super_admin());
create policy "super_admin_bypass_practice_tracks" on public.practice_tracks for all using (public.is_super_admin());
create policy "super_admin_bypass_live_sessions" on public.live_sessions for all using (public.is_super_admin());
create policy "super_admin_bypass_member_dues" on public.member_dues for all using (public.is_super_admin());
create policy "super_admin_bypass_join_requests" on public.join_requests for all using (public.is_super_admin());

-- General role policies (Standard RLS for normal users & other roles)

-- Profiles general policies
create policy "users_view_own_profile" on public.profiles for select using (
  auth.uid() = id OR exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'secretary', 'super_admin')
  )
);
create policy "admins_update_profiles" on public.profiles for update using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'secretary', 'super_admin')
  )
);

-- Songs policies
create policy "authenticated_view_songs" on public.songs for select using (
  auth.role() = 'authenticated'
);
create policy "editors_modify_songs" on public.songs for all using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'secretary', 'super_admin')
  )
);

-- Mass Sequences policies
create policy "authenticated_view_sequences" on public.mass_sequences for select using (
  auth.role() = 'authenticated'
);
create policy "editors_modify_sequences" on public.mass_sequences for all using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'secretary', 'super_admin')
  )
);

-- Sequence Items policies
create policy "authenticated_view_sequence_items" on public.sequence_items for select using (
  auth.role() = 'authenticated'
);
create policy "editors_modify_sequence_items" on public.sequence_items for all using (
  exists (
    select 1 from public.profiles profiles_1
    where profiles_1.id = auth.uid() and profiles_1.role in ('director', 'secretary', 'super_admin')
  )
);

-- Practice Tracks policies
create policy "authenticated_view_tracks" on public.practice_tracks for select using (
  auth.role() = 'authenticated'
);
create policy "editors_modify_tracks" on public.practice_tracks for all using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'secretary', 'super_admin')
  )
);

-- Live Sessions policies
create policy "authenticated_view_sessions" on public.live_sessions for select using (
  auth.role() = 'authenticated'
);
create policy "editors_modify_sessions" on public.live_sessions for all using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'secretary', 'super_admin')
  )
);

-- Member Dues policies
create policy "members_view_own_dues" on public.member_dues for select using (
  auth.uid() = user_id OR exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'treasurer', 'super_admin')
  )
);
create policy "treasurer_modify_dues" on public.member_dues for all using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'treasurer', 'super_admin')
  )
);

-- Join Requests policies
create policy "editors_view_requests" on public.join_requests for select using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'secretary', 'super_admin')
  )
);
create policy "public_create_request" on public.join_requests for insert with check (
  true
);
create policy "editors_modify_requests" on public.join_requests for all using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('director', 'secretary', 'super_admin')
  )
);

-- Functions and Triggers for security constraints

-- 1. Prevent self privilege escalation
create or replace function public.prevent_self_privilege_escalation()
returns trigger as $$
declare
  actor_role app_role;
begin
  if new.role is distinct from old.role then
    select role into actor_role from public.profiles where id = auth.uid();
    
    if new.id = auth.uid() and actor_role is distinct from 'super_admin' then
      raise exception 'You cannot edit your own role';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_prevent_self_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_privilege_escalation();

-- 2. Role assignment hierarchy
create or replace function public.enforce_role_assignment_hierarchy()
returns trigger as $$
declare
  actor_role app_role;
begin
  -- Bypass hierarchy checks if run by system/service-role (no auth.uid context)
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role then
    select role into actor_role from public.profiles where id = auth.uid();

    if new.role = 'super_admin' and actor_role is distinct from 'super_admin' then
      raise exception 'Only a Super Admin can assign the Super Admin role';
    end if;

    if new.role = 'director' and actor_role is distinct from 'super_admin' then
      raise exception 'Only a Super Admin can assign the Director role';
    end if;

    if actor_role = 'secretary' and new.role not in ('member', 'rejected', 'pending') then
      raise exception 'Secretary can only approve, reject, or reset pending applicants';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_enforce_role_hierarchy
  before update on public.profiles
  for each row execute function public.enforce_role_assignment_hierarchy();

-- 3. Handle auth.users creation flow
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case
      when exists (select 1 from public.super_admin_bootstrap_allowlist where email = new.email)
      then 'super_admin'::public.app_role
      else 'pending'::public.app_role
    end
  );
  
  -- Consume the bootstrap match
  delete from public.super_admin_bootstrap_allowlist where email = new.email;
  
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RPC Function for listing pending users with confirmation status
create or replace function public.admin_list_pending_users()
returns table(profile_id uuid, full_name text, email text, email_confirmed boolean, created_at timestamptz)
language sql security definer set search_path = public as $$
  select p.id, p.full_name, p.email, (u.email_confirmed_at is not null), p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'pending'
    and exists (
      select 1 from public.profiles a 
      where a.id = auth.uid() and a.role in ('director','secretary','super_admin')
    );
$$;

revoke all on function public.admin_list_pending_users() from public;
grant execute on function public.admin_list_pending_users() to authenticated;

-- Storage Bypass Policy for Super Admin
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'storage' and tablename = 'objects' and policyname = 'super_admin_bypass_storage'
    ) then
      create policy "super_admin_bypass_storage" on storage.objects for all using (public.is_super_admin());
    end if;
  end if;
end $$;

