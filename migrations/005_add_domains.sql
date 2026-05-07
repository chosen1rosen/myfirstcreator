-- Multi-domain support
-- Domain 1 = myfirstcreator.ai (primary, seeded below)
-- All existing data gets domain_id = 1 via DEFAULT

CREATE TABLE IF NOT EXISTS domains (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  site_name TEXT DEFAULT 'My Site',
  active BOOLEAN DEFAULT true,
  vercel_configured BOOLEAN DEFAULT false,
  vercel_domain_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed primary domain as id = 1
INSERT INTO domains (id, domain, site_name, active, vercel_configured)
VALUES (1, 'myfirstcreator.ai', 'MyFirstCreator', true, true)
ON CONFLICT DO NOTHING;

-- Ensure sequence starts after seed
SELECT setval('domains_id_seq', (SELECT MAX(id) FROM domains));

-- variants
ALTER TABLE variants ADD COLUMN IF NOT EXISTS domain_id INTEGER REFERENCES domains(id) DEFAULT 1;
UPDATE variants SET domain_id = 1 WHERE domain_id IS NULL;

-- tracking_links
ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS domain_id INTEGER REFERENCES domains(id) DEFAULT 1;
UPDATE tracking_links SET domain_id = 1 WHERE domain_id IS NULL;

-- signups
ALTER TABLE signups ADD COLUMN IF NOT EXISTS domain_id INTEGER REFERENCES domains(id) DEFAULT 1;
UPDATE signups SET domain_id = 1 WHERE domain_id IS NULL;
