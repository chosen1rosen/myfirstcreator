const express = require('express');
const router = express.Router();
const supabase = require('../db');

const BASE = 'https://api.aicreatormarketplace.com';
const cache = new Map();
const TTL = 5 * 60 * 1000;

async function getToken() {
  if (process.env.MARKETPLACE_SITE_TOKEN) return process.env.MARKETPLACE_SITE_TOKEN;
  const { data } = await supabase.from('settings').select('value').eq('key', 'marketplace_site_token').single();
  return data?.value || null;
}

async function cachedFetch(key, url, options = {}) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Marketplace API ${res.status}: ${url}`);
  const data = await res.json();
  cache.set(key, { data, ts: Date.now() });
  return data;
}

router.get('/config', async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return res.status(503).json({ error: 'Marketplace not configured' });
    const data = await cachedFetch('config', `${BASE}/v1/site/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return res.status(503).json({ error: 'Marketplace not configured' });
    const data = await cachedFetch('categories', `${BASE}/v1/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get('/creators', async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return res.status(503).json({ error: 'Marketplace not configured' });
    const { category = '', limit = 12, page = 1 } = req.query;
    const qs = new URLSearchParams({ limit, page, ...(category ? { category } : {}) }).toString();
    const cacheKey = `creators:${qs}`;
    const data = await cachedFetch(cacheKey, `${BASE}/v1/creators?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/lead', async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return res.status(503).json({ error: 'Marketplace not configured' });
    const apiRes = await fetch(`${BASE}/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req.body),
    });
    const data = await apiRes.json();
    res.status(apiRes.status).json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
