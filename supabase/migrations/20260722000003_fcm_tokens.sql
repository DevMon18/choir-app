-- Migration: FCM Tokens for Background Native Push Notifications
-- File: supabase/migrations/20260722000003_fcm_tokens.sql

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for fcm_tokens
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users insert own FCM tokens
CREATE POLICY "Users insert own FCM tokens"
ON public.fcm_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users delete own FCM tokens
CREATE POLICY "Users delete own FCM tokens"
ON public.fcm_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admins/system can select FCM tokens for broadcasting
CREATE POLICY "Admins select all FCM tokens"
ON public.fcm_tokens
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'director', 'secretary')
    )
);
