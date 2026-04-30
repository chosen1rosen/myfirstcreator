// AddCal integration — event management + admin UI

const express = require('express');
const router = express.Router();
const supabase = require('../db');
const layout = require('./admin-layout');

const ADDCAL_BASE = 'https://addcal.co/api';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function addcalRequest(method, path, body = null) {
  const key = process.env.ADDCAL_API_KEY;
  if (!key) throw new Error('ADDCAL_API_KEY not set');
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${ADDCAL_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data) || `AddCal error: ${res.status}`);
  return data;
}

async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single();
  return data?.value ?? null;
}
async function setSetting(key, value) {
  await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
}

// Exported helper — used by public.js to render /confirmed
async function getActiveEvent() {
  const raw = await getSetting('addcal_active_event');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
module.exports.getActiveEvent = getActiveEvent;

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.redirect('/admin/login');
}

// ─── Admin: Events page ───────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  const msg = req.query.msg;
  const event = await getActiveEvent();

  const [
    confirmedHeadline,
    confirmedSub,
    confirmedVsl,
    addcalEnabled,
  ] = await Promise.all([
    getSetting('confirmed_headline'),
    getSetting('confirmed_subheadline'),
    getSetting('confirmed_vsl_url'),
    getSetting('addcal_enabled'),
  ]);

  const alert =
    msg === 'created'  ? '<div class="alert alert-success">✅ Event created and set as active.</div>' :
    msg === 'cleared'  ? '<div class="alert alert-success">✅ Event cleared.</div>' :
    msg === 'saved'    ? '<div class="alert alert-success">✅ Confirmation page settings saved.</div>' :
    msg === 'error'    ? '<div class="alert" style="background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b">❌ Error creating event. Check API key and try again.</div>' : '';

  res.send(layout('Events & Calendar', `
    ${alert}

    <!-- Toggle -->
    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:600;font-size:15px">Calendar Add Flow</div>
          <div style="color:#64748b;font-size:13px;margin-top:4px">When enabled, signups are redirected to the confirmation page with the calendar button</div>
        </div>
        <form method="POST" action="/admin/events/toggle" style="margin:0">
          <button class="btn ${addcalEnabled === 'true' ? 'btn-primary' : 'btn-ghost'}">
            ${addcalEnabled === 'true' ? '🟢 Enabled — click to disable' : '⚫ Disabled — click to enable'}
          </button>
        </form>
      </div>
    </div>

    <!-- Active event -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">📅 Active Event</div>
      ${event ? `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
          <div>
            <div style="font-size:16px;font-weight:700;margin-bottom:4px">${event.title}</div>
            <div style="color:#94a3b8;font-size:13px;margin-bottom:8px">${event.date_start}${event.date_end ? ` → ${event.date_end}` : ''} ${event.timezone ? `(${event.timezone})` : ''}</div>
            ${event.location ? `<div style="color:#64748b;font-size:12px;margin-bottom:8px">📍 ${event.location}</div>` : ''}
            ${event.description ? `<div style="color:#64748b;font-size:12px;margin-bottom:12px">${event.description}</div>` : ''}
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${event.links?.google   ? `<a href="${event.links.google}"   target="_blank" class="btn btn-sm btn-ghost">🗓 Google</a>` : ''}
              ${event.links?.apple    ? `<a href="${event.links.apple}"    target="_blank" class="btn btn-sm btn-ghost">🍎 Apple</a>` : ''}
              ${event.links?.outlook  ? `<a href="${event.links.outlook}"  target="_blank" class="btn btn-sm btn-ghost">📧 Outlook</a>` : ''}
              ${event.links?.yahoo    ? `<a href="${event.links.yahoo}"    target="_blank" class="btn btn-sm btn-ghost">📌 Yahoo</a>` : ''}
              ${event.links?.office365? `<a href="${event.links.office365}" target="_blank" class="btn btn-sm btn-ghost">🏢 Office 365</a>` : ''}
              ${event.links?.ical || event.links?.other ? `<a href="${event.links.ical||event.links.other}" target="_blank" class="btn btn-sm btn-ghost">⬇️ iCal</a>` : ''}
            </div>
          </div>
          <form method="POST" action="/admin/events/clear" style="margin:0;flex-shrink:0">
            <button class="btn btn-sm btn-danger">🗑 Clear</button>
          </form>
        </div>
      ` : '<div style="color:#64748b;font-size:14px">No active event. Create one below ↓</div>'}
    </div>

    <!-- Create event -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">➕ Create New Event</div>
      <form method="POST" action="/admin/events/create">
        <div class="form-group">
          <label>Event Title</label>
          <input type="text" name="title" placeholder="MyFirstCreator — Live Webinar" required>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label>Start Date & Time</label>
            <input type="datetime-local" name="date_start" required>
          </div>
          <div class="form-group">
            <label>End Date & Time <span style="color:#475569;font-size:12px">(optional, defaults to +1h)</span></label>
            <input type="datetime-local" name="date_end">
          </div>
        </div>
        <div class="form-group">
          <label>Timezone</label>
          <select name="timezone">
            <option value="America/New_York">Eastern (EST/EDT)</option>
            <option value="America/Chicago">Central (CST/CDT)</option>
            <option value="America/Denver">Mountain (MST/MDT)</option>
            <option value="America/Los_Angeles">Pacific (PST/PDT)</option>
            <option value="America/Toronto">Toronto</option>
            <option value="Asia/Dubai">Dubai (GST)</option>
            <option value="Europe/London">London (GMT/BST)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div class="form-group">
          <label>Description / Zoom Link <span style="color:#475569;font-size:12px">(shown in calendar event — paste your Zoom link here)</span></label>
          <textarea name="description" rows="3" placeholder="Join live at: https://zoom.us/j/..."></textarea>
        </div>
        <div class="form-group">
          <label>Location <span style="color:#475569;font-size:12px">(optional)</span></label>
          <input type="text" name="location" placeholder="Zoom (link in description)">
        </div>
        <button type="submit" class="btn btn-primary">Create Event & Set as Active</button>
      </form>
    </div>

    <!-- Confirmation page settings -->
    <div class="card">
      <div class="card-title">🎉 Confirmation Page Settings</div>
      <p style="color:#64748b;font-size:13px;margin-bottom:20px">This is what users see after signing up when the calendar flow is enabled.</p>
      <form method="POST" action="/admin/events/confirmed-settings">
        <div class="form-group">
          <label>Headline</label>
          <input type="text" name="confirmed_headline" value="${confirmedHeadline || "You're In! 🎉"}" placeholder="You're In! 🎉">
        </div>
        <div class="form-group">
          <label>Subheadline</label>
          <input type="text" name="confirmed_subheadline" value="${confirmedSub || 'Add the webinar to your calendar so you don\'t miss it.'}" placeholder="Add the webinar to your calendar so you don't miss it.">
        </div>
        <div class="form-group">
          <label>Calendar Button Text</label>
          <input type="text" name="confirmed_btn_text" value="${await getSetting('confirmed_btn_text') || 'Add to My Calendar'}" placeholder="Add to My Calendar">
        </div>
        <div class="form-group">
          <label>Second VSL URL <span style="color:#475569;font-size:12px">(optional — YouTube embed URL)</span></label>
          <input type="text" name="confirmed_vsl_url" value="${confirmedVsl || ''}" placeholder="https://www.youtube.com/embed/...">
        </div>
        <button type="submit" class="btn btn-primary">Save Confirmation Page</button>
      </form>
    </div>
  `, 'events'));
});

// ─── Admin: Create event ──────────────────────────────────────────────────────

router.post('/create', requireAuth, async (req, res) => {
  const { title, date_start, date_end, timezone, description, location } = req.body;
  try {
    const body = {
      title,
      date_start: new Date(date_start).toISOString(),
      ...(date_end ? { date_end: new Date(date_end).toISOString() } : {}),
      ...(timezone ? { timezone } : {}),
      ...(description ? { description } : {}),
      ...(location ? { location } : {}),
    };
    const result = await addcalRequest('POST', '/events', body);
    const event = result.data || result;
    await setSetting('addcal_active_event', JSON.stringify({
      uid: event.uid,
      title: event.title,
      date_start: event.date_start,
      date_end: event.date_end,
      timezone: event.timezone || timezone,
      description: event.description,
      location: event.location,
      links: event.links || {},
      page_url: event.page_url || null,
    }));
    res.redirect('/admin/events?msg=created');
  } catch (e) {
    console.error('AddCal create error:', e.message);
    res.redirect('/admin/events?msg=error');
  }
});

// ─── Admin: Clear event ───────────────────────────────────────────────────────

router.post('/clear', requireAuth, async (req, res) => {
  await setSetting('addcal_active_event', null);
  res.redirect('/admin/events?msg=cleared');
});

// ─── Admin: Toggle enabled ────────────────────────────────────────────────────

router.post('/toggle', requireAuth, async (req, res) => {
  const current = await getSetting('addcal_enabled');
  await setSetting('addcal_enabled', current === 'true' ? 'false' : 'true');
  res.redirect('/admin/events');
});

// ─── Admin: Confirmation page settings ───────────────────────────────────────

router.post('/confirmed-settings', requireAuth, async (req, res) => {
  const { confirmed_headline, confirmed_subheadline, confirmed_btn_text, confirmed_vsl_url } = req.body;
  await Promise.all([
    setSetting('confirmed_headline', confirmed_headline || ''),
    setSetting('confirmed_subheadline', confirmed_subheadline || ''),
    setSetting('confirmed_btn_text', confirmed_btn_text || ''),
    setSetting('confirmed_vsl_url', confirmed_vsl_url || ''),
  ]);
  res.redirect('/admin/events?msg=saved');
});

module.exports.router = router;
