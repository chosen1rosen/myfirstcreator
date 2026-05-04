-- Per-link rotation columns (add to tracking_links)
-- Run this in the Supabase SQL editor

-- Also add forced_variant_id if not already there (from previous migration)
ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS forced_variant_id INTEGER REFERENCES variants(id) ON DELETE SET NULL;

ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS link_mode TEXT DEFAULT 'global';
-- 'global' | 'forced' | 'own'

ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS rot_mode TEXT;
-- 'click' | 'time' (only used when link_mode = 'own')

ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS rot_sequence JSONB;
-- JSON array of variant IDs e.g. [1, 3, 5]

ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS rot_active_id INTEGER;
ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS rot_click_count INTEGER DEFAULT 0;
ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS rot_started_at TIMESTAMPTZ;
ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS rot_click_threshold INTEGER;
ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS rot_time_hours FLOAT;
