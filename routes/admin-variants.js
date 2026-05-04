const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { getAdminOwners, rotKey } = require('./admin-utils');

// ─── helpers ────────────────────────────────────────────────────────────────

async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single();
  return data?.value ?? null;
}
async function setSetting(key, value) {
  await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
}

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.redirect('/admin/login');
}

// ─── rotation engine ─────────────────────────────────────────────────────────
// Returns the variant_id that should be shown right now, and bumps counters.
// Also handles auto-rotation when thresholds are hit.

async function getActiveVariant() {
  const [modeRaw, sequenceRaw, activeIdRaw, clickCountRaw, startedAtRaw, clickThreshRaw, timeHoursRaw] = await Promise.all([
    getSetting('rot_mode'),           // 'manual' | 'click' | 'time'
    getSetting('rot_sequence'),       // JSON array of variant IDs in order
    getSetting('rot_active_id'),      // current active variant ID
    getSetting('rot_click_count'),    // visits to current variant this window
    getSetting('rot_started_at'),     // ISO timestamp when current window started
    getSetting('rot_click_threshold'),// visits before rotating (click mode)
    getSetting('rot_time_hours'),     // hours per variant (time mode)
  ]);

  const mode = modeRaw || 'manual';
  const sequence = sequenceRaw ? JSON.parse(sequenceRaw) : [];
  let activeId = activeIdRaw ? parseInt(activeIdRaw) : null;
  let clickCount = parseInt(clickCountRaw || '0');
  let startedAt = startedAtRaw ? new Date(startedAtRaw) : new Date();

  if (!activeId || sequence.length === 0) return null;

  // Check if we need to rotate
  let shouldRotate = false;
  if (mode === 'click') {
    const thresh = parseInt(clickThreshRaw || '500');
    if (clickCount >= thresh) shouldRotate = true;
  } else if (mode === 'time') {
    const hours = parseFloat(timeHoursRaw || '168');
    const elapsed = (Date.now() - startedAt.getTime()) / 3600000;
    if (elapsed >= hours) shouldRotate = true;
  }

  if (shouldRotate && sequence.length > 1) {
    const idx = sequence.indexOf(activeId);
    const nextIdx = (idx + 1) % sequence.length;
    activeId = sequence[nextIdx];
    await Promise.all([
      setSetting('rot_active_id', String(activeId)),
      setSetting('rot_click_count', '0'),
      setSetting('rot_started_at', new Date().toISOString()),
    ]);
    clickCount = 0;
  }

  // Bump click count
  await setSetting('rot_click_count', String(clickCount + 1));

  return activeId;
}

// Call this at signup time to attribute the signup to the right variant
async function attributeSignup(variantId, signupId) {
  if (!variantId || !signupId) return;
  await supabase.from('signups').update({ variant_id: variantId }).eq('id', signupId);
}

module.exports.getActiveVariant = getActiveVariant;
module.exports.router = router;

// ─── admin pages ─────────────────────────────────────────────────────────────

const layout = require('./admin-layout');
const { renderPageFromBlocks } = require('./block-renderer');

// List variants
router.get('/', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const owners = getAdminOwners(adminId);
  const { data: variants } = await supabase.from('variants').select('*').in('owner', owners).order('created_at', { ascending: false });

  // Stats per variant
  const { data: visitRows } = await supabase.from('visitors').select('variant_id');
  const { data: signupRows } = await supabase.from('signups').select('variant_id');
  const vMap = {}, sMap = {};
  (visitRows || []).forEach(r => { if (r.variant_id) vMap[r.variant_id] = (vMap[r.variant_id] || 0) + 1; });
  (signupRows || []).forEach(r => { if (r.variant_id) sMap[r.variant_id] = (sMap[r.variant_id] || 0) + 1; });

  // Rotation state (scoped per admin)
  const [mode, activeId, clickCount, startedAt, clickThresh, timeHours, sequenceRaw] = await Promise.all([
    getSetting(rotKey(adminId,'mode')), getSetting(rotKey(adminId,'active_id')), getSetting(rotKey(adminId,'click_count')),
    getSetting(rotKey(adminId,'started_at')), getSetting(rotKey(adminId,'click_threshold')), getSetting(rotKey(adminId,'time_hours')),
    getSetting(rotKey(adminId,'sequence')),
  ]);
  const sequence = sequenceRaw ? JSON.parse(sequenceRaw) : [];

  const rows = (variants || []).map(v => {
    const visits = vMap[v.id] || 0;
    const signups = sMap[v.id] || 0;
    const cvr = visits > 0 ? ((signups / visits) * 100).toFixed(1) + '%' : '—';
    const isActive = String(v.id) === String(activeId);
    const inRotation = sequence.includes(v.id);
    return `<tr>
      <td><strong>${v.name}</strong>${isActive ? ' <span class="badge badge-green">LIVE</span>' : ''}${inRotation && !isActive ? ' <span class="badge badge-gray">in rotation</span>' : ''}</td>
      <td style="color:#94a3b8;font-size:13px">${(v.headline || '').substring(0, 50)}${v.headline?.length > 50 ? '...' : ''}</td>
      <td>${visits}</td><td>${signups}</td><td>${cvr}</td>
      <td>
        <div class="flex" style="gap:6px">
          <a href="/admin/variants/${v.id}/edit" class="btn btn-ghost btn-sm">Quick Edit</a>
          <a href="/admin/variants/${v.id}/builder" class="btn btn-ghost btn-sm" style="color:#a78bfa">🧱 Builder</a>
          <a href="/admin/variants/${v.id}/custom" class="btn btn-ghost btn-sm" style="color:#06b6d4">✨ Custom</a>
          <a href="/admin/variants/${v.id}/preview" target="_blank" class="btn btn-ghost btn-sm">Preview</a>
          ${!isActive ? `<form method="POST" action="/admin/variants/${v.id}/activate" style="display:inline"><button class="btn btn-primary btn-sm">Set Live</button></form>` : '<span style="color:#6ee7b7;font-size:12px">● Live</span>'}
        </div>
      </td>
    </tr>`;
  }).join('');

  const rotSummary = mode === 'click'
    ? `Click-based · rotate after <strong>${clickThresh || 500}</strong> visits · <strong>${clickCount || 0}</strong> visits this window`
    : mode === 'time'
    ? `Time-based · rotate every <strong>${timeHours || 168}</strong> hours · started ${startedAt ? new Date(startedAt).toLocaleString() : '—'}`
    : `Manual — you control which variant is live`;

  res.send(layout('Landing Page Variants', `
    <div class="flex-between" style="margin-bottom:20px">
      <div></div>
      <a href="/admin/variants/new" class="btn btn-primary">+ New Variant</a>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title">Rotation Settings</div>
      <p style="font-size:14px;color:#94a3b8;margin-bottom:16px">${rotSummary}</p>
      <a href="/admin/variants/rotation" class="btn btn-ghost btn-sm">⚙️ Configure Rotation</a>
    </div>

    <div class="card">
      <div class="card-title">All Variants</div>
      ${variants?.length ? `
        <table>
          <thead><tr><th>Name</th><th>Headline</th><th>Visits</th><th>Signups</th><th>CVR</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` : `
        <div class="empty">No variants yet. <a href="/admin/variants/new" style="color:#a78bfa">Create your first one →</a></div>`}
    </div>
  `, 'variants'));
});

// New variant form
router.get('/new', requireAuth, async (req, res) => {
  const { data: vsls } = await supabase.from('vsls').select('id, name, type').order('created_at', { ascending: false });
  res.send(layout('New Variant', variantForm({}, vsls || []), 'variants'));
});

// Edit variant form
router.get('/:id/edit', requireAuth, async (req, res) => {
  const [{ data: v }, { data: vsls }] = await Promise.all([
    supabase.from('variants').select('*').eq('id', req.params.id).single(),
    supabase.from('vsls').select('id, name, type').order('created_at', { ascending: false }),
  ]);
  if (!v) return res.redirect('/admin/variants');
  res.send(layout(`Edit: ${v.name}`, variantForm(v, vsls || []), 'variants'));
});

// Create variant
router.post('/new', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const { name, headline, subheadline, cta_text, badge_text, vsl_source, vsl_id, vsl_url, trust_items, cta_destination, cta_link } = req.body;
  // Determine VSL fields based on picker selection
  let resolvedVslType = 'none';
  let resolvedVslUrl = null;
  let resolvedVslId = null;
  if (vsl_source === 'library' && vsl_id) {
    resolvedVslId = parseInt(vsl_id);
    resolvedVslType = 'library';
  } else if (vsl_source === 'url' && vsl_url) {
    resolvedVslType = 'url';
    resolvedVslUrl = vsl_url;
  }
  const { data } = await supabase.from('variants').insert({
    name, headline, subheadline, cta_text, badge_text, cta_destination: cta_destination||'signup', cta_link: cta_link||null,
    vsl_type: resolvedVslType, vsl_url: resolvedVslUrl, vsl_id: resolvedVslId,
    trust_items,
    owner: adminId,
    updated_at: new Date().toISOString()
  }).select().single();

  // If first variant for this admin, auto-set as active in their rotation
  const activeId = await getSetting(rotKey(adminId, 'active_id'));
  if (!activeId && data) {
    await Promise.all([
      setSetting(rotKey(adminId, 'active_id'), String(data.id)),
      setSetting(rotKey(adminId, 'sequence'), JSON.stringify([data.id])),
      setSetting(rotKey(adminId, 'mode'), 'manual'),
      setSetting(rotKey(adminId, 'click_count'), '0'),
      setSetting(rotKey(adminId, 'started_at'), new Date().toISOString()),
    ]);
  }
  res.redirect('/admin/variants');
});

// Update variant
router.post('/:id/edit', requireAuth, async (req, res) => {
  const { name, headline, subheadline, cta_text, badge_text, vsl_source, vsl_id, vsl_url, trust_items, cta_destination, cta_link } = req.body;
  // Determine VSL fields based on picker selection
  let resolvedVslType = 'none';
  let resolvedVslUrl = null;
  let resolvedVslId = null;
  if (vsl_source === 'library' && vsl_id) {
    resolvedVslId = parseInt(vsl_id);
    resolvedVslType = 'library';
  } else if (vsl_source === 'url' && vsl_url) {
    resolvedVslType = 'url';
    resolvedVslUrl = vsl_url;
  }
  await supabase.from('variants').update({
    name, headline, subheadline, cta_text, badge_text, cta_destination: cta_destination||'signup', cta_link: cta_link||null,
    vsl_type: resolvedVslType, vsl_url: resolvedVslUrl, vsl_id: resolvedVslId,
    trust_items,
    updated_at: new Date().toISOString()
  }).eq('id', req.params.id);
  res.redirect('/admin/variants');
});

// Set live (manual activation)
router.post('/:id/activate', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const id = parseInt(req.params.id);
  await Promise.all([
    setSetting(rotKey(adminId, 'active_id'), String(id)),
    setSetting(rotKey(adminId, 'click_count'), '0'),
    setSetting(rotKey(adminId, 'started_at'), new Date().toISOString()),
  ]);
  res.redirect('/admin/variants');
});

// Delete variant
router.post('/:id/delete', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const owners = getAdminOwners(adminId);
  // Only allow deleting variants that belong to this admin
  await supabase.from('variants').delete().eq('id', req.params.id).in('owner', owners);
  res.redirect('/admin/variants');
});

// Preview variant (renders the actual page with that variant's content)
router.get('/:id/preview', requireAuth, async (req, res) => {
  const { data: v } = await supabase.from('variants').select('*').eq('id', req.params.id).single();
  if (!v) return res.status(404).send('Not found');
  const { data: testimonials } = await supabase.from('testimonials').select('*').eq('active', true).order('sort_order').limit(50);
  // Fetch VSL from library if variant has vsl_id
  let vslData = null;
  if (v.vsl_id) {
    const { data: vsl } = await supabase.from('vsls').select('*').eq('id', v.vsl_id).single();
    vslData = vsl || null;
  }
  if (v.page_mode === 'custom' && v.custom_html) {
    const html = v.custom_html.replace('<body>', '<body><div style="position:fixed;top:0;left:0;right:0;background:#7c3aed;color:white;text-align:center;padding:8px;font-size:13px;z-index:99999">⚠️ PREVIEW MODE</div><div style="height:36px"></div>');
    res.send(html);
  } else if (v.page_mode === 'builder' && v.blocks?.length > 0) {
    res.send(renderPageFromBlocks(v.blocks, testimonials || [], true));
  } else {
    res.send(renderLandingPage(v, testimonials || [], true, vslData));
  }
});

// Rotation settings page
router.get('/rotation', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const owners = getAdminOwners(adminId);
  const { data: variants } = await supabase.from('variants').select('id, name, enabled').in('owner', owners).order('created_at');
  const [mode, sequenceRaw, activeId, clickThresh, timeHours] = await Promise.all([
    getSetting(rotKey(adminId,'mode')), getSetting(rotKey(adminId,'sequence')), getSetting(rotKey(adminId,'active_id')),
    getSetting(rotKey(adminId,'click_threshold')), getSetting(rotKey(adminId,'time_hours')),
  ]);
  const sequence = sequenceRaw ? JSON.parse(sequenceRaw) : [];

  // Build ordered list: sequenced variants first (in order), then unsequenced
  const ordered = [
    ...sequence.map(id => (variants||[]).find(v => v.id === id)).filter(Boolean),
    ...(variants||[]).filter(v => !sequence.includes(v.id))
  ];

  const variantRows = ordered.map((v, i) => {
    const inRotation = sequence.includes(v.id);
    const isActive = String(v.id) === String(activeId);
    return `<div class="rot-item" data-id="${v.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#1a1a2e;border-radius:8px;margin-bottom:6px;border:1px solid ${inRotation ? '#2d2d4a' : '#1a1a2e'}">
      <div style="display:flex;flex-direction:column;gap:2px;cursor:grab">
        <button type="button" onclick="moveItem(this,-1)" style="background:none;border:none;color:#475569;cursor:pointer;padding:0;font-size:12px;line-height:1" ${i===0?'disabled':''}>▲</button>
        <button type="button" onclick="moveItem(this,1)" style="background:none;border:none;color:#475569;cursor:pointer;padding:0;font-size:12px;line-height:1" ${i===ordered.length-1?'disabled':''}>▼</button>
      </div>
      <span style="color:#475569;font-size:11px;font-weight:600;min-width:20px">${i+1}.</span>
      <input type="checkbox" class="rot-check" data-id="${v.id}" ${inRotation ? 'checked' : ''} style="width:auto;margin:0">
      <span style="flex:1;font-size:14px">${v.name}</span>
      ${isActive ? '<span class="badge badge-green">LIVE</span>' : ''}
    </div>`;
  }).join('');

  res.send(layout('Rotation Settings', `
    <form method="POST" action="/admin/variants/rotation" id="rot-form">
      <input type="hidden" name="sequence" id="sequence-input" value="">
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">Rotation Mode</div>
        <div class="form-group">
          <label>How should variants rotate?</label>
          <select name="mode" id="rot-mode" onchange="toggleRotMode(this.value)">
            <option value="manual" ${mode==='manual'||!mode?'selected':''}>Manual — I'll control which variant is live</option>
            <option value="click" ${mode==='click'?'selected':''}>Click-based — rotate after X visits</option>
            <option value="time" ${mode==='time'?'selected':''}>Time-based — rotate every X hours/days</option>
          </select>
        </div>
        <div id="click-settings" style="${mode!=='click'?'display:none':''}">
          <div class="form-group">
            <label>Rotate after this many visits per variant</label>
            <input type="number" name="click_threshold" value="${clickThresh || 500}" min="1">
          </div>
        </div>
        <div id="time-settings" style="${mode!=='time'?'display:none':''}">
          <div class="form-group">
            <label>Show each variant for this many hours</label>
            <input type="number" name="time_hours" value="${timeHours || 168}" min="1" step="1">
            <div style="font-size:12px;color:#64748b;margin-top:4px">168 hours = 7 days · 24 = 1 day · 720 = 30 days</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-title">Variants in Rotation</div>
        <p style="font-size:13px;color:#64748b;margin-bottom:16px">Check variants to include. Use ▲▼ to set the exact rotation order.</p>
        <div id="rot-list">${variantRows || '<div class="empty">No variants yet</div>'}</div>
      </div>

      <button type="submit" class="btn btn-primary" onclick="buildSequence()">Save Rotation Settings</button>
      <a href="/admin/variants" class="btn btn-ghost" style="margin-left:12px">Cancel</a>
    </form>
    <script>
    function toggleRotMode(v){
      document.getElementById('click-settings').style.display = v==='click' ? '' : 'none';
      document.getElementById('time-settings').style.display = v==='time' ? '' : 'none';
    }
    function moveItem(btn, dir) {
      const item = btn.closest('.rot-item');
      const list = document.getElementById('rot-list');
      const items = [...list.querySelectorAll('.rot-item')];
      const idx = items.indexOf(item);
      const target = items[idx + dir];
      if (!target) return;
      if (dir === -1) list.insertBefore(item, target);
      else list.insertBefore(target, item);
      refreshNumbers();
    }
    function refreshNumbers() {
      const items = document.querySelectorAll('.rot-item');
      items.forEach((el, i) => {
        el.querySelector('span[style*="min-width"]').textContent = (i+1) + '.';
        el.querySelectorAll('button')[0].disabled = i === 0;
        el.querySelectorAll('button')[1].disabled = i === items.length - 1;
      });
    }
    function buildSequence() {
      const ids = [...document.querySelectorAll('.rot-item')]
        .filter(el => el.querySelector('.rot-check').checked)
        .map(el => el.dataset.id);
      document.getElementById('sequence-input').value = ids.join(',');
    }
    </script>
  `, 'variants'));
});

// Save rotation settings
router.post('/rotation', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const { mode, click_threshold, time_hours } = req.body;
  // sequence comes as comma-separated string from hidden input (ordered)
  const seqRaw = req.body.sequence || '';
  let sequence = seqRaw ? seqRaw.split(',').map(Number).filter(Boolean) : [];
  if (!sequence.length && req.body.sequence_arr) {
    sequence = (Array.isArray(req.body.sequence_arr) ? req.body.sequence_arr : [req.body.sequence_arr]).map(Number);
  }

  const saves = [
    setSetting(rotKey(adminId,'mode'), mode),
    setSetting(rotKey(adminId,'sequence'), JSON.stringify(sequence)),
    setSetting(rotKey(adminId,'click_threshold'), click_threshold || '500'),
    setSetting(rotKey(adminId,'time_hours'), time_hours || '168'),
    setSetting(rotKey(adminId,'click_count'), '0'),
    setSetting(rotKey(adminId,'started_at'), new Date().toISOString()),
  ];

  // If active variant is not in new sequence, set first of sequence as active
  const activeId = await getSetting(rotKey(adminId,'active_id'));
  if (sequence.length > 0 && (!activeId || !sequence.includes(parseInt(activeId)))) {
    saves.push(setSetting(rotKey(adminId,'active_id'), String(sequence[0])));
  }

  await Promise.all(saves);
  res.redirect('/admin/variants');
});

// ─── variant form HTML ───────────────────────────────────────────────────────

function variantForm(v = {}, vsls = []) {
  const isEdit = !!v.id;

  // Determine current VSL source
  let currentVslSource = 'none';
  if (v.vsl_id) currentVslSource = 'library';
  else if (v.vsl_type === 'url' && v.vsl_url) currentVslSource = 'url';

  const vslOptions = vsls.map(vsl =>
    `<option value="${vsl.id}" ${String(v.vsl_id) === String(vsl.id) ? 'selected' : ''}>${vsl.name} (${vsl.type})</option>`
  ).join('');

  return `
    <form method="POST" action="/admin/variants/${isEdit ? v.id + '/edit' : 'new'}">
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">Variant Identity</div>
        <div class="form-group">
          <label>Variant Name (internal label)</label>
          <input type="text" name="name" value="${v.name || ''}" placeholder="e.g. Version A — Red CTA" required>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-title">Hero Copy</div>
        <div class="form-group">
          <label>Badge Text (optional pill above headline)</label>
          <input type="text" name="badge_text" value="${v.badge_text || ''}" placeholder="e.g. 🔥 Limited Spots">
        </div>
        <div class="form-group">
          <label>Headline</label>
          <input type="text" name="headline" value="${v.headline || ''}" placeholder="Make Your First $1,000 With AI Creators">
        </div>
        <div class="form-group">
          <label>Subheadline</label>
          <textarea name="subheadline" rows="3" placeholder="Join thousands building real income streams...">${v.subheadline || ''}</textarea>
        </div>
        <div class="form-group">
          <label>CTA Button Text</label>
          <input type="text" name="cta_text" value="${v.cta_text || ''}" placeholder="Claim Your Free Spot →">
        </div>
        <div class="form-group">
          <label>CTA Button Destination</label>
          <div style="display:flex;gap:20px;margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:normal;font-size:13px">
              <input type="radio" name="cta_destination" value="signup" ${(!v.cta_destination || v.cta_destination==='signup') ? 'checked' : ''} onchange="document.getElementById('cta_link_wrap').style.display='none'" style="width:auto;margin:0"> Email signup form
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:normal;font-size:13px">
              <input type="radio" name="cta_destination" value="link" ${v.cta_destination==='link' ? 'checked' : ''} onchange="document.getElementById('cta_link_wrap').style.display=''" style="width:auto;margin:0"> Direct link
            </label>
          </div>
          <div id="cta_link_wrap" style="${v.cta_destination==='link' ? '' : 'display:none'}">
            <input type="text" name="cta_link" value="${v.cta_link || ''}" placeholder="https://addcal.co/your-webinar">
          </div>
        </div>
        <div class="form-group">
          <label>Trust Items (one per line, shown below CTA)</label>
          <textarea name="trust_items" rows="4" placeholder="✅ 100% Free&#10;🔒 No Credit Card&#10;⚡ Instant Access">${v.trust_items || ''}</textarea>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-title">VSL Video</div>
        <div class="form-group">
          <label>Video Source</label>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px;background:#0d0d14;border:1px solid #1e1e30;border-radius:8px">
              <input type="radio" name="vsl_source" value="none" ${currentVslSource === 'none' ? 'checked' : ''} onchange="toggleVslSource('none')" style="width:auto;margin:0">
              <span>None</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px;background:#0d0d14;border:1px solid #1e1e30;border-radius:8px">
              <input type="radio" name="vsl_source" value="library" ${currentVslSource === 'library' ? 'checked' : ''} onchange="toggleVslSource('library')" style="width:auto;margin:0">
              <span>From library</span>
            </label>
            <div id="vsl-library-section" style="${currentVslSource === 'library' ? '' : 'display:none'};padding-left:32px">
              <select name="vsl_id" style="margin-bottom:0">
                <option value="">Select a VSL…</option>
                ${vslOptions}
              </select>
              ${vsls.length === 0 ? '<div style="font-size:12px;color:#64748b;margin-top:6px">No VSLs yet — <a href="/admin/vsl" style="color:#a78bfa">add one to the library</a></div>' : ''}
            </div>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px;background:#0d0d14;border:1px solid #1e1e30;border-radius:8px">
              <input type="radio" name="vsl_source" value="url" ${currentVslSource === 'url' ? 'checked' : ''} onchange="toggleVslSource('url')" style="width:auto;margin:0">
              <span>URL (embed)</span>
            </label>
            <div id="vsl-url-section" style="${currentVslSource === 'url' ? '' : 'display:none'};padding-left:32px">
              <input type="text" name="vsl_url" value="${v.vsl_url || ''}" placeholder="https://www.youtube.com/embed/VIDEO_ID" style="margin-bottom:0">
            </div>
          </div>
        </div>
      </div>

      <div class="flex" style="gap:12px">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Variant'}</button>
        <a href="/admin/variants" class="btn btn-ghost">Cancel</a>
        ${isEdit ? `<form method="POST" action="/admin/variants/${v.id}/delete" style="margin-left:auto" onsubmit="return confirm('Delete this variant?')"><button class="btn btn-danger btn-sm">Delete</button></form>` : ''}
      </div>
    </form>
    <script>
    function toggleVslSource(src) {
      document.getElementById('vsl-library-section').style.display = src === 'library' ? '' : 'none';
      document.getElementById('vsl-url-section').style.display = src === 'url' ? '' : 'none';
    }
    </script>
  `;
}

// ─── landing page renderer ───────────────────────────────────────────────────

function renderLandingPage(variant, testimonials, isPreview = false, vslData = null) {
  const headline = variant.headline || 'Make Your First $1,000 With AI Creators';
  const subheadline = variant.subheadline || 'Join thousands building real income streams with AI creators + social media. Watch the free training and claim your spot.';
  const ctaText = variant.cta_text || 'Claim Your Free Spot →';
  const ctaHref = variant.cta_destination === 'link' && variant.cta_link ? variant.cta_link : '#signup';
  const ctaTarget = variant.cta_destination === 'link' && variant.cta_link ? ' target="_blank"' : '';
  const trustItems = (variant.trust_items || '✅ 100% Free\n🔒 No Credit Card\n⚡ Instant Access').split('\n').filter(Boolean);

  const perView = Math.min(testimonials.length, 3) || 1;
  const cardWidthCalc = perView === 1 ? '100%' : perView === 2 ? 'calc(50% - 10px)' : 'calc(33.333% - 14px)';

  const testimonialCards = testimonials.map(t => {
    if (t.type === 'telegram' && t.telegram_url) {
      const tgPath = t.telegram_url.replace(/^https?:\/\/t\.me\//, '').replace(/^\//, '');
      return `<div class="testimonial-card tg-card"><script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-post="${tgPath}" data-width="100%"><\/script></div>`;
    }
    return `<div class="testimonial-card">
      ${t.image_path ? `<img src="${t.image_path}" alt="${t.name}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;margin-bottom:12px">` : ''}
      <div style="font-size:13px;font-weight:600;color:#f1f5f9">${t.name}</div>
      <div style="font-size:12px;color:#7c3aed;margin-bottom:8px">${t.handle || ''}</div>
      ${t.earnings ? `<div style="font-size:20px;font-weight:700;color:#22c55e;margin-bottom:8px">${t.earnings}</div>` : ''}
      ${t.quote ? `<div style="font-size:13px;color:#94a3b8;line-height:1.5">"${t.quote}"</div>` : ""}
    </div>`;
  });
  const testimonialHTML = testimonialCards.join('');
  // Duplicate cards for infinite carousel loop
  const carouselCards = [...testimonialCards, ...testimonialCards].join('');

  // Resolve VSL — vslData from library takes priority, then variant fields
  let vslSrc = null;
  let vslIsFile = false;
  if (vslData) {
    vslSrc = vslData.url || vslData.file_path || null;
    vslIsFile = vslData.type === 'file';
  } else if (variant.vsl_type === 'url' && variant.vsl_url) {
    vslSrc = variant.vsl_url;
    vslIsFile = false;
  }
  const vslHTML = vslSrc
    ? vslIsFile
      ? `<section class="vsl-section"><div class="container"><video src="${vslSrc}" controls style="width:100%;border-radius:16px;box-shadow:0 0 60px rgba(124,58,237,.2)"></video></div></section>`
      : `<section class="vsl-section"><div class="container"><div class="vsl-wrap"><iframe src="${vslSrc}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe></div></div></section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MyFirstCreator.ai — ${headline}</title>
  ${isPreview ? '<div style="position:fixed;top:0;left:0;right:0;background:#7c3aed;color:white;text-align:center;padding:8px;font-size:13px;z-index:9999">⚠️ PREVIEW MODE — not live</div>' : ''}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d0d14;color:#e2e8f0;min-height:100vh}
    .container{max-width:900px;margin:0 auto;padding:0 20px}
    .hero{padding:${isPreview ? '60px' : '48px'} 20px 48px;text-align:center}
    .badge-pill{display:inline-block;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);color:#a78bfa;padding:6px 16px;border-radius:999px;font-size:13px;font-weight:600;margin-bottom:20px}
    .hero-headline{font-size:clamp(32px,6vw,56px);font-weight:800;line-height:1.1;margin-bottom:20px;background:linear-gradient(135deg,#fff 60%,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .hero-sub{font-size:clamp(16px,2.5vw,20px);color:#94a3b8;max-width:640px;margin:0 auto 32px;line-height:1.6}
    .btn-hero{display:inline-block;padding:18px 40px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;text-decoration:none;border-radius:12px;font-size:18px;font-weight:700;transition:.2s;box-shadow:0 0 40px rgba(124,58,237,.4)}
    .btn-hero:hover{transform:translateY(-2px);box-shadow:0 0 60px rgba(124,58,237,.6)}
    .trust-row{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-top:24px;font-size:14px;color:#64748b}
    .vsl-section{padding:48px 0;background:rgba(124,58,237,.04);border-top:1px solid #1e1e30;border-bottom:1px solid #1e1e30}
    .vsl-wrap{position:relative;padding-bottom:56.25%;height:0;border-radius:16px;overflow:hidden;box-shadow:0 0 60px rgba(124,58,237,.2)}
    .vsl-wrap iframe{position:absolute;top:0;left:0;width:100%;height:100%}
    .signup-section{padding:72px 20px;text-align:center}
    .signup-box{background:#12121f;border:1px solid #1e1e30;border-radius:20px;padding:48px 32px;max-width:480px;margin:0 auto}
    .signup-box h2{font-size:28px;font-weight:700;margin-bottom:8px}
    .signup-box p{color:#64748b;margin-bottom:28px;font-size:15px}
    input[type=text],input[type=email]{width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:14px 16px;border-radius:10px;font-size:15px;margin-bottom:12px;outline:none;font-family:inherit}
    input:focus{border-color:#7c3aed}
    .btn-submit{width:100%;padding:16px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;transition:.2s}
    .btn-submit:hover{opacity:.9}
    .section-label{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#7c3aed;font-weight:600;margin-bottom:12px}
    .testimonials-section{padding:72px 20px;background:rgba(124,58,237,.03)}
    .testimonials-carousel-wrap{position:relative;overflow:hidden;padding:0 40px}
    .carousel-viewport{overflow:hidden}
    .carousel-track{display:flex;gap:16px;transition:transform 0.5s ease;align-items:flex-start}
    .testimonial-card{flex:0 0 ${cardWidthCalc};background:#12121f;border:1px solid #1e1e30;border-radius:16px;padding:24px;text-align:center}
    .testimonial-card.tg-card{padding:0;background:transparent;border:none;border-radius:20px;overflow:hidden;min-height:200px}
    @media(max-width:768px){.testimonial-card{flex:0 0 calc(48% - 6px)}.testimonials-carousel-wrap{padding:0 16px}.carousel-track{gap:12px}}
    .car-btn{position:absolute;top:50%;transform:translateY(-50%);background:#1e1e30;border:1px solid #2d2d4a;color:#e2e8f0;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;line-height:1}
    .car-prev{left:0}.car-next{right:0}
    .section-header{text-align:center;margin-bottom:8px}
    .section-header h2{font-size:clamp(24px,4vw,36px);font-weight:700}
    .final-cta{padding:80px 20px;text-align:center;background:linear-gradient(180deg,transparent,rgba(124,58,237,.08))}
    .success-msg{background:#064e3b;border:1px solid #065f46;color:#6ee7b7;padding:16px;border-radius:10px;margin-top:12px;display:none}
  </style>
</head>
<body>
  <section class="hero">
    <div class="container">
      ${variant.badge_text ? `<div class="badge-pill">${variant.badge_text}</div><br>` : ''}
      <h1 class="hero-headline">${headline}</h1>
      <p class="hero-sub">${subheadline}</p>
      <a href="${ctaHref}" class="btn-hero"${ctaTarget}>${ctaText}</a>
      <div class="trust-row">${trustItems.map(t => `<span>${t}</span>`).join('')}</div>
    </div>
  </section>

  ${vslHTML}

  <section class="signup-section" id="signup">
    <div class="signup-box">
      <div class="section-label">🎟️ Free Training</div>
      <h2>Claim Your Free Spot</h2>
      <p>Enter your details to get instant access</p>
      <form id="signup-form">
        <input type="text" id="sig-name" placeholder="Your first name">
        <input type="email" id="sig-email" placeholder="Your email address" required>
        <button type="submit" class="btn-submit">${ctaText}</button>
        <div class="success-msg" id="success-msg"></div>
      </form>
    </div>
  </section>

  ${testimonials.length ? `
  <section class="testimonials-section">
    <div class="container">
      <div class="section-header"><div class="section-label">💬 Real Results</div><h2>Creators Already Winning</h2></div>
      <div class="testimonials-carousel-wrap" id="car-wrap" style="margin-top:32px">
        <button class="car-btn car-prev" onclick="carMove(-1)">&#8249;</button>
        <div class="carousel-viewport">
          <div class="carousel-track" id="car-track">${carouselCards}</div>
        </div>
        <button class="car-btn car-next" onclick="carMove(1)">&#8250;</button>
      </div>
    </div>
  </section>
  <script>
  (function(){
    var track = document.getElementById('car-track');
    var wrap = document.getElementById('car-wrap');
    if (!track) return;
    var cards = track.querySelectorAll('.testimonial-card');
    var total = ${testimonials.length}; // real count (half of duplicated)
    var current = 0;
    var timer;
    function cardWidth() {
      return cards[0] ? cards[0].offsetWidth + 20 : 0;
    }
    function goTo(idx, animate) {
      if (animate === false) track.style.transition = 'none';
      else track.style.transition = 'transform 0.5s ease';
      track.style.transform = 'translateX(-' + (idx * cardWidth()) + 'px)';
    }
    track.addEventListener('transitionend', function() {
      if (current >= total) { current = current - total; goTo(current, false); }
      if (current < 0) { current = current + total; goTo(current, false); }
    });
    function advance() { current++; goTo(current, true); }
    function startTimer() { timer = setInterval(advance, 3500); }
    function stopTimer() { clearInterval(timer); }
    startTimer();
    wrap.addEventListener('mouseenter', stopTimer);
    wrap.addEventListener('mouseleave', startTimer);
    window.carMove = function(dir) { stopTimer(); current += dir; goTo(current, true); startTimer(); };
  })();
  <\/script>` : ''}

  <section class="final-cta">
    <div class="container">
      <h2 style="font-size:clamp(28px,5vw,48px);font-weight:800;margin-bottom:20px">${headline}</h2>
      <a href="${ctaHref}" class="btn-hero"${ctaTarget}>${ctaText}</a>
    </div>
  </section>

  <footer style="text-align:center;padding:32px;border-top:1px solid #1e1e30">
    <p style="color:#475569;font-size:13px">© 2025 MyFirstCreator.ai · <a href="#" style="color:#475569">Privacy Policy</a> · <a href="#" style="color:#475569">Terms</a></p>
  </footer>

  <script>
    const ref = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('mfc_ref='));
    document.getElementById('signup-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('.btn-submit');
      btn.textContent = 'Claiming your spot...'; btn.disabled = true;
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name: document.getElementById('sig-name').value, email: document.getElementById('sig-email').value, ref: ref ? ref.split('=')[1] : null })
      });
      const data = await res.json();
      const msg = document.getElementById('success-msg');
      if (data.redirect) { window.location.href = data.redirect; return; }
      msg.textContent = data.message || "You're in!";
      msg.style.display = 'block';
      btn.textContent = '${ctaText}'; btn.disabled = false;
    });
  </script>
</body>
</html>`;
}

module.exports.renderLandingPage = renderLandingPage;
