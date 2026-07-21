-- Migration: Announcements and Push Subscriptions Tables
-- File: supabase/migrations/20260722000000_announcements_calendar_push.sql

-- 1. Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated non-pending/rejected users can select active announcements
CREATE POLICY "Active announcements readable by approved members"
ON public.announcements
FOR SELECT
TO authenticated
USING (
    (ends_at IS NULL OR ends_at >= now())
    AND starts_at <= now()
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('pending', 'rejected')
    )
);

-- Policy: Full management for privileged roles (super_admin, director, secretary)
CREATE POLICY "Admins full access to announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'director', 'secretary')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'director', 'secretary')
    )
);


-- 2. Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users insert own push subscription
CREATE POLICY "Users insert own push subscription"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own push subscription"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admins/system can select push subscriptions for broadcasting
CREATE POLICY "Admins select all push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'director', 'secretary')
    )
);
