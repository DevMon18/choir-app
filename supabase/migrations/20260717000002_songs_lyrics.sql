-- Add ChordPro lyrics and archival support to the songs table

-- 1. Lyrics column (raw ChordPro text)
alter table public.songs
  add column if not exists lyrics text;

-- 2. Soft-delete / archival flag
alter table public.songs
  add column if not exists is_archived boolean not null default false;

-- 3. Generated tsvector column for full-text search
--    Strips ChordPro chord brackets ([G], [Am], etc.) before indexing
alter table public.songs
  add column if not exists lyrics_tsv tsvector
    generated always as (
      to_tsvector(
        'english',
        coalesce(title, '') || ' ' ||
        coalesce(composer, '') || ' ' ||
        coalesce(regexp_replace(coalesce(lyrics, ''), '\[[^\]]*\]', '', 'g'), '')
      )
    ) stored;

-- 4. GIN index for fast full-text queries
create index if not exists idx_songs_lyrics_tsv
  on public.songs using gin(lyrics_tsv);

-- 5. Index for efficient filtering of archived songs
create index if not exists idx_songs_is_archived
  on public.songs(is_archived);
