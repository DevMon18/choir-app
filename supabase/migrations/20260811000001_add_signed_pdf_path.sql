-- Add signed_pdf_path column to document_signatures table
ALTER TABLE public.document_signatures 
ADD COLUMN IF NOT EXISTS signed_pdf_path text;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
