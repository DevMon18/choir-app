-- Migration: Threads Database Counter Caches & Triggers
-- File: supabase/migrations/20260907020000_threads_counter_caches.sql

-- 1. Add counter cache columns to thread_posts
ALTER TABLE public.thread_posts
ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reaction_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS acknowledgement_count INTEGER NOT NULL DEFAULT 0;

-- 2. Backfill existing counts
UPDATE public.thread_posts p
SET
  comment_count = (
    SELECT COUNT(*) FROM public.thread_comments c
    WHERE c.post_id = p.id AND c.status != 'deleted'
  ),
  reaction_count = (
    SELECT COUNT(*) FROM public.thread_reactions r
    WHERE r.post_id = p.id
  ),
  acknowledgement_count = (
    SELECT COUNT(*) FROM public.thread_acknowledgements a
    WHERE a.post_id = p.id
  );

-- 3. Trigger Function for thread_comments
CREATE OR REPLACE FUNCTION public.fn_thread_comments_counter_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status != 'deleted' THEN
      UPDATE public.thread_posts
      SET comment_count = comment_count + 1
      WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status != 'deleted' THEN
      UPDATE public.thread_posts
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = OLD.post_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If status changed to deleted
    IF OLD.status != 'deleted' AND NEW.status = 'deleted' THEN
      UPDATE public.thread_posts
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = NEW.post_id;
    -- If status restored from deleted to active
    ELSIF OLD.status = 'deleted' AND NEW.status != 'deleted' THEN
      UPDATE public.thread_posts
      SET comment_count = comment_count + 1
      WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger Function for thread_reactions
CREATE OR REPLACE FUNCTION public.fn_thread_reactions_counter_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.post_id IS NOT NULL THEN
      UPDATE public.thread_posts
      SET reaction_count = reaction_count + 1
      WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.post_id IS NOT NULL THEN
      UPDATE public.thread_posts
      SET reaction_count = GREATEST(0, reaction_count - 1)
      WHERE id = OLD.post_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger Function for thread_acknowledgements
CREATE OR REPLACE FUNCTION public.fn_thread_acknowledgements_counter_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.thread_posts
    SET acknowledgement_count = acknowledgement_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.thread_posts
    SET acknowledgement_count = GREATEST(0, acknowledgement_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach Triggers
DROP TRIGGER IF EXISTS trg_thread_comments_counter_cache ON public.thread_comments;
CREATE TRIGGER trg_thread_comments_counter_cache
AFTER INSERT OR UPDATE OR DELETE ON public.thread_comments
FOR EACH ROW
EXECUTE FUNCTION public.fn_thread_comments_counter_cache();

DROP TRIGGER IF EXISTS trg_thread_reactions_counter_cache ON public.thread_reactions;
CREATE TRIGGER trg_thread_reactions_counter_cache
AFTER INSERT OR DELETE ON public.thread_reactions
FOR EACH ROW
EXECUTE FUNCTION public.fn_thread_reactions_counter_cache();

DROP TRIGGER IF EXISTS trg_thread_acknowledgements_counter_cache ON public.thread_acknowledgements;
CREATE TRIGGER trg_thread_acknowledgements_counter_cache
AFTER INSERT OR DELETE ON public.thread_acknowledgements
FOR EACH ROW
EXECUTE FUNCTION public.fn_thread_acknowledgements_counter_cache();
