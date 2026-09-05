-- Migration: 20260906000001_add_new_song_submissions.sql
-- Description: Support member submissions for brand new songs with full lyrics & points

-- 1. Modify song_submissions to allow null song_id (for proposed new songs prior to creation)
ALTER TABLE public.song_submissions ALTER COLUMN song_id DROP NOT NULL;

-- 2. Add proposed song metadata columns
ALTER TABLE public.song_submissions 
  ADD COLUMN IF NOT EXISTS is_new_song BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proposed_title TEXT NULL,
  ADD COLUMN IF NOT EXISTS proposed_composer TEXT NULL,
  ADD COLUMN IF NOT EXISTS proposed_key TEXT NULL;

-- 3. Drop and recreate view member_leaderboard
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

-- 4. Enable security and permissions
GRANT SELECT ON public.member_leaderboard TO authenticated;
GRANT SELECT ON public.member_leaderboard TO anon;
