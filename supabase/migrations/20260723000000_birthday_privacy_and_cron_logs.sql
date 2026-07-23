-- Migration: Birthday Privacy Toggle & Cron Job Logs
-- File: supabase/migrations/20260723000000_birthday_privacy_and_cron_logs.sql

-- 1. Add is_birthdate_private column to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_birthdate_private BOOLEAN NOT NULL DEFAULT true;

-- 2. Create birthday_cron_logs table for explicit job tracking
CREATE TABLE IF NOT EXISTS public.birthday_cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN ('daily_birthday', 'monthly_summary')),
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    birthdays_found INTEGER NOT NULL DEFAULT 0,
    notifications_sent INTEGER NOT NULL DEFAULT 0,
    notifications_failed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on birthday_cron_logs
ALTER TABLE public.birthday_cron_logs ENABLE ROW LEVEL SECURITY;

-- Admins read policy for birthday_cron_logs
CREATE POLICY "Admins can view birthday cron logs"
ON public.birthday_cron_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'director', 'secretary')
    )
);
