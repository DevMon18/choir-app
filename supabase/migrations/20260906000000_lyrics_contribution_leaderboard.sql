-- Migration: 20260906000000_lyrics_contribution_leaderboard.sql
-- Description: Schema and policies for Lyrics Contribution & Leaderboard

-- 1. Reference table for Mass Part point values
CREATE TABLE IF NOT EXISTS public.mass_part_points (
  mass_part TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Seed canonical Mass Parts & exact point allocations
INSERT INTO public.mass_part_points (mass_part, display_name, points, sort_order)
VALUES
  ('entrance_song', 'Entrance Song', 1, 1),
  ('kyrie', 'Kyrie', 2, 2),
  ('gloria', 'Gloria', 1, 3),
  ('responsorial_psalm', 'Responsorial Psalm', 1, 4),
  ('gospel_acclamation', 'Gospel Acclamation', 2, 5),
  ('offertory', 'Offertory / Presentation', 1, 6),
  ('sanctus', 'Sanctus', 1, 7),
  ('memorial_acclamation', 'Memorial Acclamation', 1, 8),
  ('great_amen', 'Great Amen', 2, 9),
  ('lords_prayer', 'Lord''s Prayer', 1, 10),
  ('lamb_of_god', 'Lamb of God', 1, 11),
  ('communion_song', 'Communion Song', 2, 12),
  ('recessional_song', 'Recessional / Closing', 1, 13)
ON CONFLICT (mass_part) DO UPDATE
SET points = EXCLUDED.points, display_name = EXCLUDED.display_name, sort_order = EXCLUDED.sort_order;

-- 2. Song Submissions Table
CREATE TABLE IF NOT EXISTS public.song_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mass_part TEXT NOT NULL REFERENCES public.mass_part_points(mass_part) ON UPDATE CASCADE,
  lyrics_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded INTEGER NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_song_submissions_song_mass_part ON public.song_submissions(song_id, mass_part);
CREATE INDEX IF NOT EXISTS idx_song_submissions_submitted_by ON public.song_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_song_submissions_status ON public.song_submissions(status);
CREATE INDEX IF NOT EXISTS idx_song_submissions_reviewed_at ON public.song_submissions(reviewed_at);

-- Partial Unique Index: Only ONE active approved contribution per (song_id, mass_part)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_approved_song_mass_part
  ON public.song_submissions (song_id, mass_part)
  WHERE status = 'approved';

-- 3. Enable RLS
ALTER TABLE public.mass_part_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_submissions ENABLE ROW LEVEL SECURITY;

-- Mass part points policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mass_part_points' AND policyname = 'authenticated_view_mass_part_points') THEN
    CREATE POLICY "authenticated_view_mass_part_points" ON public.mass_part_points
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mass_part_points' AND policyname = 'directors_modify_mass_part_points') THEN
    CREATE POLICY "directors_modify_mass_part_points" ON public.mass_part_points
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('director', 'super_admin')
        )
      );
  END IF;

  -- Song submissions policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'song_submissions' AND policyname = 'members_view_submissions') THEN
    CREATE POLICY "members_view_submissions" ON public.song_submissions
      FOR SELECT USING (
        submitted_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('director', 'super_admin')
        ) OR
        status = 'approved'
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'song_submissions' AND policyname = 'members_insert_own_submissions') THEN
    CREATE POLICY "members_insert_own_submissions" ON public.song_submissions
      FOR INSERT WITH CHECK (
        submitted_by = auth.uid()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'song_submissions' AND policyname = 'directors_update_submissions') THEN
    CREATE POLICY "directors_update_submissions" ON public.song_submissions
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('director', 'super_admin')
        )
      );
  END IF;
END $$;

-- 4. Dynamic Aggregated Leaderboard View
CREATE OR REPLACE VIEW public.member_leaderboard AS
SELECT
  p.id AS member_id,
  p.full_name,
  p.role,
  p.avatar_url,
  COALESCE(SUM(s.points_awarded), 0)::INTEGER AS total_points,
  COUNT(s.id)::INTEGER AS approved_contributions_count,
  MAX(s.reviewed_at) AS most_recent_contribution
FROM public.profiles p
JOIN public.song_submissions s ON s.submitted_by = p.id
WHERE s.status = 'approved'
GROUP BY p.id, p.full_name, p.role, p.avatar_url;
