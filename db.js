const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'data.db'));

db.exec(`PRAGMA journal_mode = WAL;`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tracking_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT,
    destination TEXT DEFAULT '/',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_slug TEXT,
    ip TEXT,
    user_agent TEXT,
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT NOT NULL,
    tracking_slug TEXT,
    ip TEXT,
    user_agent TEXT,
    signed_up_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    handle TEXT,
    earnings TEXT,
    quote TEXT NOT NULL,
    image_path TEXT,
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default settings
const defaults = {
  vsl_type: 'none',
  vsl_url: '',
  vsl_file: '',
  site_headline: 'Make Your First $1,000 With AI Creators',
  site_subheadline: 'Join thousands building real income streams with AI creators + social media. Watch the free training and claim your spot.',
  webinar_cta: 'Claim Your Free Spot',
  signup_count_offset: '0',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaults)) {
  insertSetting.run(key, value);
}

// Wrap for convenience
const _prepare = db.prepare.bind(db);
module.exports = {
  prepare: (sql) => _prepare(sql),
  exec: (sql) => db.exec(sql),
};
