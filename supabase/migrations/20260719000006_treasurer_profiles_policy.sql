-- Redefine security definer helper functions to bypass RLS recursion in policies

create or replace function public.is_super_admin()
returns boolean security definer stable as $$
  select exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() and p.role = 'super_admin'
  );
$$ language sql;

create or replace function public.has_admin_role()
returns boolean security definer stable as $$
  select exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() and p.role in ('super_admin', 'director', 'secretary', 'treasurer')
  );
$$ language sql;

-- Drop and recreate the SELECT policy using the security definer helper function
DROP POLICY IF EXISTS "users_view_own_profile" ON public.profiles;

CREATE POLICY "users_view_own_profile" ON public.profiles FOR SELECT USING (
  auth.uid() = id OR public.has_admin_role()
);

-- Drop and recreate update policy using the security definer helper function
DROP POLICY IF EXISTS "admins_update_profiles" ON public.profiles;

CREATE POLICY "admins_update_profiles" ON public.profiles FOR UPDATE USING (
  public.has_admin_role()
);
