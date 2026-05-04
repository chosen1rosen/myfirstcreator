-- Add forced_variant_id to tracking_links
-- Run this in the Supabase SQL editor

ALTER TABLE tracking_links
  ADD COLUMN IF NOT EXISTS forced_variant_id INTEGER REFERENCES variants(id) ON DELETE SET NULL;
