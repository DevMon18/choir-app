-- Migration: Allow users to update their own profile row
-- File: supabase/migrations/20260722000005_users_update_own_profile.sql

-- Drop existing policy if present to avoid conflicts
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

-- Policy: Allow authenticated users to update their own profiles record
CREATE POLICY "users_update_own_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
