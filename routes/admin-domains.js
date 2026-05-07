const express = require('express');
const router = express.Router();
const supabase = require('../db');
const layout = require('./admin-layout');
const { invalidateDomainCache } = require('./domain-middleware');

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.redirect('/admin/login');
}

async function addDomainToVercel(domain) {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return { ok: false, error: 'VERCEL_TOKEN or VERCEL_PROJECT_ID not set in env' };
  }
  try {
    const r = await fetch(`https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });
    const data = await r.json();
    if (r.ok) return { ok: true, data };
    return { ok: false, error: data.error?.message || `Vercel API ${r.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// List domains
router.get('/', requireAuth, async (req, res) => {
  const { data: domains } = await supabase.from('domains').select('*').order('id');
  const currentId = req.session.currentDomainId || 1;

  const rows = (domains || []).map(d => `
    <tr style="${d.id === currentId ? 'background:#1a1a35' : ''}">
      <td>
        <code style="color:#06b6d4">${d.domain}</code>
        ${d.id === currentId ? ' <span class="badge badge-purple">Managing</span>' : ''}
        ${d.id === 1 ? ' <span class="badge badge-gray">Primary</span>' : ''}
      </td>
      <td>${d.site_name || '—'}</td>
      <td>${d.active
        ? '<span class="badge badge-green">Active</span>'
        : '<span class="badge badge-gray">Inactive</span>'}</td>
      <td>${d.vercel_configured
        ? '<span class="badge badge-purple">✓ Configured</span>'
        : '<span class="badge badge-gray">Pending</span>'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <form method="POST" action="/admin/domains/${d.id}/manage">
            <button class="btn btn-sm ${d.id === currentId ? 'btn-primary' : 'btn-ghost'}">
              ${d.id === currentId ? '● Managing' : 'Manage'}
            </button>
          </form>
          ${d.id !== 1 ? `
          <form method="POST" action="/admin/domains/${d.id}/delete"
            onsubmit="return confirm('Delete ${d.domain}? This does not remove its data.')">
            <button class="btn btn-sm btn-danger">Delete</button>
          </form>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  const content = `
    <div class="flex-between">
      <div></div>
      <button class="btn btn-primary" onclick="document.getElementById('add-modal').style.display='flex'">+ Add Domain</button>
    </div>

    ${req.query.success ? `<div class="alert alert-success">${decodeURIComponent(req.query.success)}</div>` : ''}
    ${req.query.error   ? `<div class="alert alert-error">${decodeURIComponent(req.query.error)}</div>`   : ''}

    <div class="card" style="margin-bottom:20px">
      <div class="card-title">Connected Domains</div>
      <table>
        <thead><tr><th>Domain</th><th>Site Name</th><th>Status</th><th>Vercel</th><th>Actions</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty">No domains yet</td></tr>'}</tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">DNS Setup Instructions</div>
      <p style="color:#94a3b8;font-size:14px;margin-bottom:16px">
        Point your domain to myfirstcreator.ai using one of these methods in your registrar (GoDaddy, Namecheap, Cloudflare, etc.):
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="background:#0d0d14;border:1px solid #1e1e30;border-radius:8px;padding:16px">
          <div style="font-size:11px;color:#a78bfa;font-weight:700;letter-spacing:.05em;margin-bottom:10px">APEX DOMAIN — example.com</div>
          <table style="font-family:monospace;font-size:13px;border:none">
            <tr><td style="color:#64748b;padding:2px 8px 2px 0;border:none">Type</td><td style="color:#06b6d4;border:none">A</td></tr>
            <tr><td style="color:#64748b;padding:2px 8px 2px 0;border:none">Name</td><td style="color:#06b6d4;border:none">@</td></tr>
            <tr><td style="color:#64748b;padding:2px 8px 2px 0;border:none">Value</td><td style="color:#6ee7b7;border:none">76.76.21.21</td></tr>
          </table>
        </div>
        <div style="background:#0d0d14;border:1px solid #1e1e30;border-radius:8px;padding:16px">
          <div style="font-size:11px;color:#a78bfa;font-weight:700;letter-spacing:.05em;margin-bottom:10px">WWW SUBDOMAIN — www.example.com</div>
          <table style="font-family:monospace;font-size:13px;border:none">
            <tr><td style="color:#64748b;padding:2px 8px 2px 0;border:none">Type</td><td style="color:#06b6d4;border:none">CNAME</td></tr>
            <tr><td style="color:#64748b;padding:2px 8px 2px 0;border:none">Name</td><td style="color:#06b6d4;border:none">www</td></tr>
            <tr><td style="color:#64748b;padding:2px 8px 2px 0;border:none">Value</td><td style="color:#6ee7b7;border:none">cname.vercel-dns.com</td></tr>
          </table>
        </div>
      </div>
      <p style="color:#475569;font-size:12px;margin-top:12px">
        DNS propagation typically takes 5–60 minutes. SSL is provisioned automatically by Vercel once DNS resolves.
      </p>
    </div>

    <!-- Add Domain Modal -->
    <div id="add-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center">
      <div style="background:#12121f;border:1px solid #2d2d4a;border-radius:16px;padding:32px;width:480px;max-width:90vw">
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">Add New Domain</div>
        <p style="color:#64748b;font-size:13px;margin-bottom:20px">
          Set up DNS first, then add the domain here. Vercel will be configured automatically.
        </p>
        <form method="POST" action="/admin/domains/add">
          <div class="form-group">
            <label>Domain Name</label>
            <input type="text" name="domain" placeholder="example.com" required
              style="font-family:monospace" autocomplete="off" spellcheck="false">
            <div style="font-size:12px;color:#64748b;margin-top:4px">
              Without https:// — e.g. <code>example.com</code> or <code>www.example.com</code>
            </div>
          </div>
          <div class="form-group">
            <label>Site Name <span style="color:#475569;font-weight:400">(internal label)</span></label>
            <input type="text" name="site_name" placeholder="My Creator Site">
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
            <button type="button" class="btn btn-ghost"
              onclick="document.getElementById('add-modal').style.display='none'">Cancel</button>
            <button type="submit" class="btn btn-primary">Add &amp; Register with Vercel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  res.send(layout('Domains', content, 'domains'));
});

// Add domain
router.post('/add', requireAuth, async (req, res) => {
  const raw = (req.body.domain || '').toLowerCase().trim()
    .replace(/^https?:\/\//, '').replace(/\/$/, '');

  if (!raw || !raw.includes('.')) {
    return res.redirect('/admin/domains?error=Invalid+domain+name');
  }

  const { data: existing } = await supabase.from('domains').select('id').eq('domain', raw).single();
  if (existing) return res.redirect('/admin/domains?error=Domain+already+exists');

  const vercel = await addDomainToVercel(raw);

  const { error } = await supabase.from('domains').insert({
    domain: raw,
    site_name: (req.body.site_name || raw).trim(),
    active: true,
    vercel_configured: vercel.ok,
    vercel_domain_id: vercel.data?.name || null,
  });

  if (error) return res.redirect(`/admin/domains?error=${encodeURIComponent('DB error: ' + error.message)}`);

  invalidateDomainCache(raw);

  const msg = vercel.ok
    ? `${raw} added and registered with Vercel. Set up DNS if you haven't yet.`
    : `${raw} added, but Vercel registration failed: ${vercel.error}. Add manually in Vercel dashboard.`;

  res.redirect(`/admin/domains?success=${encodeURIComponent(msg)}`);
});

// Switch to managing a domain
router.post('/:id/manage', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { data: domain } = await supabase.from('domains').select('id, domain').eq('id', id).single();
  if (!domain) return res.redirect('/admin/domains?error=Domain+not+found');

  req.session.currentDomainId = domain.id;
  req.session.currentDomain   = domain.domain;
  res.redirect('/admin/dashboard');
});

// Delete domain
router.post('/:id/delete', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === 1) return res.redirect('/admin/domains?error=Cannot+delete+primary+domain');

  const { data: domain } = await supabase.from('domains').select('domain').eq('id', id).single();
  await supabase.from('domains').delete().eq('id', id);

  if (domain) invalidateDomainCache(domain.domain);
  if (req.session.currentDomainId === id) {
    req.session.currentDomainId = 1;
    req.session.currentDomain   = null;
  }

  res.redirect('/admin/domains?success=Domain+deleted');
});

module.exports = router;
