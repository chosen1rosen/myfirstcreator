const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../db');
const layout = require('./admin-layout');
const { getAdminAccounts, getAdminOwners, getAdminVariantIds, getAdminLinkSlugs, addLinkToAdmin, removeLinkFromAdmin } = require('./admin-utils');
const { router: variantsRouter } = require('./admin-variants');
const builderRouter = require('./admin-builder');
const customRouter = require('./admin-custom');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const SUPABASE_URL = process.env.SUPABASE_URL;
const BUCKET = 'mfc-assets';

async function uploadToStorage(folder, filename, buffer, mimetype) {
  const path = `${folder}/${filename}`;
  await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimetype, upsert: true });
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single();
  return data?.value ?? '';
}
async function setSetting(key, value) {
  await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
}

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.redirect('/admin/login');
}


// Login
router.get('/login', (req, res) => {
  if (req.session?.admin) return res.redirect('/admin/dashboard');
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Admin Login</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0d0d14;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#12121f;border:1px solid #1e1e30;border-radius:16px;padding:40px;width:360px}.logo{text-align:center;font-size:20px;font-weight:700;color:#a78bfa;margin-bottom:32px}label{display:block;font-size:13px;color:#94a3b8;margin-bottom:6px}input{width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:12px;border-radius:8px;font-size:14px;margin-bottom:16px;outline:none}button{width:100%;padding:12px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}.error{color:#f87171;font-size:13px;text-align:center;margin-bottom:12px}</style>
  </head><body><div class="box"><div class="logo">🤖 MFC Admin</div>
  ${req.query.error ? '<div class="error">Invalid credentials</div>' : ''}
  <form method="POST" action="/admin/login"><label>Username</label><input type="text" name="username" required><label>Password</label><input type="password" name="password" required><button type="submit">Sign In</button></form></div></body></html>`);
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const match = getAdminAccounts().find(a => username === a.username && password === a.password);
  if (match) {
    req.session.admin = true;
    req.session.adminId = match.adminId;
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/admin/login?error=1');
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });
router.get('/', requireAuth, (req, res) => res.redirect('/admin/dashboard'));

// Dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const variantIds = await getAdminVariantIds(adminId);
  const adminLinkSlugs = await getAdminLinkSlugs(adminId); // null = all (steven), [] = none yet (new admin)

  // Scoped signup/visitor counts
  let signupQ = supabase.from('signups').select('*', { count: 'exact', head: true });
  let visitorQ = supabase.from('visitors').select('*', { count: 'exact', head: true });
  if (variantIds.length > 0) {
    signupQ = signupQ.in('variant_id', variantIds);
    visitorQ = visitorQ.in('variant_id', variantIds);
  } else if (adminId !== 'steven') {
    // New admin with no variants yet — show zeros
    signupQ = signupQ.eq('variant_id', -1);
    visitorQ = visitorQ.eq('variant_id', -1);
  }

  // Scoped link count
  let linkQ = supabase.from('tracking_links').select('*', { count: 'exact', head: true });
  if (adminLinkSlugs !== null) linkQ = adminLinkSlugs.length > 0 ? linkQ.in('slug', adminLinkSlugs) : linkQ.eq('slug', '__none__');

  const [{ count: totalSignups }, { count: totalVisitors }, { count: totalLinks }] = await Promise.all([signupQ, visitorQ, linkQ]);

  const today = new Date().toISOString().slice(0, 10);
  let todayQ = supabase.from('signups').select('*', { count: 'exact', head: true }).gte('signed_up_at', today);
  if (variantIds.length > 0) todayQ = todayQ.in('variant_id', variantIds);
  else if (adminId !== 'steven') todayQ = todayQ.eq('variant_id', -1);
  const { count: todaySignups } = await todayQ;

  let recentQ = supabase.from('signups').select('*').order('signed_up_at', { ascending: false }).limit(10);
  if (variantIds.length > 0) recentQ = recentQ.in('variant_id', variantIds);
  else if (adminId !== 'steven') recentQ = recentQ.eq('variant_id', -1);
  const { data: recentSignups } = await recentQ;

  // Scoped tracking links
  let linksQ = supabase.from('tracking_links').select('*');
  if (adminLinkSlugs !== null) linksQ = adminLinkSlugs.length > 0 ? linksQ.in('slug', adminLinkSlugs) : linksQ.eq('slug', '__none__');
  const { data: links } = await linksQ;

  // Scoped visit/conversion counts per link
  const slugList = (links || []).map(l => l.slug);
  let visitCounts = [], signupCounts = [];
  if (slugList.length > 0) {
    [{ data: visitCounts }, { data: signupCounts }] = await Promise.all([
      supabase.from('visitors').select('tracking_slug').in('tracking_slug', slugList),
      supabase.from('signups').select('tracking_slug').in('tracking_slug', slugList),
    ]);
  }
  const vMap = {}, sMap = {};
  (visitCounts || []).forEach(v => { vMap[v.tracking_slug] = (vMap[v.tracking_slug] || 0) + 1; });
  (signupCounts || []).forEach(s => { sMap[s.tracking_slug] = (sMap[s.tracking_slug] || 0) + 1; });

  const topLinks = (links || []).map(l => ({ ...l, visits: vMap[l.slug] || 0, conversions: sMap[l.slug] || 0 })).sort((a, b) => b.visits - a.visits).slice(0, 5);

  const recentRows = (recentSignups || []).map(s => `<tr><td>${s.name || '—'}</td><td>${s.email}</td><td><span class="badge badge-purple">${s.tracking_slug || 'direct'}</span></td><td>${s.country || s.ip}</td><td style="color:#64748b;font-size:12px">${new Date(s.signed_up_at).toLocaleString()}</td></tr>`).join('');
  const topRows = topLinks.map(l => `<tr><td><span class="slug-preview">/r/${l.slug}</span></td><td>${l.name || '—'}</td><td>${l.visits}</td><td>${l.conversions}</td><td>${l.visits > 0 ? ((l.conversions / l.visits) * 100).toFixed(1) + '%' : '—'}</td></tr>`).join('');

  res.send(layout('Dashboard', `
    <div class="stat-grid">
      <div class="stat"><div class="stat-num">${totalSignups || 0}</div><div class="stat-label">Total Signups</div></div>
      <div class="stat"><div class="stat-num">${todaySignups || 0}</div><div class="stat-label">Today's Signups</div></div>
      <div class="stat"><div class="stat-num">${totalVisitors || 0}</div><div class="stat-label">Tracked Visits</div></div>
      <div class="stat"><div class="stat-num">${totalLinks || 0}</div><div class="stat-label">Tracking Links</div></div>
    </div>
    <div class="card"><div class="card-title">Recent Signups</div>${recentSignups?.length ? `<table><thead><tr><th>Name</th><th>Email</th><th>Source</th><th>Location</th><th>Time</th></tr></thead><tbody>${recentRows}</tbody></table>` : '<div class="empty">No signups yet</div>'}</div>
    <div class="card"><div class="card-title">Top Tracking Links</div>${topLinks.length ? `<table><thead><tr><th>Slug</th><th>Name</th><th>Visits</th><th>Signups</th><th>CVR</th></tr></thead><tbody>${topRows}</tbody></table>` : '<div class="empty">No tracking links yet</div>'}</div>
  `, 'dashboard'));
});

// Signups
router.get('/signups', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const variantIds = await getAdminVariantIds(adminId);
  const page = parseInt(req.query.page || '1');
  const limit = 50;
  const from = (page - 1) * limit;
  const search = req.query.q || '';
  const filter = req.query.ref || '';

  let query = supabase.from('signups').select('*', { count: 'exact' }).order('signed_up_at', { ascending: false }).range(from, from + limit - 1);
  // Scope to admin's variants
  if (variantIds.length > 0) query = query.in('variant_id', variantIds);
  else if (adminId !== 'steven') query = query.eq('variant_id', -1);
  if (filter) query = query.eq('tracking_slug', filter);
  if (search) query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);

  const { data: signups, count: total } = await query;
  // Scope slug filter options to admin's signups
  let slugQuery = supabase.from('signups').select('tracking_slug').not('tracking_slug', 'is', null);
  if (variantIds.length > 0) slugQuery = slugQuery.in('variant_id', variantIds);
  else if (adminId !== 'steven') slugQuery = slugQuery.eq('variant_id', -1);
  const { data: slugs } = await slugQuery;
  const uniqueSlugs = [...new Set((slugs || []).map(s => s.tracking_slug))];

  const rows = (signups || []).map(s => `<tr><td>${s.id}</td><td>${s.name || '—'}</td><td><strong>${s.email}</strong></td><td><span class="badge badge-purple">${s.tracking_slug || 'direct'}</span></td><td style="font-size:13px">${s.country || `<span style="font-family:monospace;font-size:11px;color:#64748b">${s.ip}</span>`}</td><td style="color:#64748b;font-size:12px">${new Date(s.signed_up_at).toLocaleString()}</td></tr>`).join('');
  const filterOptions = uniqueSlugs.map(s => `<option value="${s}" ${filter === s ? 'selected' : ''}>${s}</option>`).join('');
  const pages = Math.ceil((total || 0) / limit);

  res.send(layout('Signups', `
    <div class="flex-between">
      <form method="GET" action="/admin/signups" class="flex" style="flex-wrap:wrap;gap:8px">
        <input name="q" value="${search}" placeholder="Search email or name..." style="width:200px;margin-bottom:0">
        <select name="ref" style="width:160px;margin-bottom:0"><option value="">All sources</option>${filterOptions}</select>
        <button type="submit" class="btn btn-ghost btn-sm">Filter</button>
        ${search || filter ? '<a href="/admin/signups" class="btn btn-ghost btn-sm">Clear</a>' : ''}
      </form>
      <div class="flex" style="gap:8px"><a href="/admin/signups/export" class="btn btn-ghost btn-sm">⬇️ Export CSV</a><span style="color:#64748b;font-size:13px">${total || 0} total</span></div>
    </div>
    <div class="card">${signups?.length ? `<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Source</th><th>Location</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No signups yet</div>'}</div>
    ${pages > 1 ? `<div class="flex" style="gap:8px">${page > 1 ? `<a href="?page=${page-1}&q=${search}&ref=${filter}" class="btn btn-ghost btn-sm">← Prev</a>` : ''}<span style="color:#64748b;font-size:13px">Page ${page} of ${pages}</span>${page < pages ? `<a href="?page=${page+1}&q=${search}&ref=${filter}" class="btn btn-ghost btn-sm">Next →</a>` : ''}</div>` : ''}
  `, 'signups'));
});

// Export CSV
router.get('/signups/export', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const variantIds = await getAdminVariantIds(adminId);
  let q = supabase.from('signups').select('*').order('signed_up_at', { ascending: false });
  if (variantIds.length > 0) q = q.in('variant_id', variantIds);
  else if (adminId !== 'steven') q = q.eq('variant_id', -1);
  const { data: signups } = await q;
  const rows = [
    ['ID', 'Name', 'Email', 'Source', 'IP', 'Signed Up'].join(','),
    ...(signups || []).map(s => [s.id, `"${(s.name||'').replace(/"/g,'""')}"`, `"${s.email}"`, s.tracking_slug||'direct', s.ip, new Date(s.signed_up_at).toISOString()].join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="signups-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(rows);
});

// ─── VSL Library ──────────────────────────────────────────────────────────────

// VSL: generate a signed upload URL so the browser uploads directly to Supabase (bypasses Vercel size limit)
router.post('/vsl/signed-url', requireAuth, async (req, res) => {
  const { filename, mimetype } = req.body;
  const ext = (filename || 'video.mp4').split('.').pop().toLowerCase();
  const path = `vsl/vsl-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  res.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl });
});

// VSL: confirm upload — INSERT into vsls table (new library system)
router.post('/vsl/confirm', requireAuth, async (req, res) => {
  const { vsl_type, vsl_url, publicUrl, name } = req.body;
  // Keep backward compat: also save to settings for the global /api/vsl endpoint
  if (vsl_type) await setSetting('vsl_type', vsl_type);
  if (vsl_url) await setSetting('vsl_url', vsl_url);
  if (publicUrl) await setSetting('vsl_file', publicUrl);

  // New: insert into vsls library table
  const autoName = name || `Video ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const { data: vsl, error } = await supabase.from('vsls').insert({
    name: autoName,
    type: 'file',
    file_path: publicUrl,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, vsl });
});

// VSL: add URL type to library
router.post('/vsl/add-url', requireAuth, async (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });
  const { data: vsl, error } = await supabase.from('vsls').insert({
    name,
    type: 'url',
    url,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.redirect('/admin/vsl?msg=added');
});

// VSL: delete from library
router.post('/vsl/:id/delete', requireAuth, async (req, res) => {
  await supabase.from('vsls').delete().eq('id', req.params.id);
  res.redirect('/admin/vsl?msg=deleted');
});

// VSL: rename
router.post('/vsl/:id/rename', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  await supabase.from('vsls').update({ name }).eq('id', req.params.id);
  res.json({ ok: true });
});

// VSL: API endpoint for builder dropdown
router.get('/api/vsls', requireAuth, async (req, res) => {
  const { data: vsls } = await supabase.from('vsls').select('id, name, type').order('created_at', { ascending: false });
  res.json(vsls || []);
});

// VSL Library page
router.get('/vsl', requireAuth, async (req, res) => {
  const { data: vsls } = await supabase.from('vsls').select('*').order('created_at', { ascending: false });
  const msg = req.query.msg;

  const cards = (vsls || []).map(v => {
    const isFile = v.type === 'file';
    const badgeClass = isFile ? 'badge-purple' : 'badge-gray';
    const badgeLabel = isFile ? 'file' : 'url';
    const preview = isFile
      ? `<div style="width:100%;height:80px;background:#0d0d14;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:12px"><span style="font-size:32px">🎬</span></div>`
      : `<div style="width:100%;height:80px;background:#0d0d14;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:12px"><span style="font-size:32px">🔗</span></div>`;
    const created = new Date(v.created_at).toLocaleDateString();
    return `<div class="card" style="margin-bottom:0;padding:16px">
      ${preview}
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
        <div style="flex:1">
          <div style="font-weight:600;color:#e2e8f0;font-size:14px;margin-bottom:4px" id="vsl-name-${v.id}">${v.name}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge ${badgeClass}">${badgeLabel}</span>
            <span style="color:#475569;font-size:12px">${created}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="startRename(${v.id}, this)">Rename</button>
        ${v.url || v.file_path ? `<a href="${v.url || v.file_path}" target="_blank" class="btn btn-ghost btn-sm">Preview</a>` : ''}
        <form method="POST" action="/admin/vsl/${v.id}/delete" style="display:inline" onsubmit="return confirm('Delete this VSL?')">
          <button class="btn btn-danger btn-sm">Delete</button>
        </form>
      </div>
      <div id="rename-form-${v.id}" style="display:none;margin-top:10px">
        <input type="text" id="rename-input-${v.id}" value="${v.name.replace(/"/g, '&quot;')}" style="margin-bottom:6px">
        <div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" onclick="submitRename(${v.id})">Save</button><button class="btn btn-ghost btn-sm" onclick="cancelRename(${v.id})">Cancel</button></div>
      </div>
    </div>`;
  }).join('');

  res.send(layout('VSL Library', `
    ${msg === 'added' ? '<div class="alert alert-success">✅ VSL added to library.</div>' : ''}
    ${msg === 'deleted' ? '<div class="alert alert-success">✅ VSL deleted.</div>' : ''}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin-bottom:32px">
      ${(vsls && vsls.length) ? cards : '<div class="empty" style="grid-column:1/-1">No VSLs in your library yet. Add one below.</div>'}
    </div>

    <div class="card">
      <div class="card-title">Add VSL</div>
      <div style="display:flex;gap:0;border-bottom:1px solid #1e1e30;margin-bottom:20px">
        <button class="tab-btn active" id="tab-url-btn" onclick="switchTab('url')" style="background:none;border:none;padding:10px 20px;color:#a78bfa;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid #7c3aed">🔗 URL (YouTube/Vimeo)</button>
        <button class="tab-btn" id="tab-upload-btn" onclick="switchTab('upload')" style="background:none;border:none;padding:10px 20px;color:#64748b;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent">📁 Upload File</button>
      </div>

      <!-- URL Tab -->
      <div id="tab-url" style="">
        <form method="POST" action="/admin/vsl/add-url">
          <div class="form-group"><label>Name *</label><input type="text" name="name" required placeholder="e.g. Main VSL - YouTube"></div>
          <div class="form-group"><label>Embed URL *</label><input type="text" name="url" required placeholder="https://www.youtube.com/embed/VIDEO_ID"><div style="font-size:12px;color:#64748b;margin-top:4px">Use embed format: youtube.com/embed/VIDEO_ID or player.vimeo.com/video/ID</div></div>
          <button type="submit" class="btn btn-primary">Add URL VSL</button>
        </form>
      </div>

      <!-- Upload Tab -->
      <div id="tab-upload" style="display:none">
        <div class="form-group"><label>Name</label><input type="text" id="upload-name" placeholder="e.g. Main VSL v2 (auto-named if blank)"></div>
        <div class="form-group">
          <label>Video File (MP4 recommended, no size limit)</label>
          <input type="file" id="upload-file" accept="video/*" onchange="fileChosen(this)">
          <div id="file-chosen" style="font-size:13px;color:#94a3b8;margin-top:6px"></div>
        </div>
        <div id="upload-progress-wrap" style="display:none;margin-bottom:16px">
          <div style="font-size:13px;color:#94a3b8;margin-bottom:8px" id="upload-status">Uploading...</div>
          <div style="background:#1a1a2e;border-radius:999px;height:10px;overflow:hidden">
            <div id="upload-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#7c3aed,#06b6d4);transition:width 0.2s;border-radius:999px"></div>
          </div>
          <div id="upload-pct" style="font-size:12px;color:#64748b;margin-top:6px">0%</div>
        </div>
        <button class="btn btn-primary" id="upload-btn" onclick="doUpload()">Upload & Add to Library</button>
        <div id="upload-result" style="margin-top:12px"></div>
      </div>
    </div>

    <script>
    function switchTab(tab) {
      document.getElementById('tab-url').style.display = tab === 'url' ? '' : 'none';
      document.getElementById('tab-upload').style.display = tab === 'upload' ? '' : 'none';
      document.getElementById('tab-url-btn').style.cssText = tab === 'url' ? 'background:none;border:none;padding:10px 20px;color:#a78bfa;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid #7c3aed' : 'background:none;border:none;padding:10px 20px;color:#64748b;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent';
      document.getElementById('tab-upload-btn').style.cssText = tab === 'upload' ? 'background:none;border:none;padding:10px 20px;color:#a78bfa;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid #7c3aed' : 'background:none;border:none;padding:10px 20px;color:#64748b;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent';
    }
    function fileChosen(input) {
      if (input.files[0]) {
        document.getElementById('file-chosen').textContent = 'Selected: ' + input.files[0].name + ' (' + Math.round(input.files[0].size/1024/1024) + 'MB)';
      }
    }
    async function doUpload() {
      const file = document.getElementById('upload-file').files[0];
      if (!file) { alert('Please select a file first.'); return; }
      const btn = document.getElementById('upload-btn');
      btn.disabled = true; btn.textContent = 'Uploading...';
      document.getElementById('upload-progress-wrap').style.display = '';

      // Get signed URL
      const sigRes = await fetch('/admin/vsl/signed-url', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ filename: file.name, mimetype: file.type }) });
      const sig = await sigRes.json();
      if (sig.error) { alert('Error: ' + sig.error); btn.disabled = false; btn.textContent = 'Upload & Add to Library'; return; }

      // Upload to Supabase
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sig.signedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const pct = Math.round(e.loaded / e.total * 100);
            document.getElementById('upload-bar').style.width = pct + '%';
            document.getElementById('upload-pct').textContent = pct + '%';
            document.getElementById('upload-status').textContent = pct < 100 ? 'Uploading... ' + pct + '%' : 'Processing...';
          }
        };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error('Upload failed: ' + xhr.status));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
      }).catch(err => { alert(err.message); btn.disabled = false; btn.textContent = 'Upload & Add to Library'; throw err; });

      // Confirm (inserts into vsls table)
      const nameVal = document.getElementById('upload-name').value.trim();
      const confirmRes = await fetch('/admin/vsl/confirm', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ vsl_type: 'file', publicUrl: sig.publicUrl, name: nameVal || '' }) });
      const confirmData = await confirmRes.json();

      document.getElementById('upload-status').textContent = '✅ Upload complete!';
      document.getElementById('upload-result').innerHTML = '<div class="alert alert-success">✅ VSL added to library: <strong>' + (confirmData.vsl?.name || 'Video') + '</strong></div>';
      btn.disabled = false; btn.textContent = 'Upload & Add to Library';
      setTimeout(() => location.reload(), 1500);
    }
    function startRename(id, btn) {
      document.getElementById('rename-form-' + id).style.display = '';
      document.getElementById('rename-input-' + id).focus();
    }
    function cancelRename(id) {
      document.getElementById('rename-form-' + id).style.display = 'none';
    }
    async function submitRename(id) {
      const name = document.getElementById('rename-input-' + id).value.trim();
      if (!name) return;
      await fetch('/admin/vsl/' + id + '/rename', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name }) });
      document.getElementById('vsl-name-' + id).textContent = name;
      document.getElementById('rename-form-' + id).style.display = 'none';
    }
    </script>
  `, 'vsl'));
});

// Testimonials
router.get('/testimonials', requireAuth, async (req, res) => {
  const { data: testimonials } = await supabase.from('testimonials').select('*').order('sort_order').order('id');
  const msg = req.query.msg;

  const rows = (testimonials || []).map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.image_path ? `<img src="${t.image_path}" width="40" height="40" style="border-radius:50%;object-fit:cover">` : '—'}</td>
      <td><strong>${t.name}</strong>${t.handle ? `<br><span style="color:#64748b;font-size:12px">${t.handle}</span>` : ''}</td>
      <td>${t.earnings ? `<span class="badge badge-green">${t.earnings}</span>` : '—'}</td>
      <td style="max-width:300px;color:#94a3b8;font-size:13px">"${t.quote}"</td>
      <td><span class="badge ${t.active ? 'badge-green' : 'badge-gray'}">${t.active ? 'Active' : 'Hidden'}</span></td>
      <td>
        <form method="POST" action="/admin/testimonials/${t.id}/toggle" style="display:inline"><button class="btn btn-ghost btn-sm">${t.active ? 'Hide' : 'Show'}</button></form>
        <form method="POST" action="/admin/testimonials/${t.id}/delete" style="display:inline" onsubmit="return confirm('Delete?')"><button class="btn btn-danger btn-sm">Delete</button></form>
      </td>
    </tr>`).join('');

  res.send(layout('Testimonials', `
    ${msg === 'added' ? '<div class="alert alert-success">✅ Testimonial added.</div>' : ''}
    ${msg === 'deleted' ? '<div class="alert alert-success">✅ Deleted.</div>' : ''}
    <div class="card">
      <div class="card-title">Add Testimonial</div>
      <form method="POST" action="/admin/testimonials" enctype="multipart/form-data">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group"><label>Name *</label><input type="text" name="name" required placeholder="John Doe"></div>
          <div class="form-group"><label>Handle</label><input type="text" name="handle" placeholder="@johndoe"></div>
          <div class="form-group"><label>Earnings Claim</label><input type="text" name="earnings" placeholder="$3,200 in 30 days"></div>
          <div class="form-group"><label>Profile Photo</label><input type="file" name="image" accept="image/*"></div>
        </div>
        <div class="form-group"><label>Quote *</label><textarea name="quote" required placeholder="Their testimonial..."></textarea></div>
        <button type="submit" class="btn btn-primary">Add Testimonial</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">${(testimonials||[]).length} Testimonials</div>
      ${testimonials?.length ? `<table><thead><tr><th>#</th><th>Photo</th><th>Name</th><th>Earnings</th><th>Quote</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No testimonials yet.</div>'}
    </div>
  `, 'testimonials'));
});

router.post('/testimonials', requireAuth, upload.single('image'), async (req, res) => {
  const { name, handle, earnings, quote } = req.body;
  let image_path = null;
  if (req.file) {
    const ext = req.file.originalname.split('.').pop();
    image_path = await uploadToStorage('testimonials', `t-${Date.now()}.${ext}`, req.file.buffer, req.file.mimetype);
  }
  await supabase.from('testimonials').insert({ name, handle: handle||null, earnings: earnings||null, quote, image_path });
  res.redirect('/admin/testimonials?msg=added');
});

router.post('/testimonials/:id/toggle', requireAuth, async (req, res) => {
  const { data: t } = await supabase.from('testimonials').select('active').eq('id', req.params.id).single();
  if (t) await supabase.from('testimonials').update({ active: !t.active }).eq('id', req.params.id);
  res.redirect('/admin/testimonials');
});

router.post('/testimonials/:id/delete', requireAuth, async (req, res) => {
  await supabase.from('testimonials').delete().eq('id', req.params.id);
  res.redirect('/admin/testimonials?msg=deleted');
});

// Tracking Links
router.get('/tracking', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const owners = getAdminOwners(adminId);
  const adminLinkSlugs = await getAdminLinkSlugs(adminId);
  let linksQ = supabase.from('tracking_links').select('*').order('created_at', { ascending: false });
  if (adminLinkSlugs !== null) linksQ = adminLinkSlugs.length > 0 ? linksQ.in('slug', adminLinkSlugs) : linksQ.eq('slug', '__none__');
  const [{ data: links }, { data: variants }] = await Promise.all([
    linksQ,
    supabase.from('variants').select('id, name').in('owner', owners).order('created_at'),
  ]);
  const slugList = (links || []).map(l => l.slug);
  let visits = [], sigs = [];
  if (slugList.length > 0) {
    [{ data: visits }, { data: sigs }] = await Promise.all([
      supabase.from('visitors').select('tracking_slug').in('tracking_slug', slugList),
      supabase.from('signups').select('tracking_slug').in('tracking_slug', slugList),
    ]);
  }
  const vMap = {}, sMap = {};
  (visits||[]).forEach(v => { vMap[v.tracking_slug] = (vMap[v.tracking_slug]||0)+1; });
  (sigs||[]).forEach(s => { sMap[s.tracking_slug] = (sMap[s.tracking_slug]||0)+1; });
  const msg = req.query.msg;
  const host = req.headers.host || 'myfirstcreator.ai';

  // Build variant name lookup
  const variantNames = {};
  (variants||[]).forEach(v => { variantNames[v.id] = v.name; });

  const rows = (links||[]).map(l => {
    const visits = vMap[l.slug]||0, convs = sMap[l.slug]||0;
    const url = `https://${host}/r/${l.slug}`;
    const linkMode = l.link_mode || 'global';
    let modeLabel;
    if (linkMode === 'forced' && l.forced_variant_id && variantNames[l.forced_variant_id]) {
      modeLabel = `<span class="badge badge-purple" style="font-size:11px">${variantNames[l.forced_variant_id]}</span>`;
    } else if (linkMode === 'own' && l.rot_sequence && l.rot_sequence.length > 0) {
      modeLabel = `<span class="badge badge-blue" style="font-size:11px">own rotation (${l.rot_sequence.length} variants)</span>`;
    } else {
      modeLabel = `<span style="color:#475569;font-size:12px">global rotation</span>`;
    }
    return `<tr>
      <td><span class="slug-preview">/r/${l.slug}</span></td>
      <td>${l.name||'—'}</td>
      <td>${modeLabel}</td>
      <td>${visits}</td><td>${convs}</td><td>${visits>0?((convs/visits)*100).toFixed(1)+'%':'—'}</td>
      <td style="font-size:12px;color:#64748b">${new Date(l.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${url}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)">Copy</button>
        <a href="/admin/tracking/${l.id}/edit" class="btn btn-ghost btn-sm">Edit</a>
        <form method="POST" action="/admin/tracking/${l.id}/delete" style="display:inline" onsubmit="return confirm('Delete?')"><button class="btn btn-danger btn-sm">Delete</button></form>
      </td>
    </tr>`;
  }).join('');

  res.send(layout('Tracking Links', `
    <style>.badge-blue{background:#1e3a5f;color:#60a5fa;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}</style>
    ${msg==='added'?'<div class="alert alert-success">✅ Link created.</div>':''}
    ${msg==='exists'?'<div class="alert alert-error">⚠️ Slug already exists.</div>':''}
    ${msg==='deleted'?'<div class="alert alert-success">✅ Deleted.</div>':''}
    ${msg==='saved'?'<div class="alert alert-success">✅ Link updated.</div>':''}
    <div class="card">
      <div class="card-title">Create New Link</div>
      <form method="POST" action="/admin/tracking" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;align-items:end">
        <div class="form-group" style="margin:0"><label>Slug *</label><input type="text" name="slug" required placeholder="instagram" pattern="[a-z0-9-_]+"></div>
        <div class="form-group" style="margin:0"><label>Label</label><input type="text" name="name" placeholder="Instagram Bio"></div>
        <div class="form-group" style="margin:0"><label>Destination</label><input type="text" name="destination" value="/"></div>
        <div style="margin-bottom:0"><button type="submit" class="btn btn-primary" style="width:100%">Create</button></div>
      </form>
    </div>
    <div class="card">
      <div class="card-title">${(links||[]).length} Links</div>
      ${links?.length ? `<table><thead><tr><th>Slug</th><th>Label</th><th>Variant</th><th>Visits</th><th>Signups</th><th>CVR</th><th>Created</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No links yet.</div>'}
    </div>
  `, 'tracking'));
});

router.post('/tracking', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const { slug, name, destination } = req.body;
  const clean = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (!clean) return res.redirect('/admin/tracking');
  const { data: existing } = await supabase.from('tracking_links').select('id').eq('slug', clean).single();
  if (existing) return res.redirect('/admin/tracking?msg=exists');
  await supabase.from('tracking_links').insert({ slug: clean, name: name||null, destination: destination||'/', link_mode: 'global' });
  await addLinkToAdmin(adminId, clean);
  res.redirect('/admin/tracking?msg=added');
});

// Edit tracking link page
router.get('/tracking/:id/edit', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const owners = getAdminOwners(adminId);
  const [{ data: link }, { data: variants }] = await Promise.all([
    supabase.from('tracking_links').select('*').eq('id', req.params.id).single(),
    supabase.from('variants').select('id, name').in('owner', owners).order('created_at'),
  ]);
  if (!link) return res.redirect('/admin/tracking');

  const linkMode = link.link_mode || 'global';
  const rotSequence = Array.isArray(link.rot_sequence) ? link.rot_sequence : [];

  // Build forced variant select options
  const forcedOptions = (variants||[]).map(v =>
    `<option value="${v.id}" ${String(v.id) === String(link.forced_variant_id) ? 'selected' : ''}>${v.name}</option>`
  ).join('');

  // Build own-rotation variant checkboxes with ordering
  const ownVariantCheckboxes = (variants||[]).map(v => {
    const inSeq = rotSequence.includes(v.id);
    const seqPos = rotSequence.indexOf(v.id);
    return `<div class="own-variant-row" data-id="${v.id}" data-pos="${inSeq ? seqPos : 999}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#0a0a14;border:1px solid #1e1e30;border-radius:8px;margin-bottom:8px">
      <input type="checkbox" name="rot_variant_ids" value="${v.id}" id="rv${v.id}" ${inSeq ? 'checked' : ''} onchange="updateRotOrder()" style="width:16px;height:16px;accent-color:#60a5fa">
      <label for="rv${v.id}" style="flex:1;cursor:pointer;margin:0">${v.name}</label>
      <div style="display:flex;gap:4px">
        <button type="button" onclick="moveVariant(this,'up')" style="background:#1e1e30;border:none;color:#94a3b8;padding:4px 8px;border-radius:4px;cursor:pointer">↑</button>
        <button type="button" onclick="moveVariant(this,'down')" style="background:#1e1e30;border:none;color:#94a3b8;padding:4px 8px;border-radius:4px;cursor:pointer">↓</button>
      </div>
    </div>`;
  }).join('');

  // Active variant info
  const activeVariantName = link.rot_active_id && variantNames
    ? ((variants||[]).find(v => v.id === link.rot_active_id)?.name || `ID ${link.rot_active_id}`)
    : null;
  const activeInfo = (linkMode === 'own' && link.rot_active_id)
    ? `<div style="margin-top:12px;padding:10px 14px;background:#0a0a14;border:1px solid #1e3a5f;border-radius:8px;font-size:13px;color:#94a3b8">
        Currently showing: <strong style="color:#60a5fa">${activeVariantName}</strong>
        &nbsp;·&nbsp; ${link.rot_click_count || 0} clicks since last rotation
        ${link.rot_started_at ? `&nbsp;·&nbsp; Started: ${new Date(link.rot_started_at).toLocaleString()}` : ''}
      </div>`
    : '';

  // Sort own variant rows by their sequence position
  const sortedSequenceIds = JSON.stringify(rotSequence);

  res.send(layout('Edit Tracking Link', `
    <style>
      .badge-blue{background:#1e3a5f;color:#60a5fa;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
      .mode-section{display:none;margin-top:16px;padding:16px;background:#0d0d18;border:1px solid #1e1e30;border-radius:10px}
      .mode-section.active{display:block}
      .radio-option{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid #1e1e30;border-radius:8px;margin-bottom:10px;cursor:pointer;transition:.15s}
      .radio-option:hover{border-color:#3b3b5a}
      .radio-option input[type=radio]{margin-top:2px;accent-color:#a78bfa}
      .radio-option .opt-title{font-weight:600;color:#e2e8f0;font-size:14px}
      .radio-option .opt-desc{font-size:12px;color:#64748b;margin-top:2px}
    </style>
    <div class="card">
      <div class="card-title">Edit: /r/${link.slug}</div>
      <form method="POST" action="/admin/tracking/${link.id}/edit" id="edit-form">
        <div class="form-group"><label>Label</label><input type="text" name="name" value="${link.name||''}"></div>
        <div class="form-group"><label>Destination</label><input type="text" name="destination" value="${link.destination||'/'}"></div>

        <div class="form-group">
          <label>Rotation Mode</label>

          <div class="radio-option" onclick="setMode('global')" id="opt-global">
            <input type="radio" name="link_mode" value="global" id="mode-global" ${linkMode==='global'?'checked':''} onchange="setMode('global')">
            <div><div class="opt-title">🌐 Global rotation</div><div class="opt-desc">Follows the site-wide rotation settings</div></div>
          </div>

          <div class="radio-option" onclick="setMode('forced')" id="opt-forced">
            <input type="radio" name="link_mode" value="forced" id="mode-forced" ${linkMode==='forced'?'checked':''} onchange="setMode('forced')">
            <div><div class="opt-title">🎯 Force variant</div><div class="opt-desc">Always shows one specific variant to visitors from this link</div></div>
          </div>

          <div class="radio-option" onclick="setMode('own')" id="opt-own">
            <input type="radio" name="link_mode" value="own" id="mode-own" ${linkMode==='own'?'checked':''} onchange="setMode('own')">
            <div><div class="opt-title">🔄 Own rotation</div><div class="opt-desc">This link has its own independent rotation with custom variants and rules</div></div>
          </div>
        </div>

        <!-- Forced variant section -->
        <div class="mode-section ${linkMode==='forced'?'active':''}" id="section-forced">
          <div class="form-group" style="margin-bottom:0">
            <label>Variant to always show</label>
            <select name="forced_variant_id">
              <option value="">Select a variant…</option>
              ${forcedOptions}
            </select>
          </div>
        </div>

        <!-- Own rotation section -->
        <div class="mode-section ${linkMode==='own'?'active':''}" id="section-own">
          <div class="form-group">
            <label>Variants in rotation <span style="color:#64748b;font-size:12px">(check &amp; reorder)</span></label>
            <div id="own-variant-list">${ownVariantCheckboxes}</div>
            <input type="hidden" name="rot_sequence" id="rot-sequence-input" value='${sortedSequenceIds}'>
          </div>

          <div class="form-group">
            <label>Rotation mode</label>
            <select name="rot_mode" id="rot-mode-select" onchange="toggleRotMode(this.value)">
              <option value="click" ${(link.rot_mode||'click')==='click'?'selected':''}>Click-based — rotate after N visits</option>
              <option value="time" ${link.rot_mode==='time'?'selected':''}>Time-based — show for N hours</option>
            </select>
          </div>

          <div id="rot-click-section" style="${link.rot_mode==='time'?'display:none':''}">
            <div class="form-group">
              <label>Rotate after X visits</label>
              <input type="number" name="rot_click_threshold" value="${link.rot_click_threshold||500}" min="1" style="max-width:160px">
            </div>
          </div>

          <div id="rot-time-section" style="${link.rot_mode!=='time'?'display:none':''}">
            <div class="form-group">
              <label>Show each variant for X hours</label>
              <input type="number" name="rot_time_hours" value="${link.rot_time_hours||168}" min="0.1" step="0.1" style="max-width:160px">
            </div>
          </div>

          ${activeInfo}
        </div>

        <div class="flex" style="gap:12px;margin-top:20px">
          <button type="submit" class="btn btn-primary">Save Changes</button>
          <a href="/admin/tracking" class="btn btn-ghost">Cancel</a>
        </div>
      </form>
    </div>
    <script>
    function setMode(mode) {
      document.querySelectorAll('.mode-section').forEach(s => s.classList.remove('active'));
      var sec = document.getElementById('section-' + mode);
      if (sec) sec.classList.add('active');
      var radio = document.getElementById('mode-' + mode);
      if (radio) radio.checked = true;
    }

    function toggleRotMode(val) {
      document.getElementById('rot-click-section').style.display = val === 'click' ? '' : 'none';
      document.getElementById('rot-time-section').style.display = val === 'time' ? '' : 'none';
    }

    function updateRotOrder() {
      var rows = Array.from(document.querySelectorAll('#own-variant-list .own-variant-row'));
      var seq = rows
        .filter(r => r.querySelector('input[type=checkbox]').checked)
        .map(r => parseInt(r.dataset.id));
      document.getElementById('rot-sequence-input').value = JSON.stringify(seq);
    }

    function moveVariant(btn, dir) {
      var row = btn.closest('.own-variant-row');
      var list = document.getElementById('own-variant-list');
      if (dir === 'up' && row.previousElementSibling) {
        list.insertBefore(row, row.previousElementSibling);
      } else if (dir === 'down' && row.nextElementSibling) {
        list.insertBefore(row.nextElementSibling, row);
      }
      updateRotOrder();
    }

    // Sort own-variant-list by sequence position on load
    (function() {
      var seq = ${sortedSequenceIds};
      var list = document.getElementById('own-variant-list');
      var rows = Array.from(list.querySelectorAll('.own-variant-row'));
      rows.sort(function(a, b) {
        var ia = seq.indexOf(parseInt(a.dataset.id));
        var ib = seq.indexOf(parseInt(b.dataset.id));
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
      });
      rows.forEach(function(r) { list.appendChild(r); });
      updateRotOrder();
    })();
    </script>
  `, 'tracking'));
});

// Save tracking link edits
router.post('/tracking/:id/edit', requireAuth, async (req, res) => {
  const { name, destination, link_mode, forced_variant_id, rot_mode, rot_sequence, rot_click_threshold, rot_time_hours } = req.body;

  const mode = link_mode || 'global';
  const forcedId = (mode === 'forced' && forced_variant_id) ? parseInt(forced_variant_id) : null;

  // Parse rot_sequence JSON array
  let rotSeq = null;
  if (mode === 'own' && rot_sequence) {
    try { rotSeq = JSON.parse(rot_sequence); } catch { rotSeq = []; }
    if (!Array.isArray(rotSeq)) rotSeq = [];
  }

  const updateData = {
    name: name || null,
    destination: destination || '/',
    link_mode: mode,
    forced_variant_id: forcedId,
    rot_mode: mode === 'own' ? (rot_mode || 'click') : null,
    rot_sequence: mode === 'own' ? rotSeq : null,
    rot_click_threshold: (mode === 'own' && rot_mode !== 'time') ? (parseInt(rot_click_threshold) || 500) : null,
    rot_time_hours: (mode === 'own' && rot_mode === 'time') ? (parseFloat(rot_time_hours) || 168) : null,
  };

  // Fetch current link to check if we need to initialize 'own' mode state
  const { data: currentLink } = await supabase.from('tracking_links').select('link_mode, rot_active_id').eq('id', req.params.id).single();

  if (mode === 'own') {
    if (!currentLink || currentLink.link_mode !== 'own' || !currentLink.rot_active_id) {
      // Initialize rotation state when switching to own mode
      updateData.rot_active_id = (rotSeq && rotSeq.length > 0) ? rotSeq[0] : null;
      updateData.rot_click_count = 0;
      updateData.rot_started_at = new Date().toISOString();
    }
  } else {
    // Switching away from own mode — clear rotation state
    updateData.rot_active_id = null;
    updateData.rot_click_count = 0;
    updateData.rot_started_at = null;
  }

  await supabase.from('tracking_links').update(updateData).eq('id', req.params.id);
  res.redirect('/admin/tracking?msg=saved');
});

router.post('/tracking/:id/delete', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const { data: link } = await supabase.from('tracking_links').select('slug').eq('id', req.params.id).single();
  if (link) await removeLinkFromAdmin(adminId, link.slug);
  await supabase.from('tracking_links').delete().eq('id', req.params.id);
  res.redirect('/admin/tracking?msg=deleted');
});

// Site Settings
router.get('/settings', requireAuth, async (req, res) => {
  const { data: rows } = await supabase.from('settings').select('key, value');
  const s = {};
  (rows||[]).forEach(r => { s[r.key] = r.value; });
  const msg = req.query.msg;
  res.send(layout('Site Settings', `
    ${msg==='saved'?'<div class="alert alert-success">✅ Settings saved.</div>':''}
    <div class="card">
      <div class="card-title">Landing Page Copy</div>
      <form method="POST" action="/admin/settings">
        <div class="form-group"><label>Main Headline</label><input type="text" name="site_headline" value="${s.site_headline||''}"></div>
        <div class="form-group"><label>Sub-headline</label><textarea name="site_subheadline">${s.site_subheadline||''}</textarea></div>
        <div class="form-group"><label>CTA Button Text</label><input type="text" name="webinar_cta" value="${s.webinar_cta||''}"></div>
        <div class="form-group"><label>Signup Count Offset (adds to real count)</label><input type="number" name="signup_count_offset" value="${s.signup_count_offset||'0'}"></div>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
    </div>
  `, 'settings'));
});

router.post('/settings', requireAuth, async (req, res) => {
  const fields = ['site_headline', 'site_subheadline', 'webinar_cta', 'signup_count_offset'];
  await Promise.all(fields.map(f => req.body[f] !== undefined ? setSetting(f, req.body[f]) : null));
  res.redirect('/admin/settings?msg=saved');
});

// Mount sub-routers
router.use('/variants', variantsRouter);
router.use('/variants', builderRouter);
router.use('/variants', customRouter);

module.exports = router;
