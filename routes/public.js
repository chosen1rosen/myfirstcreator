const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { getActiveVariant, renderLandingPage } = require('./admin-variants');
const { renderPageFromBlocks } = require('./block-renderer');

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

// Tracking link redirect
router.get('/r/:slug', async (req, res) => {
  const { slug } = req.params;
  const { data: link } = await supabase.from('tracking_links').select('*').eq('slug', slug).single();
  if (!link) return res.redirect('/');

  const ip = getIP(req);
  const ua = req.headers['user-agent'] || '';
  await supabase.from('visitors').insert({ tracking_slug: slug, ip, user_agent: ua });

  res.cookie('mfc_ref', slug, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  res.redirect(link.destination || '/');
});

// Get VSL settings
router.get('/api/vsl', async (req, res) => {
  const [type, url, file] = await Promise.all([
    getSetting('vsl_type'),
    getSetting('vsl_url'),
    getSetting('vsl_file'),
  ]);
  res.json({ type, url, file: file || null });
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

  res.json({ success: true, message: "You're in! Check your email for details." });
});

// Homepage — serve active variant from unified rotation (includes super admin's hidden variants)
router.get('/', async (req, res, next) => {
  try {
    let variantId = await getActiveVariant();

    if (!variantId) return next();

    const { data: variant } = await supabase.from('variants').select('*').eq('id', variantId).single();
    if (!variant) return next();

    // Track visit
    const ip = getIP(req);
    const slug = req.cookies?.mfc_ref || null;
    await supabase.from('visitors').insert({ tracking_slug: slug, ip, user_agent: req.headers['user-agent'] || '', variant_id: variantId });
    res.cookie('mfc_variant', String(variantId), { maxAge: 2 * 60 * 60 * 1000, httpOnly: true });

    const { data: testimonials } = await supabase.from('testimonials').select('*').eq('active', true).order('sort_order').limit(6);
    if (variant.page_mode === 'custom' && variant.custom_html) {
      res.send(variant.custom_html);
    } else if (variant.page_mode === 'builder' && variant.blocks?.length > 0) {
      res.send(renderPageFromBlocks(variant.blocks, testimonials || []));
    } else {
      res.send(renderLandingPage(variant, testimonials || []));
    }
  } catch (err) {
    console.error('Variant render error:', err);
    next();
  }
});

module.exports = router;
