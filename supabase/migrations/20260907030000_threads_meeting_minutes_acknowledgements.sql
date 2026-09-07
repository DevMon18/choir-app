-- Migration: Meeting Minutes & Post Acknowledgement Configuration
-- File: supabase/migrations/20260907030000_threads_meeting_minutes_acknowledgements.sql

-- 1. Add category and requires_acknowledgement columns to thread_posts
ALTER TABLE public.thread_posts 
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create index on category
CREATE INDEX IF NOT EXISTS idx_thread_posts_category ON public.thread_posts (category);

-- 3. Update any existing post with meeting keywords to category 'minutes' & requires_acknowledgement = true
UPDATE public.thread_posts
SET category = 'minutes', requires_acknowledgement = TRUE
WHERE content ILIKE '%MINUTES OF THE MEETING%' OR content ILIKE '%MEETING MINUTES%';
