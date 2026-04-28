const express = require('express');
const router = express.Router();
const supabase = require('../db');

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
  return data?.value ?? '';
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

  await supabase.from('signups').insert({ name: name || null, email: cleanEmail, tracking_slug: slug, ip, user_agent: ua });

  res.json({ success: true, message: "You're in! Check your email for details." });
});

module.exports = router;
