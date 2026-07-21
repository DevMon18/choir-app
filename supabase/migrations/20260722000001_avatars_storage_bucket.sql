-- Migration: Storage Bucket and RLS Policies for Avatars
-- File: supabase/migrations/20260722000001_avatars_storage_bucket.sql

-- 1. Ensure avatars storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage RLS Policies for avatars bucket
-- Drop existing policies if any to avoid conflict
DROP POLICY IF EXISTS "Public Read Access for Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users Update Own Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users Delete Own Avatars" ON storage.objects;

-- Allow public/authenticated read access to avatars
CREATE POLICY "Public Read Access for Avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload avatar images
CREATE POLICY "Authenticated Users Upload Avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update avatar images
CREATE POLICY "Users Update Own Avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete avatar images
CREATE POLICY "Users Delete Own Avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
