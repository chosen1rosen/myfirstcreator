const supabase = require('../db');

// 5-min in-memory cache: hostname → { record, ts }
const cache = new Map();
const TTL = 5 * 60 * 1000;

async function resolveDomain(hostname) {
  const host = hostname.split(':')[0].toLowerCase();
  const now = Date.now();
  const cached = cache.get(host);
  if (cached && now - cached.ts < TTL) return cached.record;

  const { data } = await supabase
    .from('domains')
    .select('id, domain, site_name, active')
    .eq('domain', host)
    .single();

  cache.set(host, { record: data || null, ts: now });
  return data || null;
}

// Call this to invalidate cache after adding/updating a domain
function invalidateDomainCache(hostname) {
  if (hostname) cache.delete(hostname.split(':')[0].toLowerCase());
  else cache.clear();
}

async function domainMiddleware(req, res, next) {
  try {
    const record = await resolveDomain(req.hostname || '');
    if (record && record.active) {
      req.domainId = record.id;
      req.domainRecord = record;
    } else {
      req.domainId = 1;
      req.domainRecord = null;
    }
  } catch {
    req.domainId = 1;
    req.domainRecord = null;
  }
  next();
}

module.exports = { domainMiddleware, resolveDomain, invalidateDomainCache };
