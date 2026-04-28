const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { renderPageFromBlocks } = require('./block-renderer');
const { renderLandingPage } = require('./admin-variants');

// ─── Auth ────────────────────────────────────────────────────────────────────

function requireSuper(req, res, next) {
  if (req.session?.superAdmin) return next();
  res.redirect('/superadmin/login');
}

// ─── Shared layout ────────────────────────────────────────────────────────────

const layout = (title, content, activePage = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Super Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e2e8f0; display: flex; min-height: 100vh; }
    .sidebar { width: 220px; background: #0f0f1a; border-right: 1px solid #1a1a2e; padding: 24px 0; flex-shrink: 0; position: fixed; top: 0; left: 0; height: 100vh; overflow-y: auto; }
    .sidebar-logo { padding: 0 20px 8px; font-size: 14px; font-weight: 700; color: #f59e0b; margin-bottom: 4px; }
    .sidebar-sub { padding: 0 20px 20px; font-size: 11px; color: #374151; border-bottom: 1px solid #1a1a2e; margin-bottom: 16px; }
    .sidebar a { display: block; padding: 10px 20px; color: #94a3b8; text-decoration: none; font-size: 14px; transition: all 0.15s; }
    .sidebar a:hover, .sidebar a.active { background: #1a1a2e; color: #f59e0b; }
    .sidebar a.active { border-left: 3px solid #f59e0b; }
    .sidebar-section { padding: 8px 20px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; margin-top: 8px; }
    .main { margin-left: 220px; flex: 1; padding: 32px; }
    .page-title { font-size: 24px; font-weight: 700; color: #f1f5f9; margin-bottom: 24px; }
    .card { background: #0f0f1a; border: 1px solid #1a1a2e; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .card-title { font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat { background: #0f0f1a; border: 1px solid #1a1a2e; border-radius: 12px; padding: 20px; }
    .stat-num { font-size: 32px; font-weight: 700; color: #f59e0b; }
    .stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; color: #64748b; font-weight: 600; border-bottom: 1px solid #1a1a2e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px; border-bottom: 1px solid #111122; color: #cbd5e1; vertical-align: top; }
    tr:hover td { background: #111122; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge-gold { background: #451a03; color: #fbbf24; }
    .badge-gray { background: #1e293b; color: #64748b; }
    .badge-green { background: #064e3b; color: #6ee7b7; }
    .badge-purple { background: #3b0764; color: #c4b5fd; }
    input, textarea, select { background: #1a1a2e; border: 1px solid #2d2d4a; color: #e2e8f0; padding: 10px 12px; border-radius: 8px; font-size: 14px; width: 100%; outline: none; font-family: inherit; }
    input:focus, textarea:focus, select:focus { border-color: #f59e0b; }
    label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; font-weight: 500; }
    .form-group { margin-bottom: 16px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; text-decoration: none; }
    .btn-gold { background: linear-gradient(135deg, #d97706, #f59e0b); color: #000; }
    .btn-gold:hover { opacity: 0.9; }
    .btn-danger { background: #7f1d1d; color: #fca5a5; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .btn-ghost { background: #1a1a2e; color: #94a3b8; border: 1px solid #2d2d4a; }
    .btn-ghost:hover { background: #2d2d4a; color: #e2e8f0; }
    .alert-success { background: #064e3b; color: #6ee7b7; border: 1px solid #065f46; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .empty { text-align: center; padding: 48px; color: #475569; }
    .flex { display: flex; align-items: center; gap: 12px; }
    .flex-between { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .super-tag { font-size: 10px; background: #451a03; color: #fbbf24; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  </style>
</head>
<body>
  <nav class="sidebar">
    <div class="sidebar-logo">⚡ Super Admin</div>
    <div class="sidebar-sub">Steven — Full Control</div>
    <a href="/superadmin/dashboard" class="${activePage==='dashboard'?'active':''}">📊 Overview</a>
    <div class="sidebar-section">Traffic Control</div>
    <a href="/superadmin/rotation" class="${activePage==='rotation'?'active':''}">🎛️ Traffic Split</a>
    <a href="/superadmin/variants" class="${activePage==='variants'?'active':''}">🧪 All Variants</a>
    <a href="/superadmin/my-variants" class="${activePage==='my-variants'?'active':''}">⚡ My Variants</a>
    <div class="sidebar-section">Admin View</div>
    <a href="/admin/dashboard" target="_blank">👁️ View Admin Panel ↗</a>
    <a href="/" target="_blank">🌐 Live Site ↗</a>
    <a href="/superadmin/logout" style="margin-top:24px">🚪 Logout</a>
  </nav>
  <main class="main">
    <div class="page-title">${title}</div>
    ${content}
  </main>
</body>
</html>`;

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single();
  return data?.value ?? null;
}
async function setSetting(key, value) {
  await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
}

// ─── Login ────────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session?.superAdmin) return res.redirect('/superadmin/dashboard');
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Super Admin</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:#0f0f1a;border:1px solid #1a1a2e;border-radius:16px;padding:40px;width:360px}.logo{text-align:center;font-size:20px;font-weight:700;color:#f59e0b;margin-bottom:4px}.sub{text-align:center;font-size:12px;color:#374151;margin-bottom:32px}label{display:block;font-size:13px;color:#94a3b8;margin-bottom:6px}input{width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:12px;border-radius:8px;font-size:14px;margin-bottom:16px;outline:none}button{width:100%;padding:12px;background:linear-gradient(135deg,#d97706,#f59e0b);color:#000;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}.error{color:#f87171;font-size:13px;text-align:center;margin-bottom:12px}</style>
  </head><body><div class="box"><div class="logo">⚡ Super Admin</div><div class="sub">Private access — do not share this URL</div>
  ${req.query.error ? '<div class="error">Invalid credentials</div>' : ''}
  <form method="POST"><label>Email</label><input type="email" name="username" required autocomplete="off"><label>Password</label><input type="password" name="password" required><button type="submit">Enter</button></form>
  </div></body></html>`);
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === (process.env.SUPER_USERNAME || 'super@mfc.ai') && password === (process.env.SUPER_PASSWORD || 'changeme')) {
    req.session.superAdmin = true;
    return res.redirect('/superadmin/dashboard');
  }
  res.redirect('/superadmin/login?error=1');
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/superadmin/login'); });

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get('/dashboard', requireSuper, async (req, res) => {
  const [
    { count: totalSignups },
    { count: mySignups },
    { count: adminSignups },
    { count: totalVisits },
  ] = await Promise.all([
    supabase.from('signups').select('*', { count: 'exact', head: true }),
    supabase.from('signups').select('*', { count: 'exact', head: true }).in('variant_id',
      (await supabase.from('variants').select('id').eq('owner','super')).data?.map(v=>v.id) || [-1]
    ),
    supabase.from('signups').select('*', { count: 'exact', head: true }).in('variant_id',
      (await supabase.from('variants').select('id').eq('owner','admin')).data?.map(v=>v.id) || [-1]
    ),
    supabase.from('visitors').select('*', { count: 'exact', head: true }),
  ]);

  const superPct = await getSetting('super_traffic_pct') || '25';
  const { data: recentAll } = await supabase.from('signups').select('*, variants(name,owner)').order('signed_up_at', { ascending: false }).limit(15);

  const rows = (recentAll || []).map(s => {
    const owner = s.variants?.owner || 'admin';
    const vname = s.variants?.name || '—';
    return `<tr>
      <td>${s.name || '—'}</td>
      <td><strong>${s.email}</strong></td>
      <td>${vname} ${owner==='super' ? '<span class="super-tag">MINE</span>' : ''}</td>
      <td>${s.country || s.ip}</td>
      <td style="color:#64748b;font-size:12px">${new Date(s.signed_up_at).toLocaleString()}</td>
    </tr>`;
  }).join('');

  res.send(layout('Overview', `
    <div class="stat-grid">
      <div class="stat"><div class="stat-num">${totalSignups||0}</div><div class="stat-label">Total Signups (all)</div></div>
      <div class="stat"><div class="stat-num" style="color:#f59e0b">${mySignups||0}</div><div class="stat-label">My Signups ⚡</div></div>
      <div class="stat"><div class="stat-num" style="color:#a78bfa">${adminSignups||0}</div><div class="stat-label">Admin Signups</div></div>
      <div class="stat"><div class="stat-num">${totalVisits||0}</div><div class="stat-label">Total Visits</div></div>
      <div class="stat"><div class="stat-num">${superPct}%</div><div class="stat-label">My Traffic Share</div></div>
    </div>
    <div class="card">
      <div class="card-title">All Recent Signups</div>
      ${recentAll?.length ? `<table><thead><tr><th>Name</th><th>Email</th><th>Variant</th><th>Location</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No signups yet</div>'}
    </div>
  `, 'dashboard'));
});

// ─── Traffic Split control ────────────────────────────────────────────────────

router.get('/rotation', requireSuper, async (req, res) => {
  const { data: myVariants } = await supabase.from('variants').select('*').eq('owner','super').order('created_at');
  const superPct = await getSetting('super_traffic_pct') || '25';
  const superActiveId = await getSetting('super_active_variant_id');
  const msg = req.query.msg;

  const variantOptions = (myVariants || []).map(v =>
    `<label style="display:flex;align-items:center;gap:10px;padding:10px;background:#111122;border-radius:8px;margin-bottom:8px;cursor:pointer">
      <input type="radio" name="super_active_id" value="${v.id}" ${String(v.id)===String(superActiveId)?'checked':''} style="width:auto;margin:0">
      <span>${v.name}</span>
      ${String(v.id)===String(superActiveId) ? '<span class="badge badge-gold" style="margin-left:auto">LIVE</span>' : ''}
    </label>`
  ).join('');

  res.send(layout('Traffic Split', `
    ${msg==='saved' ? '<div class="alert-success">✅ Settings saved.</div>' : ''}
    <form method="POST" action="/superadmin/rotation">
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">My Traffic Share</div>
        <p style="font-size:13px;color:#64748b;margin-bottom:16px">
          This % of all page visits goes to YOUR variants. The rest goes to the admin's rotation as normal.
        </p>
        <div class="form-group">
          <label>My share of traffic (%)</label>
          <input type="number" name="super_traffic_pct" value="${superPct}" min="0" max="99" style="max-width:120px">
          <div style="font-size:12px;color:#64748b;margin-top:6px">E.g. 25 = 25% to your pages, 75% to admin's pages</div>
        </div>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">My Active Variant</div>
        <p style="font-size:13px;color:#64748b;margin-bottom:16px">Which of your variants serves during your traffic share?</p>
        ${myVariants?.length ? variantOptions : '<div class="empty" style="padding:20px">No variants yet — <a href="/superadmin/my-variants/new" style="color:#f59e0b">create one first</a></div>'}
      </div>
      <button type="submit" class="btn btn-gold">Save Settings</button>
    </form>
  `, 'rotation'));
});

router.post('/rotation', requireSuper, async (req, res) => {
  const { super_traffic_pct, super_active_id } = req.body;
  await Promise.all([
    setSetting('super_traffic_pct', super_traffic_pct || '25'),
    super_active_id ? setSetting('super_active_variant_id', super_active_id) : Promise.resolve(),
  ]);
  res.redirect('/superadmin/rotation?msg=saved');
});

// ─── All variants (read-only view of admin's variants + my variants) ──────────

router.get('/variants', requireSuper, async (req, res) => {
  const { data: variants } = await supabase.from('variants').select('*').order('owner').order('created_at', { ascending: false });

  const { data: visitRows } = await supabase.from('visitors').select('variant_id');
  const { data: signupRows } = await supabase.from('signups').select('variant_id');
  const vMap = {}, sMap = {};
  (visitRows||[]).forEach(r => { if(r.variant_id) vMap[r.variant_id]=(vMap[r.variant_id]||0)+1; });
  (signupRows||[]).forEach(r => { if(r.variant_id) sMap[r.variant_id]=(sMap[r.variant_id]||0)+1; });

  const superActiveId = await getSetting('super_active_variant_id');
  const adminActiveId = await getSetting('rot_active_id');

  const rows = (variants||[]).map(v => {
    const isMine = v.owner === 'super';
    const isLive = isMine ? String(v.id)===String(superActiveId) : String(v.id)===String(adminActiveId);
    const visits = vMap[v.id]||0, signups = sMap[v.id]||0;
    const cvr = visits>0 ? ((signups/visits)*100).toFixed(1)+'%' : '—';
    return `<tr>
      <td>
        ${isMine ? '<span class="super-tag">MINE</span> ' : ''}
        <strong>${v.name}</strong>
        ${isLive ? ' <span class="badge badge-green">LIVE</span>' : ''}
      </td>
      <td>${isMine ? '<span style="color:#f59e0b">⚡ Yours</span>' : '<span style="color:#94a3b8">Admin</span>'}</td>
      <td>${v.page_mode || 'simple'}</td>
      <td>${visits}</td><td>${signups}</td><td>${cvr}</td>
      <td>${isMine ? `<a href="/superadmin/my-variants/${v.id}/edit" class="btn btn-ghost btn-sm">Edit</a>` : '<span style="color:#334155;font-size:12px">read only</span>'}</td>
    </tr>`;
  }).join('');

  res.send(layout('All Variants', `
    <div class="flex-between">
      <p style="font-size:13px;color:#64748b">Showing all variants — admin's and yours. Admin cannot see yours.</p>
      <a href="/superadmin/my-variants/new" class="btn btn-gold btn-sm">+ New My Variant</a>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Name</th><th>Owner</th><th>Mode</th><th>Visits</th><th>Signups</th><th>CVR</th><th>Actions</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#475569;padding:32px">No variants yet</td></tr>'}</tbody>
      </table>
    </div>
  `, 'variants'));
});

// ─── My variants (CRUD) ───────────────────────────────────────────────────────

router.get('/my-variants', requireSuper, async (req, res) => {
  const { data: variants } = await supabase.from('variants').select('*').eq('owner','super').order('created_at', { ascending: false });
  const superActiveId = await getSetting('super_active_variant_id');
  const superPct = await getSetting('super_traffic_pct') || '25';

  const rows = (variants||[]).map(v => {
    const isActive = String(v.id)===String(superActiveId);
    return `<tr>
      <td><strong>${v.name}</strong> ${isActive?'<span class="badge badge-gold">LIVE</span>':''}</td>
      <td>${v.page_mode||'simple'}</td>
      <td>
        <div class="flex" style="gap:6px">
          <a href="/superadmin/my-variants/${v.id}/edit" class="btn btn-ghost btn-sm">Edit</a>
          <a href="/superadmin/my-variants/${v.id}/custom" class="btn btn-ghost btn-sm" style="color:#f59e0b">✨ Custom</a>
          <a href="/superadmin/my-variants/${v.id}/preview" target="_blank" class="btn btn-ghost btn-sm">Preview</a>
          ${!isActive ? `<form method="POST" action="/superadmin/my-variants/${v.id}/activate" style="display:inline"><button class="btn btn-gold btn-sm">Set Live</button></form>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  res.send(layout('My Variants', `
    <div style="background:#1c1207;border:1px solid #451a03;border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#fbbf24">
      ⚡ Your traffic share is currently <strong>${superPct}%</strong>. 
      <a href="/superadmin/rotation" style="color:#f59e0b;margin-left:8px">Change →</a>
    </div>
    <div class="flex-between">
      <div></div>
      <a href="/superadmin/my-variants/new" class="btn btn-gold">+ New Variant</a>
    </div>
    <div class="card">
      ${variants?.length ? `<table><thead><tr><th>Name</th><th>Mode</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty">No variants yet — create your first one to inject into the rotation.</div>'}
    </div>
  `, 'my-variants'));
});

// New variant form
router.get('/my-variants/new', requireSuper, (req, res) => {
  res.send(layout('New My Variant', myVariantForm({}), 'my-variants'));
});

router.get('/my-variants/:id/edit', requireSuper, async (req, res) => {
  const { data: v } = await supabase.from('variants').select('*').eq('id', req.params.id).eq('owner','super').single();
  if (!v) return res.redirect('/superadmin/my-variants');
  res.send(layout(`Edit: ${v.name}`, myVariantForm(v), 'my-variants'));
});

router.post('/my-variants/new', requireSuper, async (req, res) => {
  const { name, headline, subheadline, cta_text, badge_text, vsl_type, vsl_url, trust_items } = req.body;
  const { data } = await supabase.from('variants').insert({
    name, headline, subheadline, cta_text, badge_text,
    vsl_type: vsl_type||'none', vsl_url, trust_items,
    owner: 'super', updated_at: new Date().toISOString()
  }).select().single();
  // Auto-set as super active if first one
  const existing = await getSetting('super_active_variant_id');
  if (!existing && data) await setSetting('super_active_variant_id', String(data.id));
  res.redirect('/superadmin/my-variants');
});

router.post('/my-variants/:id/edit', requireSuper, async (req, res) => {
  const { name, headline, subheadline, cta_text, badge_text, vsl_type, vsl_url, trust_items } = req.body;
  await supabase.from('variants').update({
    name, headline, subheadline, cta_text, badge_text,
    vsl_type: vsl_type||'none', vsl_url, trust_items,
    updated_at: new Date().toISOString()
  }).eq('id', req.params.id).eq('owner','super');
  res.redirect('/superadmin/my-variants');
});

router.post('/my-variants/:id/activate', requireSuper, async (req, res) => {
  await setSetting('super_active_variant_id', req.params.id);
  res.redirect('/superadmin/my-variants');
});

router.post('/my-variants/:id/delete', requireSuper, async (req, res) => {
  await supabase.from('variants').delete().eq('id', req.params.id).eq('owner','super');
  res.redirect('/superadmin/my-variants');
});

// Custom HTML editor for super variants
router.get('/my-variants/:id/custom', requireSuper, async (req, res) => {
  // Reuse the custom editor but for super variants
  res.redirect(`/admin/variants/${req.params.id}/custom`);
});

// Preview
router.get('/my-variants/:id/preview', requireSuper, async (req, res) => {
  const { data: v } = await supabase.from('variants').select('*').eq('id', req.params.id).eq('owner','super').single();
  if (!v) return res.status(404).send('Not found');
  const { data: testimonials } = await supabase.from('testimonials').select('*').eq('active', true).order('sort_order').limit(6);
  if (v.page_mode === 'custom' && v.custom_html) {
    res.send(v.custom_html.replace('<body>', '<body><div style="position:fixed;top:0;left:0;right:0;background:#d97706;color:white;text-align:center;padding:8px;font-size:13px;z-index:99999">⚡ SUPER ADMIN PREVIEW</div><div style="height:36px"></div>'));
  } else if (v.page_mode === 'builder' && v.blocks?.length) {
    res.send(renderPageFromBlocks(v.blocks, testimonials||[], true));
  } else {
    res.send(renderLandingPage(v, testimonials||[], true));
  }
});

function myVariantForm(v = {}) {
  const isEdit = !!v.id;
  return `
    <form method="POST" action="/superadmin/my-variants/${isEdit ? v.id+'/edit' : 'new'}">
      <div class="card" style="margin-bottom:20px">
        <div class="form-group"><label>Variant Name (internal)</label><input type="text" name="name" value="${v.name||''}" placeholder="My secret variant A" required></div>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">Hero Copy</div>
        <div class="form-group"><label>Badge Pill</label><input type="text" name="badge_text" value="${v.badge_text||''}" placeholder="🔥 Limited Spots"></div>
        <div class="form-group"><label>Headline</label><input type="text" name="headline" value="${v.headline||''}" placeholder="Your headline"></div>
        <div class="form-group"><label>Subheadline</label><textarea name="subheadline" rows="3">${v.subheadline||''}</textarea></div>
        <div class="form-group"><label>CTA Button Text</label><input type="text" name="cta_text" value="${v.cta_text||''}" placeholder="Get Started →"></div>
        <div class="form-group"><label>Trust Items (one per line)</label><textarea name="trust_items" rows="3">${v.trust_items||'✅ 100% Free\n🔒 No Credit Card'}</textarea></div>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">VSL</div>
        <div class="form-group"><label>Type</label>
          <select name="vsl_type"><option value="none" ${(!v.vsl_type||v.vsl_type==='none')?'selected':''}>None</option><option value="url" ${v.vsl_type==='url'?'selected':''}>YouTube/Vimeo URL</option></select>
        </div>
        <div class="form-group"><label>Embed URL</label><input type="text" name="vsl_url" value="${v.vsl_url||''}" placeholder="https://www.youtube.com/embed/..."></div>
      </div>
      <div class="flex" style="gap:12px">
        <button type="submit" class="btn btn-gold">${isEdit?'Save Changes':'Create Variant'}</button>
        <a href="/superadmin/my-variants" class="btn btn-ghost">Cancel</a>
        ${isEdit ? `<form method="POST" action="/superadmin/my-variants/${v.id}/delete" style="margin-left:auto" onsubmit="return confirm('Delete?')"><button class="btn btn-danger btn-sm">Delete</button></form>` : ''}
      </div>
    </form>`;
}

module.exports = router;
