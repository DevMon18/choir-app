-- Make title and scheduled_at columns nullable in live_sessions table to support sequence-linked sessions
ALTER TABLE public.live_sessions ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.live_sessions ALTER COLUMN scheduled_at DROP NOT NULL;
