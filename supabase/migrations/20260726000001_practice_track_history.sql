-- Migration: Practice Track History Audit Log
-- Date: 2026-07-26

CREATE TABLE IF NOT EXISTS public.practice_track_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'CREATED', 'OVERWROTE', 'DELETED'
  voicing_label TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploader_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_track_history_song_id ON public.practice_track_history(song_id);

-- Enable RLS
ALTER TABLE public.practice_track_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_view_track_history" ON public.practice_track_history;
DROP POLICY IF EXISTS "members_insert_track_history" ON public.practice_track_history;
DROP POLICY IF EXISTS "admins_delete_track_history" ON public.practice_track_history;

CREATE POLICY "authenticated_view_track_history" ON public.practice_track_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "members_insert_track_history" ON public.practice_track_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "admins_delete_track_history" ON public.practice_track_history
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles a
      WHERE a.id = auth.uid() AND a.role IN ('super_admin', 'director')
    )
  );
