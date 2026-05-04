ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS telegram_url TEXT;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'manual';
-- type: 'manual' (existing) | 'telegram' (new)
