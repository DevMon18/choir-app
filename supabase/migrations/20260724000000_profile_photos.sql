-- Migration: Profile Photos & 8-Photo DB Trigger Cap
CREATE TABLE IF NOT EXISTS public.profile_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for user photos lookup
CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id ON public.profile_photos (user_id, created_at DESC);

-- Trigger function enforcing 8-photo cap per user at DB level
CREATE OR REPLACE FUNCTION public.enforce_photo_cap_trigger()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT count(*) INTO current_count
  FROM public.profile_photos
  WHERE user_id = NEW.user_id;

  IF current_count >= 8 THEN
    RAISE EXCEPTION 'Photo cap reached (maximum 8 photos per profile).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_photo_cap ON public.profile_photos;
CREATE TRIGGER trg_enforce_photo_cap
  BEFORE INSERT ON public.profile_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_photo_cap_trigger();

-- Enable RLS
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- 1. Anyone logged in and approved can view photos
CREATE POLICY "Approved members can view profile photos"
  ON public.profile_photos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. Owner can insert up to cap
CREATE POLICY "Users can insert their own profile photos"
  ON public.profile_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Owner or Admin can delete
CREATE POLICY "Users or Admins can delete profile photos"
  ON public.profile_photos FOR DELETE
  USING (
    auth.uid() = user_id OR
    public.has_admin_role()
  );

-- Storage bucket setup for profile_photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile_photos', 'profile_photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public read access for profile_photos bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile_photos');

CREATE POLICY "Authenticated upload access for profile_photos bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile_photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Owner delete access for profile_photos bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'profile_photos' AND auth.uid() IS NOT NULL);
