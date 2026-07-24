-- Migration: Profile Cover Photo Positioning
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_position TEXT DEFAULT '50%';

NOTIFY pgrst, 'reload schema';
