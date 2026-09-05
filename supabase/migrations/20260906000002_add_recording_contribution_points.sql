-- Migration: 20260906000002_add_recording_contribution_points.sql
-- Description: Add points for audio practice track & voice guide contributions

-- 1. Insert audio recording canonical points (2 points reward)
INSERT INTO public.mass_part_points (mass_part, display_name, points, sort_order)
VALUES ('audio_recording', 'Audio Practice Recording', 2, 14)
ON CONFLICT (mass_part) DO UPDATE 
SET points = 2, display_name = 'Audio Practice Recording', sort_order = 14;

-- 2. Link practice_tracks and song_submissions
ALTER TABLE public.song_submissions
  ADD COLUMN IF NOT EXISTS recording_id UUID NULL REFERENCES public.practice_tracks(id) ON DELETE SET NULL;

ALTER TABLE public.practice_tracks
  ADD COLUMN IF NOT EXISTS points_awarded INTEGER NULL DEFAULT 2;

-- 3. Refresh member_leaderboard view
DROP VIEW IF EXISTS public.member_leaderboard CASCADE;

CREATE VIEW public.member_leaderboard AS
SELECT
  p.id AS member_id,
  p.full_name,
  p.avatar_url,
  p.role,
  p.voice_part,
  COALESCE(SUM(s.points_awarded), 0)::INTEGER AS total_points,
  COUNT(s.id)::INTEGER AS approved_contributions,
  MAX(s.reviewed_at) AS last_awarded_at
FROM public.profiles p
LEFT JOIN public.song_submissions s 
  ON s.submitted_by = p.id AND s.status = 'approved'
GROUP BY p.id, p.full_name, p.avatar_url, p.role, p.voice_part;

GRANT SELECT ON public.member_leaderboard TO authenticated;
GRANT SELECT ON public.member_leaderboard TO anon;
