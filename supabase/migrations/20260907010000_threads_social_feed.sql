-- Migration: Threads Social Feed System
-- File: supabase/migrations/20260907010000_threads_social_feed.sql

-- 1. Create thread_posts table
CREATE TABLE IF NOT EXISTS public.thread_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'edited', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 2. Create thread_comments table
CREATE TABLE IF NOT EXISTS public.thread_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.thread_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.thread_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'edited', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 3. Create thread_media table
CREATE TABLE IF NOT EXISTS public.thread_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.thread_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.thread_comments(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'gif')),
  url TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_thread_media_single_parent CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- 4. Create thread_reactions table
CREATE TABLE IF NOT EXISTS public.thread_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.thread_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.thread_comments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'heart', 'pray', 'clap', 'music')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_thread_reaction_single_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Unique indexes for post/comment reactions per member
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_reactions_post_member 
ON public.thread_reactions (post_id, member_id, reaction_type) 
WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_reactions_comment_member 
ON public.thread_reactions (comment_id, member_id, reaction_type) 
WHERE comment_id IS NOT NULL;

-- 5. Create thread_acknowledgements table
CREATE TABLE IF NOT EXISTS public.thread_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.thread_posts(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_thread_post_member_ack UNIQUE (post_id, member_id)
);

-- 6. Create thread_mentions table
CREATE TABLE IF NOT EXISTS public.thread_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.thread_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.thread_comments(id) ON DELETE CASCADE,
  mentioned_member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_thread_mention_single_parent CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_thread_posts_created_at ON public.thread_posts (created_at DESC) WHERE status != 'deleted';
CREATE INDEX IF NOT EXISTS idx_thread_posts_pinned ON public.thread_posts (is_pinned, created_at DESC) WHERE status != 'deleted';
CREATE INDEX IF NOT EXISTS idx_thread_comments_post ON public.thread_comments (post_id, created_at ASC) WHERE status != 'deleted';
CREATE INDEX IF NOT EXISTS idx_thread_media_post ON public.thread_media (post_id, order_index);
CREATE INDEX IF NOT EXISTS idx_thread_media_comment ON public.thread_media (comment_id, order_index);
CREATE INDEX IF NOT EXISTS idx_thread_reactions_post ON public.thread_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_thread_reactions_comment ON public.thread_reactions (comment_id);
CREATE INDEX IF NOT EXISTS idx_thread_acknowledgements_post ON public.thread_acknowledgements (post_id);
CREATE INDEX IF NOT EXISTS idx_thread_mentions_post ON public.thread_mentions (post_id);
CREATE INDEX IF NOT EXISTS idx_thread_mentions_mentioned ON public.thread_mentions (mentioned_member_id);

-- 7. Storage Bucket for thread-media
INSERT INTO storage.buckets (id, name, public)
VALUES ('thread-media', 'thread-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Read Access for Thread Media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload Thread Media" ON storage.objects;
DROP POLICY IF EXISTS "Users Update Own Thread Media" ON storage.objects;
DROP POLICY IF EXISTS "Users Delete Own Thread Media" ON storage.objects;

CREATE POLICY "Public Read Access for Thread Media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thread-media');

CREATE POLICY "Authenticated Users Upload Thread Media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thread-media');

CREATE POLICY "Users Update Own Thread Media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thread-media');

CREATE POLICY "Users Delete Own Thread Media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'thread-media');

-- 8. Row Level Security (RLS)
ALTER TABLE public.thread_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_mentions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an officer
CREATE OR REPLACE FUNCTION public.is_choir_officer(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user_id
    AND role IN ('super_admin', 'director', 'secretary', 'treasurer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for thread_posts
DROP POLICY IF EXISTS "Select active posts" ON public.thread_posts;
CREATE POLICY "Select active posts" ON public.thread_posts
FOR SELECT TO authenticated
USING (status != 'deleted' OR author_id = auth.uid() OR public.is_choir_officer(auth.uid()));

DROP POLICY IF EXISTS "Insert own posts" ON public.thread_posts;
CREATE POLICY "Insert own posts" ON public.thread_posts
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Update own posts" ON public.thread_posts;
CREATE POLICY "Update own posts" ON public.thread_posts
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.is_choir_officer(auth.uid()));

DROP POLICY IF EXISTS "Delete posts" ON public.thread_posts;
CREATE POLICY "Delete posts" ON public.thread_posts
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_choir_officer(auth.uid()));

-- Policies for thread_comments
DROP POLICY IF EXISTS "Select active comments" ON public.thread_comments;
CREATE POLICY "Select active comments" ON public.thread_comments
FOR SELECT TO authenticated
USING (status != 'deleted' OR author_id = auth.uid() OR public.is_choir_officer(auth.uid()));

DROP POLICY IF EXISTS "Insert own comments" ON public.thread_comments;
CREATE POLICY "Insert own comments" ON public.thread_comments
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Update own comments" ON public.thread_comments;
CREATE POLICY "Update own comments" ON public.thread_comments
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.is_choir_officer(auth.uid()));

DROP POLICY IF EXISTS "Delete comments" ON public.thread_comments;
CREATE POLICY "Delete comments" ON public.thread_comments
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_choir_officer(auth.uid()));

-- Policies for thread_media
DROP POLICY IF EXISTS "Select thread media" ON public.thread_media;
CREATE POLICY "Select thread media" ON public.thread_media
FOR SELECT TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Insert thread media" ON public.thread_media;
CREATE POLICY "Insert thread media" ON public.thread_media
FOR INSERT TO authenticated
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Delete thread media" ON public.thread_media;
CREATE POLICY "Delete thread media" ON public.thread_media
FOR DELETE TO authenticated
USING (TRUE);

-- Policies for thread_reactions
DROP POLICY IF EXISTS "Select thread reactions" ON public.thread_reactions;
CREATE POLICY "Select thread reactions" ON public.thread_reactions
FOR SELECT TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Insert own reaction" ON public.thread_reactions;
CREATE POLICY "Insert own reaction" ON public.thread_reactions
FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "Delete own reaction" ON public.thread_reactions;
CREATE POLICY "Delete own reaction" ON public.thread_reactions
FOR DELETE TO authenticated
USING (member_id = auth.uid());

-- Policies for thread_acknowledgements
DROP POLICY IF EXISTS "Select thread acknowledgements" ON public.thread_acknowledgements;
CREATE POLICY "Select thread acknowledgements" ON public.thread_acknowledgements
FOR SELECT TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Insert own acknowledgement" ON public.thread_acknowledgements;
CREATE POLICY "Insert own acknowledgement" ON public.thread_acknowledgements
FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "Delete own acknowledgement" ON public.thread_acknowledgements;
CREATE POLICY "Delete own acknowledgement" ON public.thread_acknowledgements
FOR DELETE TO authenticated
USING (member_id = auth.uid());

-- Policies for thread_mentions
DROP POLICY IF EXISTS "Select thread mentions" ON public.thread_mentions;
CREATE POLICY "Select thread mentions" ON public.thread_mentions
FOR SELECT TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Insert thread mentions" ON public.thread_mentions;
CREATE POLICY "Insert thread mentions" ON public.thread_mentions
FOR INSERT TO authenticated
WITH CHECK (TRUE);
