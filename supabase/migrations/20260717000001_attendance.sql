-- Create attendance_sessions table
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null default current_date,
  type text not null check (type in ('rehearsal', 'performance')),
  created_at timestamptz not null default now()
);

-- Create attendance_records table
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'excused')),
  created_at timestamptz not null default now(),
  constraint unique_session_member unique (session_id, profile_id)
);

-- Enable RLS
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

-- Policies for attendance_sessions
create policy "select_attendance_sessions" on public.attendance_sessions for select using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('super_admin', 'director', 'secretary', 'member')
  )
);

create policy "admin_manage_attendance_sessions" on public.attendance_sessions for all using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('super_admin', 'director', 'secretary')
  )
);

-- Policies for attendance_records
create policy "select_attendance_records" on public.attendance_records for select using (
  auth.uid() = profile_id OR exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('super_admin', 'director', 'secretary')
  )
);

create policy "admin_manage_attendance_records" on public.attendance_records for all using (
  exists (
    select 1 from public.profiles a 
    where a.id = auth.uid() and a.role in ('super_admin', 'director', 'secretary')
  )
);

-- 12-month auto-deletion trigger on join_requests inserts
create or replace function public.cleanup_expired_join_requests()
returns trigger as $$
begin
  delete from public.join_requests where created_at < now() - interval '12 months';
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace trigger trg_cleanup_join_requests
  before insert on public.join_requests
  for each row execute function public.cleanup_expired_join_requests();
