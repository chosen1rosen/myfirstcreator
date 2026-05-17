const supabase = require('../db');

const SETTINGS_TTL = 5 * 60 * 1000; // 5 min
const IP_TTL = 30 * 60 * 1000; // 30 min

let settingsCache = null;
let settingsCacheAt = 0;
const ipCache = new Map();

async function getGeoSettings() {
  if (settingsCache && Date.now() - settingsCacheAt < SETTINGS_TTL) return settingsCache;
  const { data } = await supabase.from('settings').select('key, value')
    .in('key', ['geo_block_mode', 'geo_block_countries', 'geo_block_redirect']);
  const m = {};
  (data || []).forEach(r => { m[r.key] = r.value; });
  settingsCache = {
    mode: m.geo_block_mode || 'off',
    countries: m.geo_block_countries ? JSON.parse(m.geo_block_countries) : [],
    redirect: m.geo_block_redirect || '',
  };
  settingsCacheAt = Date.now();
  return settingsCache;
}

function invalidateGeoCache() { settingsCache = null; }

async function resolveCountryCode(ip) {
  if (!ip || ip === 'unknown' || ip === '::1' || ip.startsWith('127.') ||
      ip.startsWith('192.168.') || ip.startsWith('10.')) return null;
  const cached = ipCache.get(ip);
  if (cached && Date.now() - cached.ts < IP_TTL) return cached.code;
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`,
      { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    const code = d.countryCode || null;
    ipCache.set(ip, { code, ts: Date.now() });
    return code;
  } catch { return null; }
}

function getIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip || 'unknown'
  );
}

async function geoBlockMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();
  const p = req.path;
  if (p.startsWith('/admin') || p.startsWith('/api') ||
      p.startsWith('/superadmin') || p === '/confirmed') return next();
  try {
    const cfg = await getGeoSettings();
    if (cfg.mode === 'off' || cfg.countries.length === 0) return next();
    const code = await resolveCountryCode(getIP(req));
    if (!code) return next();
    const inList = cfg.countries.includes(code);
    const blocked = (cfg.mode === 'allowlist' && !inList) || (cfg.mode === 'blocklist' && inList);
    if (blocked) {
      if (cfg.redirect) return res.redirect(cfg.redirect);
      return res.status(403).send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Not Available</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
min-height:100vh;background:#0d0d14;color:#e2e8f0;text-align:center;margin:0}</style>
</head><body><div><div style="font-size:64px">🚫</div>
<h2 style="margin:16px 0 8px">Not Available in Your Region</h2>
<p style="color:#64748b">This content is not available in your location.</p>
</div></body></html>`);
    }
  } catch (err) { console.error('geo-block error:', err.message); }
  next();
}

module.exports = { geoBlockMiddleware, resolveCountryCode, invalidateGeoCache };
