-- Migration: Add document_folders table and folder_id column to documents table

CREATE TABLE IF NOT EXISTS public.document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  icon TEXT NOT NULL DEFAULT '📁',
  color TEXT NOT NULL DEFAULT '#0b4d24',
  parent_id UUID NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add folder_id to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS folder_id UUID NULL REFERENCES public.document_folders(id) ON DELETE SET NULL;

-- Enable RLS on document_folders
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_folders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'document_folders_authenticated_select') THEN
    CREATE POLICY "document_folders_authenticated_select" ON public.document_folders
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'document_folders_admin_all') THEN
    CREATE POLICY "document_folders_admin_all" ON public.document_folders
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('super_admin', 'director', 'secretary')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('super_admin', 'director', 'secretary')
        )
      );
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
