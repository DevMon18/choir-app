-- Migration: Add verified master track support to practice_tracks
-- Description: Adds is_verified_master, verified_by, and verified_at columns to practice_tracks

ALTER TABLE public.practice_tracks 
ADD COLUMN IF NOT EXISTS is_verified_master BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add index for fast querying of verified master tracks
CREATE INDEX IF NOT EXISTS idx_practice_tracks_verified ON public.practice_tracks (song_id, is_verified_master) WHERE is_verified_master = true;
