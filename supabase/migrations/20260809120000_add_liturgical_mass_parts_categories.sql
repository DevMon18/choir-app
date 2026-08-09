-- Migration: 20260809120000_add_liturgical_mass_parts_categories.sql
-- Description: Seed the 13 standard Liturgical Mass Part categories into song_categories table.

INSERT INTO public.song_categories (name, sort_order)
VALUES
  ('Entrance Song', 10),
  ('Kyrie', 11),
  ('Gloria', 12),
  ('Responsorial Psalm', 13),
  ('Gospel Acclamation (Alleluia or Praise to You)', 14),
  ('Offertory / Presentation Song', 15),
  ('Sanctus', 16),
  ('Memorial Acclamation', 17),
  ('Great Amen', 18),
  ('Lord''s Prayer', 19),
  ('Lamb of God', 20),
  ('Communion Song', 21),
  ('Recessional / Closing Song', 22)
ON CONFLICT (name) DO NOTHING;
