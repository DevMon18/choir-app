-- Add show_chords column to live_sessions
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS show_chords BOOLEAN DEFAULT true;
