-- Fix the mass_sequences table columns:
-- 1. Copy name to title if title is null
UPDATE public.mass_sequences 
SET title = name 
WHERE title IS NULL;

-- 2. Drop the name column
ALTER TABLE public.mass_sequences DROP COLUMN IF EXISTS name;

-- 3. Make title column NOT NULL
ALTER TABLE public.mass_sequences ALTER COLUMN title SET NOT NULL;
