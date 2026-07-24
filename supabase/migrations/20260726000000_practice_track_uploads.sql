-- Migration: Practice Track Uploads & In-Browser Audio Recording Support
-- Date: 2026-07-26

-- 1. Track who uploaded each recording (needed so members can delete their own)
ALTER TABLE public.practice_tracks
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Optional label (e.g. "Verse 1 run-through", "Full song - take 2")
ALTER TABLE public.practice_tracks
  ADD COLUMN IF NOT EXISTS label TEXT;

CREATE INDEX IF NOT EXISTS idx_practice_tracks_song_id ON public.practice_tracks(song_id);
CREATE INDEX IF NOT EXISTS idx_practice_tracks_uploaded_by ON public.practice_tracks(uploaded_by);

-- 3. Replace the existing editors-only write policy: any approved member
--    can insert their OWN recording; director/secretary/super_admin can
--    do anything (including deleting anyone's, for moderation)
DROP POLICY IF EXISTS "editors_modify_tracks" ON public.practice_tracks;

CREATE POLICY "members_insert_own_practice_track" ON public.practice_tracks
  FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role NOT IN ('pending', 'rejected')
    )
  );

CREATE POLICY "owner_or_admin_delete_practice_track" ON public.practice_tracks
  FOR DELETE
  USING (
    auth.uid() = uploaded_by
    OR EXISTS (
      SELECT 1 FROM public.profiles a
      WHERE a.id = auth.uid() AND a.role IN ('super_admin', 'director', 'secretary')
    )
  );

CREATE POLICY "admin_update_practice_track" ON public.practice_tracks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles a
      WHERE a.id = auth.uid() AND a.role IN ('super_admin', 'director', 'secretary')
    )
  );

-- authenticated_view_tracks (SELECT policy) already exists from init — leave it as-is.

-- 4. Storage bucket for the actual audio files (mirrors the existing
--    avatars/profile_photos bucket pattern in
--    20260722000001_avatars_storage_bucket.sql / 20260724000000_profile_photos.sql)
INSERT INTO storage.buckets (id, name, public)
VALUES ('practice_tracks', 'practice_tracks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read access for practice_tracks bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload access for practice_tracks bucket" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete access for practice_tracks bucket" ON storage.objects;

CREATE POLICY "Public read access for practice_tracks bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'practice_tracks');

CREATE POLICY "Authenticated upload access for practice_tracks bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'practice_tracks' AND auth.uid() IS NOT NULL);

CREATE POLICY "Owner or admin delete access for practice_tracks bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'practice_tracks' AND (
      auth.uid() IS NOT NULL
    )
  );
