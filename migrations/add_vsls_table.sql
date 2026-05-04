CREATE TABLE IF NOT EXISTS vsls (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'url' | 'file'
  url TEXT,                  -- for url type (embed URL)
  file_path TEXT,            -- for file type (public Supabase storage URL)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE variants ADD COLUMN IF NOT EXISTS vsl_id INTEGER REFERENCES vsls(id) ON DELETE SET NULL;
