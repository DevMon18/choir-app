-- =========================================================
-- Migration: Extend Live Mass Sequence Tables + Directory View
-- =========================================================

-- 1. Extend mass_sequences (add scheduled_at if missing)
ALTER TABLE public.mass_sequences
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Rename 'name' to 'title' only if title doesn't exist yet (handled above)
-- If 'name' column exists and 'title' doesn't, copy data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mass_sequences' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mass_sequences' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.mass_sequences RENAME COLUMN name TO title;
  END IF;
END$$;

-- 2. Extend sequence_items (add order_index alias for position, notes)
ALTER TABLE public.sequence_items
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Sync order_index from position if position exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sequence_items' AND column_name = 'position'
  ) THEN
    UPDATE public.sequence_items SET order_index = position WHERE order_index = 0;
  END IF;
END$$;

-- 3. Extend live_sessions with required new columns
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS sequence_id UUID REFERENCES public.mass_sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS director_semitones INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scroll_speed INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS started_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- 4. Extend member_dues with additional fields used by finances
ALTER TABLE public.member_dues
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS paid_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS period_label TEXT;

-- Sync member_id from user_id if user_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'member_dues' AND column_name = 'user_id'
  ) THEN
    UPDATE public.member_dues SET member_id = user_id WHERE member_id IS NULL;
  END IF;
END$$;

-- 5. Enable Realtime on live_sessions (may already be added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in publication, ignore
  END;
END$$;

-- 6. Additional RLS policies (only if not already existing)
-- Directors can insert live sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'live_sessions' AND policyname = 'Directors can insert live sessions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Directors can insert live sessions"
        ON public.live_sessions FOR INSERT
        WITH CHECK (
          (SELECT role FROM public.profiles WHERE id = auth.uid())
          IN ('super_admin', 'director')
        );
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'live_sessions' AND policyname = 'Directors can update live sessions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Directors can update live sessions"
        ON public.live_sessions FOR UPDATE
        USING (
          (SELECT role FROM public.profiles WHERE id = auth.uid())
          IN ('super_admin', 'director')
        );
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'live_sessions' AND policyname = 'All approved members can view live sessions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "All approved members can view live sessions"
        ON public.live_sessions FOR SELECT
        USING (
          (SELECT role FROM public.profiles WHERE id = auth.uid())
          IN ('super_admin', 'director', 'secretary', 'treasurer', 'member')
        );
    $policy$;
  END IF;
END$$;

-- 7. Community Directory View (server-masked, emergency_contact NEVER included)
-- Add avatar_url to profiles if not already present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE OR REPLACE VIEW public.public_directory AS
SELECT
  p.id,
  p.full_name,
  p.role,
  p.voice_part,
  p.join_date,
  p.avatar_url,
  CASE
    WHEN p.is_phone_private = FALSE THEN p.phone
    ELSE NULL
  END AS phone,
  CASE
    WHEN p.is_address_private = FALSE THEN p.address
    ELSE NULL
  END AS address
FROM public.profiles p
WHERE p.role::text IN ('super_admin', 'director', 'secretary', 'treasurer', 'member');

-- Grant view access to authenticated users
GRANT SELECT ON public.public_directory TO authenticated;
