const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// Multer storage
const vslStorage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/vsl'),
  filename: (req, file, cb) => cb(null, `vsl-${Date.now()}${path.extname(file.originalname)}`),
});
const testimonialStorage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/testimonials'),
  filename: (req, file, cb) => cb(null, `t-${Date.now()}${path.extname(file.originalname)}`),
});

const uploadVsl = multer({ storage: vslStorage });
const uploadTestimonial = multer({ storage: testimonialStorage });

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, value);
}

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// Layout
const layout = (title, content, activePage = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — MFC Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d14; color: #e2e8f0; display: flex; min-height: 100vh; }
    .sidebar { width: 220px; background: #12121f; border-right: 1px solid #1e1e30; padding: 24px 0; flex-shrink: 0; position: fixed; top: 0; left: 0; height: 100vh; overflow-y: auto; }
    .sidebar-logo { padding: 0 20px 24px; font-size: 15px; font-weight: 700; color: #a78bfa; border-bottom: 1px solid #1e1e30; margin-bottom: 16px; }
    .sidebar a { display: block; padding: 10px 20px; color: #94a3b8; text-decoration: none; font-size: 14px; transition: all 0.15s; }
    .sidebar a:hover, .sidebar a.active { background: #1e1e35; color: #a78bfa; }
    .sidebar a.active { border-left: 3px solid #a78bfa; }
    .sidebar-section { padding: 8px 20px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; margin-top: 8px; }
    .main { margin-left: 220px; flex: 1; padding: 32px; }
    .page-title { font-size: 24px; font-weight: 700; color: #f1f5f9; margin-bottom: 24px; }
    .card { background: #12121f; border: 1px solid #1e1e30; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .card-title { font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat { background: #12121f; border: 1px solid #1e1e30; border-radius: 12px; padding: 20px; }
    .stat-num { font-size: 32px; font-weight: 700; color: #a78bfa; }
    .stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; color: #64748b; font-weight: 600; border-bottom: 1px solid #1e1e30; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px; border-bottom: 1px solid #1a1a2e; color: #cbd5e1; vertical-align: top; }
    tr:hover td { background: #16162a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge-green { background: #064e3b; color: #6ee7b7; }
    .badge-gray { background: #1e293b; color: #64748b; }
    .badge-purple { background: #3b0764; color: #c4b5fd; }
    input, textarea, select { background: #1a1a2e; border: 1px solid #2d2d4a; color: #e2e8f0; padding: 10px 12px; border-radius: 8px; font-size: 14px; width: 100%; outline: none; font-family: inherit; }
    input:focus, textarea:focus, select:focus { border-color: #7c3aed; }
    textarea { resize: vertical; min-height: 80px; }
    label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; font-weight: 500; }
    .form-group { margin-bottom: 16px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; text-decoration: none; }
    .btn-primary { background: linear-gradient(135deg, #7c3aed, #06b6d4); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-danger { background: #7f1d1d; color: #fca5a5; }
    .btn-danger:hover { background: #991b1b; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .btn-ghost { background: #1e1e35; color: #94a3b8; }
    .btn-ghost:hover { background: #2d2d4a; color: #e2e8f0; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .alert-success { background: #064e3b; color: #6ee7b7; border: 1px solid #065f46; }
    .alert-error { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; }
    .slug-preview { font-family: monospace; color: #06b6d4; font-size: 13px; background: #0d1117; padding: 4px 8px; border-radius: 4px; }
    .empty { text-align: center; padding: 48px; color: #475569; }
    .flex { display: flex; align-items: center; gap: 12px; }
    .flex-between { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .copy-btn { cursor: pointer; color: #7c3aed; font-size: 12px; background: none; border: none; padding: 4px; }
    .copy-btn:hover { color: #a78bfa; }
  </style>
</head>
<body>
  <nav class="sidebar">
    <div class="sidebar-logo">🤖 MFC Admin</div>
    <div class="sidebar-section">Overview</div>
    <a href="/admin/dashboard" class="${activePage === 'dashboard' ? 'active' : ''}">📊 Dashboard</a>
    <a href="/admin/signups" class="${activePage === 'signups' ? 'active' : ''}">📧 Signups</a>
    <div class="sidebar-section">Content</div>
    <a href="/admin/vsl" class="${activePage === 'vsl' ? 'active' : ''}">🎬 VSL Video</a>
    <a href="/admin/testimonials" class="${activePage === 'testimonials' ? 'active' : ''}">💬 Testimonials</a>
    <a href="/admin/settings" class="${activePage === 'settings' ? 'active' : ''}">⚙️ Site Settings</a>
    <div class="sidebar-section">Growth</div>
    <a href="/admin/tracking" class="${activePage === 'tracking' ? 'active' : ''}">🔗 Tracking Links</a>
    <div class="sidebar-section" style="margin-top: auto;"></div>
    <a href="/" target="_blank">🌐 View Site</a>
    <a href="/admin/logout">🚪 Logout</a>
  </nav>
  <main class="main">
    <div class="page-title">${title}</div>
    ${content}
  </main>
  <script>
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text);
    }
  </script>
</body>
</html>`;

// ─── Login ─────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session?.admin) return res.redirect('/admin/dashboard');
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #0d0d14; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .box { background: #12121f; border: 1px solid #1e1e30; border-radius: 16px; padding: 40px; width: 360px; }
  .logo { text-align: center; font-size: 20px; font-weight: 700; color: #a78bfa; margin-bottom: 32px; }
  label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  input { width: 100%; background: #1a1a2e; border: 1px solid #2d2d4a; color: #e2e8f0; padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; outline: none; }
  input:focus { border-color: #7c3aed; }
  button { width: 100%; padding: 12px; background: linear-gradient(135deg, #7c3aed, #06b6d4); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .error { color: #f87171; font-size: 13px; text-align: center; margin-bottom: 12px; }
</style></head>
<body>
  <div class="box">
    <div class="logo">🤖 MFC Admin</div>
    ${req.query.error ? '<div class="error">Invalid credentials</div>' : ''}
    <form method="POST" action="/admin/login">
      <label>Username</label><input type="text" name="username" autocomplete="username" required>
      <label>Password</label><input type="password" name="password" autocomplete="current-password" required>
      <button type="submit">Sign In</button>
    </form>
  </div>
</body></html>`);
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = username === (process.env.ADMIN_USERNAME || 'admin');
  const validPass = password === (process.env.ADMIN_PASSWORD || 'changeme123');
  if (validUser && validPass) {
    req.session.admin = true;
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/admin/login?error=1');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

router.get('/', requireAuth, (req, res) => res.redirect('/admin/dashboard'));

// ─── Dashboard ──────────────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, (req, res) => {
  const totalSignups = db.prepare('SELECT COUNT(*) as c FROM signups').get().c;
  const totalVisitors = db.prepare('SELECT COUNT(*) as c FROM visitors').get().c;
  const totalLinks = db.prepare('SELECT COUNT(*) as c FROM tracking_links').get().c;
  const todaySignups = db.prepare("SELECT COUNT(*) as c FROM signups WHERE date(signed_up_at) = date('now')").get().c;
  const recentSignups = db.prepare('SELECT * FROM signups ORDER BY signed_up_at DESC LIMIT 10').all();
  const topLinks = db.prepare(`
    SELECT tl.slug, tl.name,
      (SELECT COUNT(*) FROM visitors v WHERE v.tracking_slug = tl.slug) as visits,
      (SELECT COUNT(*) FROM signups s WHERE s.tracking_slug = tl.slug) as conversions
    FROM tracking_links tl ORDER BY visits DESC LIMIT 5
  `).all();

  const recentRows = recentSignups.map(s => `
    <tr>
      <td>${s.name || '—'}</td>
      <td>${s.email}</td>
      <td><span class="badge badge-purple">${s.tracking_slug || 'direct'}</span></td>
      <td>${s.ip}</td>
      <td style="color:#64748b;font-size:12px">${new Date(s.signed_up_at).toLocaleString()}</td>
    </tr>`).join('');

  const topLinkRows = topLinks.map(l => `
    <tr>
      <td><span class="slug-preview">/r/${l.slug}</span></td>
      <td>${l.name || '—'}</td>
      <td>${l.visits}</td>
      <td>${l.conversions}</td>
      <td>${l.visits > 0 ? ((l.conversions / l.visits) * 100).toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');

  res.send(layout('Dashboard', `
    <div class="stat-grid">
      <div class="stat"><div class="stat-num">${totalSignups}</div><div class="stat-label">Total Signups</div></div>
      <div class="stat"><div class="stat-num">${todaySignups}</div><div class="stat-label">Today's Signups</div></div>
      <div class="stat"><div class="stat-num">${totalVisitors}</div><div class="stat-label">Total Tracked Visits</div></div>
      <div class="stat"><div class="stat-num">${totalLinks}</div><div class="stat-label">Tracking Links</div></div>
    </div>
    <div class="card">
      <div class="card-title">Recent Signups</div>
      ${recentSignups.length ? `<table><thead><tr><th>Name</th><th>Email</th><th>Source</th><th>IP</th><th>Time</th></tr></thead><tbody>${recentRows}</tbody></table>` : '<div class="empty">No signups yet</div>'}
    </div>
    <div class="card">
      <div class="card-title">Top Tracking Links</div>
      ${topLinks.length ? `<table><thead><tr><th>Slug</th><th>Name</th><th>Visits</th><th>Signups</th><th>CVR</th></tr></thead><tbody>${topLinkRows}</tbody></table>` : '<div class="empty">No tracking links yet</div>'}
    </div>
  `, 'dashboard'));
});

// ─── Signups ────────────────────────────────────────────────────────────────
router.get('/signups', requireAuth, (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;
  const search = req.query.q || '';
  const filter = req.query.ref || '';

  let query = 'SELECT * FROM signups WHERE 1=1';
  const params = [];
  if (search) { query += ' AND (email LIKE ? OR name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (filter) { query += ' AND tracking_slug = ?'; params.push(filter); }
  query += ` ORDER BY signed_up_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const signups = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM signups').get().c;
  const links = db.prepare('SELECT DISTINCT tracking_slug FROM signups WHERE tracking_slug IS NOT NULL').all();

  const rows = signups.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.name || '—'}</td>
      <td><strong>${s.email}</strong></td>
      <td><span class="badge badge-purple">${s.tracking_slug || 'direct'}</span></td>
      <td style="font-family:monospace;font-size:12px">${s.ip}</td>
      <td style="color:#64748b;font-size:12px">${new Date(s.signed_up_at).toLocaleString()}</td>
    </tr>`).join('');

  const filterOptions = links.map(l => `<option value="${l.tracking_slug}" ${filter === l.tracking_slug ? 'selected' : ''}>${l.tracking_slug}</option>`).join('');

  res.send(layout('Signups', `
    <div class="flex-between">
      <form method="GET" action="/admin/signups" class="flex" style="flex-wrap:wrap;gap:8px;">
        <input name="q" value="${search}" placeholder="Search email or name..." style="width:200px;margin-bottom:0">
        <select name="ref" style="width:160px;margin-bottom:0">
          <option value="">All sources</option>
          ${filterOptions}
        </select>
        <button type="submit" class="btn btn-ghost btn-sm">Filter</button>
        ${search || filter ? '<a href="/admin/signups" class="btn btn-ghost btn-sm">Clear</a>' : ''}
      </form>
      <span style="color:#64748b;font-size:13px">${total} total</span>
    </div>
    <div class="card">
      ${signups.length ? `<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Source</th><th>IP</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No signups yet</div>'}
    </div>
    ${total > limit ? `<div class="flex" style="gap:8px;">
      ${page > 1 ? `<a href="?page=${page - 1}&q=${search}&ref=${filter}" class="btn btn-ghost btn-sm">← Prev</a>` : ''}
      <span style="color:#64748b;font-size:13px">Page ${page} of ${Math.ceil(total / limit)}</span>
      ${page < Math.ceil(total / limit) ? `<a href="?page=${page + 1}&q=${search}&ref=${filter}" class="btn btn-ghost btn-sm">Next →</a>` : ''}
    </div>` : ''}
  `, 'signups'));
});

// ─── VSL ────────────────────────────────────────────────────────────────────
router.get('/vsl', requireAuth, (req, res) => {
  const vslType = getSetting('vsl_type');
  const vslUrl = getSetting('vsl_url');
  const vslFile = getSetting('vsl_file');
  const msg = req.query.msg;

  res.send(layout('VSL Video', `
    ${msg === 'saved' ? '<div class="alert alert-success">✅ VSL settings saved.</div>' : ''}
    <div class="card">
      <div class="card-title">Video Source</div>
      <form method="POST" action="/admin/vsl" enctype="multipart/form-data">
        <div class="form-group">
          <label>Type</label>
          <select name="vsl_type" id="vsl_type" onchange="toggleVSL(this.value)">
            <option value="url" ${vslType === 'url' ? 'selected' : ''}>YouTube / Vimeo URL</option>
            <option value="file" ${vslType === 'file' ? 'selected' : ''}>Upload Video File</option>
            <option value="none" ${vslType === 'none' ? 'selected' : ''}>Hide VSL section</option>
          </select>
        </div>
        <div id="url-section" class="form-group" style="${vslType !== 'url' ? 'display:none' : ''}">
          <label>Video URL (YouTube, Vimeo, or direct embed URL)</label>
          <input type="text" name="vsl_url" value="${vslUrl}" placeholder="https://www.youtube.com/embed/...">
          <div style="font-size:12px;color:#64748b;margin-top:6px">Use the embed URL format: youtube.com/embed/VIDEO_ID</div>
        </div>
        <div id="file-section" class="form-group" style="${vslType !== 'file' ? 'display:none' : ''}">
          <label>Upload Video File (MP4 recommended)</label>
          <input type="file" name="vsl_file" accept="video/*">
          ${vslFile ? `<div style="margin-top:8px;font-size:13px;color:#6ee7b7">Current: ${vslFile}</div>` : ''}
        </div>
        <button type="submit" class="btn btn-primary">Save VSL</button>
      </form>
    </div>
    ${(vslType === 'url' && vslUrl) || (vslType === 'file' && vslFile) ? `
    <div class="card">
      <div class="card-title">Preview</div>
      ${vslType === 'url' && vslUrl ? `<iframe src="${vslUrl}" width="100%" height="400" frameborder="0" allowfullscreen style="border-radius:8px"></iframe>` : ''}
      ${vslType === 'file' && vslFile ? `<video src="/uploads/vsl/${vslFile}" controls width="100%" style="border-radius:8px"></video>` : ''}
    </div>` : ''}
    <script>
      function toggleVSL(val) {
        document.getElementById('url-section').style.display = val === 'url' ? '' : 'none';
        document.getElementById('file-section').style.display = val === 'file' ? '' : 'none';
      }
    </script>
  `, 'vsl'));
});

router.post('/vsl', requireAuth, uploadVsl.single('vsl_file'), (req, res) => {
  const { vsl_type, vsl_url } = req.body;
  setSetting('vsl_type', vsl_type);
  if (vsl_url) setSetting('vsl_url', vsl_url);
  if (req.file) setSetting('vsl_file', req.file.filename);
  res.redirect('/admin/vsl?msg=saved');
});

// ─── Testimonials ───────────────────────────────────────────────────────────
router.get('/testimonials', requireAuth, (req, res) => {
  const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY sort_order ASC, id ASC').all();
  const msg = req.query.msg;

  const rows = testimonials.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.image_path ? `<img src="/uploads/testimonials/${t.image_path}" width="40" height="40" style="border-radius:50%;object-fit:cover">` : '—'}</td>
      <td><strong>${t.name}</strong>${t.handle ? `<br><span style="color:#64748b;font-size:12px">${t.handle}</span>` : ''}</td>
      <td>${t.earnings ? `<span class="badge badge-green">${t.earnings}</span>` : '—'}</td>
      <td style="max-width:300px;color:#94a3b8;font-size:13px">"${t.quote}"</td>
      <td><span class="badge ${t.active ? 'badge-green' : 'badge-gray'}">${t.active ? 'Active' : 'Hidden'}</span></td>
      <td>
        <form method="POST" action="/admin/testimonials/${t.id}/toggle" style="display:inline">
          <button class="btn btn-ghost btn-sm">${t.active ? 'Hide' : 'Show'}</button>
        </form>
        <form method="POST" action="/admin/testimonials/${t.id}/delete" style="display:inline" onsubmit="return confirm('Delete this testimonial?')">
          <button class="btn btn-danger btn-sm">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  res.send(layout('Testimonials', `
    ${msg === 'added' ? '<div class="alert alert-success">✅ Testimonial added.</div>' : ''}
    ${msg === 'deleted' ? '<div class="alert alert-success">✅ Testimonial deleted.</div>' : ''}
    <div class="card">
      <div class="card-title">Add Testimonial</div>
      <form method="POST" action="/admin/testimonials" enctype="multipart/form-data">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label>Name *</label>
            <input type="text" name="name" required placeholder="John Doe">
          </div>
          <div class="form-group">
            <label>Handle / Username</label>
            <input type="text" name="handle" placeholder="@johndoe">
          </div>
          <div class="form-group">
            <label>Earnings Claim</label>
            <input type="text" name="earnings" placeholder="$3,200 in 30 days">
          </div>
          <div class="form-group">
            <label>Profile Photo</label>
            <input type="file" name="image" accept="image/*">
          </div>
        </div>
        <div class="form-group">
          <label>Quote *</label>
          <textarea name="quote" required placeholder="Their testimonial..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Add Testimonial</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">${testimonials.length} Testimonials</div>
      ${testimonials.length ? `<table><thead><tr><th>#</th><th>Photo</th><th>Name</th><th>Earnings</th><th>Quote</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No testimonials yet. Add your first one above.</div>'}
    </div>
  `, 'testimonials'));
});

router.post('/testimonials', requireAuth, uploadTestimonial.single('image'), (req, res) => {
  const { name, handle, earnings, quote } = req.body;
  const image = req.file ? req.file.filename : null;
  db.prepare('INSERT INTO testimonials (name, handle, earnings, quote, image_path) VALUES (?, ?, ?, ?, ?)').run(name, handle || null, earnings || null, quote, image);
  res.redirect('/admin/testimonials?msg=added');
});

router.post('/testimonials/:id/toggle', requireAuth, (req, res) => {
  const t = db.prepare('SELECT active FROM testimonials WHERE id = ?').get(req.params.id);
  if (t) db.prepare('UPDATE testimonials SET active = ? WHERE id = ?').run(t.active ? 0 : 1, req.params.id);
  res.redirect('/admin/testimonials');
});

router.post('/testimonials/:id/delete', requireAuth, (req, res) => {
  const t = db.prepare('SELECT image_path FROM testimonials WHERE id = ?').get(req.params.id);
  if (t?.image_path) {
    const fp = path.join(__dirname, '../uploads/testimonials', t.image_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  res.redirect('/admin/testimonials?msg=deleted');
});

// ─── Tracking Links ──────────────────────────────────────────────────────────
router.get('/tracking', requireAuth, (req, res) => {
  const links = db.prepare(`
    SELECT tl.*,
      (SELECT COUNT(*) FROM visitors v WHERE v.tracking_slug = tl.slug) as visits,
      (SELECT COUNT(*) FROM signups s WHERE s.tracking_slug = tl.slug) as conversions
    FROM tracking_links tl ORDER BY tl.created_at DESC
  `).all();
  const msg = req.query.msg;
  const host = req.headers.host || 'myfirstcreator.ai';

  const rows = links.map(l => {
    const url = `https://${host}/r/${l.slug}`;
    const cvr = l.visits > 0 ? ((l.conversions / l.visits) * 100).toFixed(1) + '%' : '—';
    return `
    <tr>
      <td><span class="slug-preview">/r/${l.slug}</span></td>
      <td>${l.name || '—'}</td>
      <td style="font-size:12px;color:#64748b">${l.destination}</td>
      <td>${l.visits}</td>
      <td>${l.conversions}</td>
      <td>${cvr}</td>
      <td style="font-size:12px;color:#64748b">${new Date(l.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-ghost btn-sm copy-btn" onclick="copyToClipboard('${url}'); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy',1500)">Copy</button>
        <form method="POST" action="/admin/tracking/${l.id}/delete" style="display:inline" onsubmit="return confirm('Delete this link?')">
          <button class="btn btn-danger btn-sm">Delete</button>
        </form>
      </td>
    </tr>`;
  }).join('');

  res.send(layout('Tracking Links', `
    ${msg === 'added' ? '<div class="alert alert-success">✅ Tracking link created.</div>' : ''}
    ${msg === 'exists' ? '<div class="alert alert-error">⚠️ That slug already exists.</div>' : ''}
    ${msg === 'deleted' ? '<div class="alert alert-success">✅ Link deleted.</div>' : ''}
    <div class="card">
      <div class="card-title">Create New Link</div>
      <form method="POST" action="/admin/tracking" class="flex" style="flex-wrap:wrap;gap:12px;align-items:flex-end">
        <div class="form-group" style="margin:0;flex:1;min-width:140px">
          <label>Slug *</label>
          <input type="text" name="slug" required placeholder="instagram" pattern="[a-z0-9-_]+" title="Lowercase letters, numbers, hyphens, underscores only">
        </div>
        <div class="form-group" style="margin:0;flex:1;min-width:140px">
          <label>Label (optional)</label>
          <input type="text" name="name" placeholder="Instagram Bio">
        </div>
        <div class="form-group" style="margin:0;flex:1;min-width:200px">
          <label>Destination (default: homepage)</label>
          <input type="text" name="destination" value="/" placeholder="/">
        </div>
        <button type="submit" class="btn btn-primary" style="margin-bottom:0">Create</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">${links.length} Tracking Links</div>
      ${links.length ? `<table><thead><tr><th>Slug</th><th>Label</th><th>Destination</th><th>Visits</th><th>Signups</th><th>CVR</th><th>Created</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No tracking links yet. Create your first one above.</div>'}
    </div>
  `, 'tracking'));
});

router.post('/tracking', requireAuth, (req, res) => {
  const { slug, name, destination } = req.body;
  const clean = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (!clean) return res.redirect('/admin/tracking?msg=invalid');
  const existing = db.prepare('SELECT id FROM tracking_links WHERE slug = ?').get(clean);
  if (existing) return res.redirect('/admin/tracking?msg=exists');
  db.prepare('INSERT INTO tracking_links (slug, name, destination) VALUES (?, ?, ?)').run(clean, name || null, destination || '/');
  res.redirect('/admin/tracking?msg=added');
});

router.post('/tracking/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tracking_links WHERE id = ?').run(req.params.id);
  res.redirect('/admin/tracking?msg=deleted');
});

// ─── Site Settings ──────────────────────────────────────────────────────────
router.get('/settings', requireAuth, (req, res) => {
  const msg = req.query.msg;
  res.send(layout('Site Settings', `
    ${msg === 'saved' ? '<div class="alert alert-success">✅ Settings saved.</div>' : ''}
    <div class="card">
      <div class="card-title">Landing Page Copy</div>
      <form method="POST" action="/admin/settings">
        <div class="form-group">
          <label>Main Headline</label>
          <input type="text" name="site_headline" value="${getSetting('site_headline')}">
        </div>
        <div class="form-group">
          <label>Sub-headline</label>
          <textarea name="site_subheadline">${getSetting('site_subheadline')}</textarea>
        </div>
        <div class="form-group">
          <label>CTA Button Text</label>
          <input type="text" name="webinar_cta" value="${getSetting('webinar_cta')}">
        </div>
        <div class="form-group">
          <label>Signup Count Offset (adds to real count for social proof)</label>
          <input type="number" name="signup_count_offset" value="${getSetting('signup_count_offset')}">
        </div>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
    </div>
  `, 'settings'));
});

router.post('/settings', requireAuth, (req, res) => {
  const fields = ['site_headline', 'site_subheadline', 'webinar_cta', 'signup_count_offset'];
  for (const f of fields) {
    if (req.body[f] !== undefined) setSetting(f, req.body[f]);
  }
  res.redirect('/admin/settings?msg=saved');
});

module.exports = router;
