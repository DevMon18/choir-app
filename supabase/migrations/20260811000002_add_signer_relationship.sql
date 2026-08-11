-- Add signer_relationship column to document_signatures table
ALTER TABLE public.document_signatures 
ADD COLUMN IF NOT EXISTS signer_relationship text;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
