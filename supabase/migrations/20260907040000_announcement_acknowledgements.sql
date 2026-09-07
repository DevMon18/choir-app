-- Migration: Announcement Acknowledgements
-- File: supabase/migrations/20260907040000_announcement_acknowledgements.sql

CREATE TABLE IF NOT EXISTS public.announcement_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_announcement_member_ack UNIQUE (announcement_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_acks_announcement ON public.announcement_acknowledgements(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_acks_member ON public.announcement_acknowledgements(member_id);

-- Enable RLS
ALTER TABLE public.announcement_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select announcement acknowledgements" ON public.announcement_acknowledgements;
CREATE POLICY "Select announcement acknowledgements" ON public.announcement_acknowledgements
FOR SELECT TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Insert own announcement acknowledgement" ON public.announcement_acknowledgements;
CREATE POLICY "Insert own announcement acknowledgement" ON public.announcement_acknowledgements
FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "Delete own announcement acknowledgement" ON public.announcement_acknowledgements;
CREATE POLICY "Delete own announcement acknowledgement" ON public.announcement_acknowledgements
FOR DELETE TO authenticated
USING (member_id = auth.uid());
