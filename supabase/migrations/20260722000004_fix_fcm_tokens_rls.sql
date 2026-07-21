-- Migration: Fix FCM Tokens RLS Policies
-- File: supabase/migrations/20260722000004_fix_fcm_tokens_rls.sql

-- Drop restrictive old policies if present
DROP POLICY IF EXISTS "Users insert own FCM tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users delete own FCM tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Admins select all FCM tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users manage own FCM tokens" ON public.fcm_tokens;

-- Policy: Authenticated users can manage (select, insert, update, delete) their own FCM tokens
CREATE POLICY "Users manage own FCM tokens"
ON public.fcm_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: System/Admins can read all FCM tokens for notification broadcasting
CREATE POLICY "Admins select all FCM tokens"
ON public.fcm_tokens
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'director', 'secretary', 'treasurer', 'member')
    )
);
