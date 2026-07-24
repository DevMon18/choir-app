-- Migration: 20260725000000_song_categories.sql
-- Description: Controlled vocabulary table for song categories, many-to-many join table, RLS policies, seed data, and migration from legacy songs.category column.

-- 1. Controlled vocabulary table for categories
CREATE TABLE IF NOT EXISTS public.song_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Many-to-many join table: a song can have multiple categories
CREATE TABLE IF NOT EXISTS public.song_category_links (
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.song_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (song_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_song_category_links_song ON public.song_category_links(song_id);
CREATE INDEX IF NOT EXISTS idx_song_category_links_category ON public.song_category_links(category_id);

-- 3. Enable RLS
ALTER TABLE public.song_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_category_links ENABLE ROW LEVEL SECURITY;

-- 4. Read policy: any authenticated (non-pending/rejected) user can view categories
CREATE POLICY "authenticated_view_song_categories" ON public.song_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_view_song_category_links" ON public.song_category_links
  FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Write policy: only director, secretary, super_admin (same roles as song editors)
CREATE POLICY "editors_modify_song_categories" ON public.song_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles a
      WHERE a.id = auth.uid() AND a.role IN ('director', 'secretary', 'super_admin')
    )
  );

CREATE POLICY "editors_modify_song_category_links" ON public.song_category_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles a
      WHERE a.id = auth.uid() AND a.role IN ('director', 'secretary', 'super_admin')
    )
  );

-- 6. Seed categories from the previously-hardcoded list (skip ones that already exist)
INSERT INTO public.song_categories (name, sort_order)
VALUES
  ('SATB', 0), ('Gospel', 1), ('Contemporary', 2), ('Traditional', 3),
  ('Liturgical', 4), ('Advent', 5), ('Easter', 6), ('Christmas', 7)
ON CONFLICT (name) DO NOTHING;

-- 7. Data migration: backfill links from the existing free-text songs.category column
DO $$
BEGIN
  INSERT INTO public.song_categories (name)
  SELECT DISTINCT s.category
  FROM public.songs s
  WHERE s.category IS NOT NULL
    AND trim(s.category) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.song_categories sc WHERE sc.name = s.category
    );

  INSERT INTO public.song_category_links (song_id, category_id)
  SELECT s.id, sc.id
  FROM public.songs s
  JOIN public.song_categories sc ON sc.name = s.category
  WHERE s.category IS NOT NULL AND trim(s.category) <> ''
  ON CONFLICT DO NOTHING;
END$$;
