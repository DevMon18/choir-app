-- Make position column in sequence_items table nullable to support order_index-based inserts
ALTER TABLE public.sequence_items ALTER COLUMN position DROP NOT NULL;
