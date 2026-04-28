const express = require('express');
const router = express.Router();
const db = require('../db');
const nodemailer = require('nodemailer');

function getIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    'unknown'
  );
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

// Tracking link redirect
router.get('/r/:slug', (req, res) => {
  const { slug } = req.params;
  const link = db.prepare('SELECT * FROM tracking_links WHERE slug = ?').get(slug);

  if (!link) return res.redirect('/');

  const ip = getIP(req);
  const ua = req.headers['user-agent'] || '';

  db.prepare('INSERT INTO visitors (tracking_slug, ip, user_agent) VALUES (?, ?, ?)').run(slug, ip, ua);

  // Set attribution cookie (30 days)
  res.cookie('mfc_ref', slug, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

  const dest = link.destination && link.destination !== '/' ? link.destination : '/';
  res.redirect(dest);
});

// Get VSL settings
router.get('/api/vsl', (req, res) => {
  res.json({
    type: getSetting('vsl_type'),
    url: getSetting('vsl_url'),
    file: getSetting('vsl_file') ? `/uploads/vsl/${getSetting('vsl_file')}` : null,
  });
});

// Get active testimonials
router.get('/api/testimonials', (req, res) => {
  const testimonials = db.prepare(
    'SELECT id, name, handle, earnings, quote, image_path FROM testimonials WHERE active = 1 ORDER BY sort_order ASC, id ASC'
  ).all();
  res.json(testimonials.map(t => ({
    ...t,
    image_path: t.image_path ? `/uploads/testimonials/${t.image_path}` : null,
  })));
});

// Get signup count (for social proof)
router.get('/api/count', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) as count FROM signups').get();
  const offset = parseInt(getSetting('signup_count_offset') || '0');
  res.json({ count: (row.count || 0) + offset });
});

// Site settings for frontend
router.get('/api/settings', (req, res) => {
  res.json({
    headline: getSetting('site_headline'),
    subheadline: getSetting('site_subheadline'),
    cta: getSetting('webinar_cta'),
  });
});

// Email signup
router.post('/api/signup', (req, res) => {
  const { name, email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Check duplicate
  const existing = db.prepare('SELECT id FROM signups WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.json({ success: true, message: 'You\'re already registered!' });
  }

  const ip = getIP(req);
  const ua = req.headers['user-agent'] || '';
  const slug = req.cookies?.mfc_ref || req.body.ref || null;

  db.prepare(
    'INSERT INTO signups (name, email, tracking_slug, ip, user_agent) VALUES (?, ?, ?, ?, ?)'
  ).run(name || null, email.toLowerCase().trim(), slug, ip, ua);

  // Optional email notification
  if (process.env.SMTP_HOST && process.env.NOTIFY_EMAIL) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.NOTIFY_EMAIL,
        subject: `New signup: ${email}`,
        text: `Name: ${name || 'N/A'}\nEmail: ${email}\nIP: ${ip}\nRef: ${slug || 'direct'}\nTime: ${new Date().toISOString()}`,
      }).catch(() => {});
    } catch (_) {}
  }

  res.json({ success: true, message: 'You\'re in! Check your email for details.' });
});

module.exports = router;
