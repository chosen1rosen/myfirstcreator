const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { getActiveVariant, renderLandingPage } = require('./admin-variants');
const { renderPageFromBlocks } = require('./block-renderer');
const { getActiveEvent } = require('./addcal');

async function getCountry(ip) {
  if (!ip || ip === 'unknown' || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) return null;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data.countryCode) {
      const flag = data.countryCode.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
      return `${flag} ${data.country}`;
    }
  } catch {}
  return null;
}

function getIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    'unknown'
  );
}

async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single();
  return data?.value ?? null;
}

// Per-link rotation engine
async function runLinkRotation(link) {
  const sequence = link.rot_sequence; // already parsed JSONB array by Supabase
  if (!sequence || sequence.length === 0) return null;

  const activeId = link.rot_active_id || sequence[0];
  const clickCount = link.rot_click_count || 0;
  const startedAt = link.rot_started_at ? new Date(link.rot_started_at) : new Date();

  // Determine if we should rotate
  let shouldRotate = false;
  if (link.rot_mode === 'click') {
    shouldRotate = clickCount >= (link.rot_click_threshold || 500);
  } else if (link.rot_mode === 'time') {
    const elapsedHours = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);
    shouldRotate = elapsedHours >= (link.rot_time_hours || 168);
  }

  let newActiveId = activeId;
  let newClickCount = clickCount + 1;
  let newStartedAt = link.rot_started_at || startedAt.toISOString();

  if (shouldRotate && sequence.length > 1) {
    const currentIndex = sequence.indexOf(activeId);
    const nextIndex = (currentIndex + 1) % sequence.length;
    newActiveId = sequence[nextIndex];
    newClickCount = 0;
    newStartedAt = new Date().toISOString();
  }

  // Update the tracking_links row
  const updateData = {
    rot_active_id: newActiveId,
    rot_click_count: newClickCount,
  };
  if (shouldRotate && sequence.length > 1) {
    updateData.rot_started_at = newStartedAt;
  }
  await supabase.from('tracking_links').update(updateData).eq('id', link.id);

  return activeId; // return the variant that was active before any rotation
}

// Tracking link redirect
router.get('/r/:slug', async (req, res) => {
  const { slug } = req.params;
  const { data: link } = await supabase.from('tracking_links').select('*').eq('slug', slug).single();
  if (!link) return res.redirect('/');

  const ip = getIP(req);
  const ua = req.headers['user-agent'] || '';
  await supabase.from('visitors').insert({ tracking_slug: slug, ip, user_agent: ua });

  res.cookie('mfc_ref', slug, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

  // Determine variant based on link_mode
  const linkMode = link.link_mode || 'global';
  let variantId = null;

  if (linkMode === 'own' && link.rot_sequence && link.rot_sequence.length > 0) {
    // Per-link rotation engine
    variantId = await runLinkRotation(link);
  } else if (linkMode === 'forced' && link.forced_variant_id) {
    variantId = link.forced_variant_id;
  }
  // else: global mode — variantId stays null

  if (variantId !== null) {
    res.cookie('mfc_forced_variant', String(variantId), { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  } else {
    // Clear any previously forced variant so normal rotation applies
    res.clearCookie('mfc_forced_variant');
  }

  res.redirect(link.destination || '/');
});

// Get VSL settings (global — backward compat)
router.get('/api/vsl', async (req, res) => {
  const [type, url, file] = await Promise.all([
    getSetting('vsl_type'),
    getSetting('vsl_url'),
    getSetting('vsl_file'),
  ]);
  res.json({ type, url, file: file || null });
});

// Get VSL for a specific variant (new per-variant system)
router.get('/api/vsl/:variantId', async (req, res) => {
  const variantId = parseInt(req.params.variantId);
  if (!variantId) return res.status(400).json({ error: 'invalid variantId' });
  const { data: variant } = await supabase.from('variants').select('vsl_id, vsl_type, vsl_url').eq('id', variantId).single();
  if (!variant) return res.status(404).json({ error: 'variant not found' });

  if (variant.vsl_id) {
    const { data: vsl } = await supabase.from('vsls').select('*').eq('id', variant.vsl_id).single();
    if (vsl) {
      return res.json({ type: vsl.type, url: vsl.url || vsl.file_path });
    }
  }
  if (variant.vsl_type === 'url' && variant.vsl_url) {
    return res.json({ type: 'url', url: variant.vsl_url });
  }
  // Fallback to global settings
  const [type, url, file] = await Promise.all([
    getSetting('vsl_type'),
    getSetting('vsl_url'),
    getSetting('vsl_file'),
  ]);
  res.json({ type: type || 'none', url: url || file || null });
});

// Get active testimonials
router.get('/api/testimonials', async (req, res) => {
  const { data } = await supabase
    .from('testimonials')
    .select('id, name, handle, earnings, quote, image_path')
    .eq('active', true)
    .order('sort_order')
    .order('id');
  res.json(data || []);
});

// Signup count
router.get('/api/count', async (req, res) => {
  const { count } = await supabase.from('signups').select('*', { count: 'exact', head: true });
  const offset = parseInt(await getSetting('signup_count_offset') || '0');
  res.json({ count: (count || 0) + offset });
});

// Site settings
router.get('/api/settings', async (req, res) => {
  const { data } = await supabase.from('settings').select('key, value');
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  res.json({
    headline: map.site_headline || '',
    subheadline: map.site_subheadline || '',
    cta: map.webinar_cta || '',
  });
});

// Email signup
router.post('/api/signup', async (req, res) => {
  const { name, email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const { data: existing } = await supabase.from('signups').select('id').eq('email', cleanEmail).single();
  if (existing) return res.json({ success: true, message: "You're already registered!" });

  const ip = getIP(req);
  const ua = req.headers['user-agent'] || '';
  const slug = req.cookies?.mfc_ref || req.body.ref || null;

  const country = await getCountry(ip);
  const variantId = req.cookies?.mfc_variant ? parseInt(req.cookies.mfc_variant) : null;
  await supabase.from('signups').insert({ name: name || null, email: cleanEmail, tracking_slug: slug, ip, user_agent: ua, country, variant_id: variantId || null });

  // Check if calendar redirect is enabled
  const { data: addcalRow } = await supabase.from('settings').select('value').eq('key', 'addcal_enabled').single();
  const addcalEnabled = addcalRow?.value === 'true';

  if (addcalEnabled) {
    res.json({ success: true, redirect: '/confirmed' });
  } else {
    res.json({ success: true, message: "You're in! Check your email for details." });
  }
});

// AddCal public API — active event links
router.get('/api/addcal/event', async (req, res) => {
  try {
    const event = await getActiveEvent();
    res.json({ event: event || null });
  } catch {
    res.json({ event: null });
  }
});

// Confirmation page — shown after signup when calendar flow is enabled
router.get('/confirmed', async (req, res) => {
  const [headline, subheadline, btnText, vslUrl, eventRaw] = await Promise.all([
    getSetting('confirmed_headline'),
    getSetting('confirmed_subheadline'),
    getSetting('confirmed_btn_text'),
    getSetting('confirmed_vsl_url'),
    getActiveEvent(),
  ]);

  const h = headline || "You're In! 🎉";
  const sub = subheadline || "Add the webinar to your calendar so you don't miss it.";
  const btn = btnText || 'Add to My Calendar';
  const event = eventRaw;

  const calLinks = event?.links || {};
  const calOptions = [
    { type: 'google',    label: '🗓 Google',     href: calLinks.google },
    { type: 'apple',     label: '🍎 Apple',      href: calLinks.apple },
    { type: 'outlook',   label: '📧 Outlook',    href: calLinks.outlook },
    { type: 'yahoo',     label: '📌 Yahoo',      href: calLinks.yahoo },
    { type: 'office365', label: '🏢 Office 365', href: calLinks.office365 },
    { type: 'ical',      label: '⬇️ iCal',       href: calLinks.ical || calLinks.other },
  ].filter(o => o.href);

  const vslHtml = vslUrl ? `
    <div style="max-width:720px;margin:0 auto 48px">
      <div style="position:relative;padding-bottom:56.25%;height:0;border-radius:16px;overflow:hidden;box-shadow:0 0 60px rgba(124,58,237,.2)">
        <iframe src="${vslUrl}" frameborder="0" allowfullscreen allow="autoplay;encrypted-media" style="position:absolute;top:0;left:0;width:100%;height:100%"></iframe>
      </div>
    </div>` : '';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>You're Registered — MyFirstCreator.ai</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d0d14;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:60px 20px}
    .check{font-size:72px;margin-bottom:24px;animation:pop .5s ease-out}
    @keyframes pop{0%{transform:scale(0)}80%{transform:scale(1.1)}100%{transform:scale(1)}}
    h1{font-size:clamp(28px,5vw,48px);font-weight:800;text-align:center;background:linear-gradient(135deg,#fff 60%,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:16px}
    .sub{color:#94a3b8;font-size:clamp(15px,2vw,18px);text-align:center;margin-bottom:40px;max-width:560px;line-height:1.6}
    .cal-wrap{width:100%;max-width:480px;margin-bottom:48px}
    .cal-main-btn{width:100%;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.5);color:#a78bfa;padding:18px 32px;border-radius:14px;font-size:18px;font-weight:700;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:10px}
    .cal-main-btn:hover{background:rgba(124,58,237,.25);border-color:#7c3aed}
    .cal-options{margin-top:12px;display:none;flex-wrap:wrap;gap:10px;justify-content:center}
    .cal-options.open{display:flex}
    .cal-link{display:inline-block;padding:12px 20px;background:#12121f;border:1px solid #1e1e30;border-radius:10px;color:#e2e8f0;text-decoration:none;font-size:14px;font-weight:500;transition:.2s;flex:1;min-width:130px;text-align:center}
    .cal-link:hover{border-color:#7c3aed;color:#a78bfa;background:#1a1a2e}
    .hint{color:#475569;font-size:13px;text-align:center;margin-top:8px}
  </style>
</head>
<body>
  <div class="check">✅</div>
  <h1>${h}</h1>
  <p class="sub">${sub}</p>

  ${event ? `
  <div class="cal-wrap">
    <button class="cal-main-btn" id="cal-btn" onclick="toggleCal()">📅 ${btn}</button>
    <div class="cal-options" id="cal-opts">
      ${calOptions.map(o => `<a href="${o.href}" target="_blank" class="cal-link">${o.label}</a>`).join('\n      ')}
    </div>
    <p class="hint">Google · Apple · Outlook · Yahoo · and more</p>
  </div>` : ''}

  ${vslHtml}

  <a href="/" style="color:#475569;font-size:13px;text-decoration:none">← Back to home</a>

  <script>
    function toggleCal(){
      const opts=document.getElementById('cal-opts');
      opts.classList.toggle('open');
      document.getElementById('cal-btn').textContent=opts.classList.contains('open')?'📅 Choose your calendar':'📅 ${btn}';
    }
  </script>
</body>
</html>`);
});

// Homepage — serve active variant from unified rotation (includes super admin's hidden variants)
// ─── shared variant renderer ────────────────────────────────────────────────
async function serveVariant(req, res, next, variantId, trackingSlug) {
  try {
    if (!variantId) variantId = await getActiveVariant();
    if (!variantId) return next();

    const { data: variant } = await supabase.from('variants').select('*').eq('id', variantId).single();
    if (!variant) return next();

    const ip = getIP(req);
    const slug = trackingSlug || req.cookies?.mfc_ref || null;
    await supabase.from('visitors').insert({ tracking_slug: slug, ip, user_agent: req.headers['user-agent'] || '', variant_id: variantId });
    res.cookie('mfc_variant', String(variantId), { maxAge: 2 * 60 * 60 * 1000, httpOnly: true });

    const { data: testimonials } = await supabase.from('testimonials').select('*').eq('active', true).order('sort_order').limit(50);
    let vslData = null;
    if (variant.vsl_id) {
      const { data: vsl } = await supabase.from('vsls').select('*').eq('id', variant.vsl_id).single();
      vslData = vsl || null;
    }
    if (variant.page_mode === 'custom' && variant.custom_html) {
      res.send(variant.custom_html);
    } else if (variant.page_mode === 'builder' && variant.blocks?.length > 0) {
      res.send(renderPageFromBlocks(variant.blocks, testimonials || []));
    } else {
      res.send(renderLandingPage(variant, testimonials || [], false, vslData));
    }
  } catch (err) {
    console.error('Variant render error:', err);
    next();
  }
}

// Homepage
router.get('/', async (req, res, next) => {
  // Check for a tracking-link-forced variant first; fall back to rotation engine
  let variantId = null;
  const forcedId = req.cookies?.mfc_forced_variant ? parseInt(req.cookies.mfc_forced_variant) : null;
  if (forcedId) {
    const { data: check } = await supabase.from('variants').select('id').eq('id', forcedId).single();
    if (check) variantId = forcedId;
  }
  return serveVariant(req, res, next, variantId, null);
});

// Direct landing page URL — e.g. /fb-ads, /youtube, /test2
// Serves the variant associated with a tracking link directly (no redirect)
const RESERVED = new Set(['admin','superadmin','api','r','confirmed','favicon.ico']);
router.get('/:slug', async (req, res, next) => {
  const { slug } = req.params;
  if (RESERVED.has(slug.toLowerCase())) return next();

  const { data: link } = await supabase.from('tracking_links').select('*').eq('slug', slug).single();
  if (!link) return next();

  // Set tracking cookie
  res.cookie('mfc_ref', slug, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

  // Determine variant from link mode
  const linkMode = link.link_mode || 'global';
  let variantId = null;
  if (linkMode === 'own' && link.rot_sequence?.length > 0) {
    variantId = await runLinkRotation(link);
  } else if (linkMode === 'forced' && link.forced_variant_id) {
    variantId = link.forced_variant_id;
  }

  if (variantId) {
    res.cookie('mfc_forced_variant', String(variantId), { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  } else {
    res.clearCookie('mfc_forced_variant');
  }

  return serveVariant(req, res, next, variantId, slug);
});

module.exports = router;
