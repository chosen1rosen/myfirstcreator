/**
 * admin-utils.js — Shared helpers for multi-admin data scoping
 *
 * Owner model:
 *   'admin' | 'steven' → Steven's main admin account (both values = legacy compat)
 *   'hoyle'            → hhoyle24@gmail.com (second admin)
 *   'super'            → superadmin (always separate)
 */

const supabase = require('../db');

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Returns the list of registered admin accounts from env vars.
 * Each entry: { username, password, adminId }
 */
function getAdminAccounts() {
  const accounts = [
    {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'changeme123',
      adminId: 'steven',
    },
  ];
  if (process.env.ADMIN2_USERNAME && process.env.ADMIN2_PASSWORD) {
    accounts.push({
      username: process.env.ADMIN2_USERNAME,
      password: process.env.ADMIN2_PASSWORD,
      adminId: process.env.ADMIN2_ID || 'hoyle',
    });
  }
  return accounts;
}

// ─── Owner scoping ────────────────────────────────────────────────────────────

/**
 * Returns the `owner` values in the variants table that belong to this admin.
 * Steven owns legacy 'admin' rows too.
 */
function getAdminOwners(adminId) {
  if (!adminId || adminId === 'steven') return ['admin', 'steven'];
  return [adminId];
}

/**
 * Returns variant IDs owned by this admin.
 */
async function getAdminVariantIds(adminId) {
  const owners = getAdminOwners(adminId);
  const { data } = await supabase.from('variants').select('id').in('owner', owners);
  return (data || []).map(v => v.id);
}

// ─── Tracking link ownership (stored in settings) ─────────────────────────────

const LINKS_KEY = (adminId) => `admin_links_${adminId}`;

/**
 * Returns slugs owned by this admin, or null if not tracked yet (= treats as "all" for steven).
 */
async function getAdminLinkSlugs(adminId) {
  if (adminId === 'steven') return null; // steven sees all (legacy)
  const { data } = await supabase.from('settings').select('value').eq('key', LINKS_KEY(adminId)).single();
  return data?.value ? JSON.parse(data.value) : [];
}

/**
 * Adds a slug to this admin's link ownership list.
 */
async function addLinkToAdmin(adminId, slug) {
  if (adminId === 'steven') return; // steven is default, no need to track
  const current = await getAdminLinkSlugs(adminId);
  const updated = [...(current || []), slug];
  await supabase.from('settings').upsert({ key: LINKS_KEY(adminId), value: JSON.stringify(updated), updated_at: new Date().toISOString() });
}

/**
 * Removes a slug from this admin's link ownership list.
 */
async function removeLinkFromAdmin(adminId, slug) {
  if (adminId === 'steven') return;
  const current = await getAdminLinkSlugs(adminId);
  const updated = (current || []).filter(s => s !== slug);
  await supabase.from('settings').upsert({ key: LINKS_KEY(adminId), value: JSON.stringify(updated), updated_at: new Date().toISOString() });
}

// ─── Rotation key prefixes ────────────────────────────────────────────────────

/**
 * Returns the settings key prefix for rotation settings.
 * Steven uses unprefixed keys (legacy). Others use `rot_{adminId}_...`
 */
function rotKey(adminId, suffix) {
  if (!adminId || adminId === 'steven') return `rot_${suffix}`;
  return `rot_${adminId}_${suffix}`;
}

/**
 * Returns the settings key for domain-scoped rotation.
 * Domain 1 (primary) uses unprefixed keys for backward compat.
 * Other domains use `d{id}_rot_{suffix}`.
 */
function domainRotKey(domainId, suffix) {
  if (!domainId || domainId === 1) return `rot_${suffix}`;
  return `d${domainId}_rot_${suffix}`;
}

/**
 * Applies .eq('domain_id', domainId) only when domainId is non-null.
 * Pass null to skip the filter (migration not yet run).
 */
function scopeDomain(query, domainId) {
  if (!domainId) return query;
  return query.eq('domain_id', domainId);
}

module.exports = {
  getAdminAccounts,
  getAdminOwners,
  getAdminVariantIds,
  getAdminLinkSlugs,
  addLinkToAdmin,
  removeLinkFromAdmin,
  rotKey,
  domainRotKey,
  scopeDomain,
};
