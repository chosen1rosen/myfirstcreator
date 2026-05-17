-- Add analytics columns to visitors
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS time_on_page INTEGER;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Page events table (clicks, video, form submits)
CREATE TABLE IF NOT EXISTS page_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT,
  tracking_slug TEXT,
  variant_id INTEGER,
  event_type TEXT NOT NULL,
  element TEXT,
  value TEXT DEFAULT '',
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_events_slug ON page_events(tracking_slug);
CREATE INDEX IF NOT EXISTS idx_page_events_sid ON page_events(session_id);
CREATE INDEX IF NOT EXISTS idx_page_events_created ON page_events(created_at);
CREATE INDEX IF NOT EXISTS idx_page_events_type ON page_events(event_type, element);
CREATE INDEX IF NOT EXISTS idx_visitors_session ON visitors(session_id);
CREATE INDEX IF NOT EXISTS idx_visitors_created ON visitors(created_at);
CREATE INDEX IF NOT EXISTS idx_visitors_country ON visitors(country);
CREATE INDEX IF NOT EXISTS idx_visitors_slug_new ON visitors(tracking_slug);
