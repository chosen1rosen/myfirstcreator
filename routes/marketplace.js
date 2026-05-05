const express = require('express');
const router = express.Router();
const supabase = require('../db');

const BASE = 'https://api.aicreatormarketplace.com';
const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 min cache

async function getToken() {
  const envToken = process.env.MARKETPLACE_SITE_TOKEN;
  if (envToken) return envToken;
  const { data } = await supabase.from('settings').select('value').eq('key', 'marketplace_site_token').single();
  return data?.value || null;
}

function getCached(key) {
  const e = cache.get(key);
  if (!e || Date.now() - e.ts > TTL) { cache.delete(key); return null; }
  return e.data;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

async function apiFetch(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Marketplace API ${res.status}`);
  return res.json();
}

router.get('/config', async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return res.status(503).json({ error: 'Marketplace not configured' });
    const cached = getCached('config');
    if (cached) return res.json(cached);
    const data = await apiFetch('/whitelabel/v1/site/config', token);
    setCache('config', data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/categories', async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return res.status(503).json({ error: 'Marketplace not configured' });
    const cached = getCached('categories');
    if (cached) return res.json(cached);
    const data = await apiFetch('/whitelabel/v1/categories', token);
    setCache('categories', data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/creators', async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return res.status(503).json({ error: 'Marketplace not configured' });
    const { perPage = 12, page = 1, category = '', query = '' } = req.query;
    const cacheKey = `creators_${perPage}_${page}_${category}_${query}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    let url = `/whitelabel/v1/creators/search?perPage=${perPage}&page=${page}`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    if (category) url += `&categories[]=${encodeURIComponent(category)}`;
    const data = await apiFetch(url, token);
    setCache(cacheKey, data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.post('/lead', async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return res.status(503).json({ error: 'Marketplace not configured' });
    const { email, campaign_id, category_id } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    const payload = { email: email.toLowerCase().trim() };
    if (campaign_id) payload.campaign_id = campaign_id;
    if (category_id) payload.category_id = category_id;
    const apiRes = await fetch(`${BASE}/whitelabel/v1/leads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const data = await apiRes.json();
    res.status(apiRes.status).json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
