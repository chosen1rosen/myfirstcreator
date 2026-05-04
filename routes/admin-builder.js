const express = require('express');
const router = express.Router();
const supabase = require('../db');
const layout = require('./admin-layout');
const { BLOCK_TYPES, renderPageFromBlocks } = require('./block-renderer');
const Anthropic = require('@anthropic-ai/sdk');
const { getAdminOwners } = require('./admin-utils');

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.redirect('/admin/login');
}

async function getVariantForAdmin(id, adminId) {
  const owners = getAdminOwners(adminId);
  const { data: v } = await supabase.from('variants').select('*').eq('id', id).single();
  // Allow access if variant belongs to this admin (or is 'admin'/'steven' for steven)
  if (!v) return null;
  if (owners.includes(v.owner)) return v;
  return null; // not owned by this admin
}

// ─── Builder page ─────────────────────────────────────────────────────────────

router.get('/:id/builder', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const v = await getVariantForAdmin(req.params.id, adminId);
  if (!v) return res.redirect('/admin/variants');

  const blocks = v.blocks || [];
  const blockTypesJSON = JSON.stringify(BLOCK_TYPES);
  const blocksJSON = JSON.stringify(blocks);

  // Load VSL library for the VSL block dropdown
  const { data: vslLibrary } = await supabase.from('vsls').select('id, name, type, url, file_path').order('created_at', { ascending: false });
  const vslLibraryJSON = JSON.stringify(vslLibrary || []);
  // Current variant's vsl_id for pre-selection
  const currentVslId = v.vsl_id || null;

  res.send(layout(`Page Builder — ${v.name}`, `
    <style>
      .builder-wrap { display: grid; grid-template-columns: 380px 1fr; gap: 0; height: calc(100vh - 120px); margin: -32px; position: relative; }
      .builder-left { background: #0d0d14; border-right: 1px solid #1e1e30; overflow-y: auto; padding: 24px; }
      .builder-right { background: #090910; overflow: hidden; position: relative; }
      .builder-right iframe { width: 100%; height: 100%; border: none; }
      .block-item { background: #12121f; border: 1px solid #1e1e30; border-radius: 10px; margin-bottom: 10px; }
      .block-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; cursor: pointer; user-select: none; }
      .block-drag { color: #475569; font-size: 16px; cursor: grab; }
      .block-label { flex: 1; font-size: 14px; font-weight: 600; color: #e2e8f0; }
      .block-actions { display: flex; gap: 4px; }
      .block-body { border-top: 1px solid #1e1e30; padding: 16px; display: none; }
      .block-body.open { display: block; }
      .field { margin-bottom: 12px; }
      .field label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
      .field input, .field textarea, .field select { width: 100%; background: #1a1a2e; border: 1px solid #2d2d4a; color: #e2e8f0; padding: 8px 10px; border-radius: 6px; font-size: 13px; outline: none; font-family: inherit; }
      .field textarea { resize: vertical; min-height: 60px; }
      .field input:focus, .field textarea:focus, .field select:focus { border-color: #7c3aed; }
      .add-block-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
      .add-block-btn { background: #1a1a2e; border: 1px solid #2d2d4a; color: #94a3b8; padding: 10px 8px; border-radius: 8px; font-size: 12px; cursor: pointer; text-align: center; transition: .15s; }
      .add-block-btn:hover { border-color: #7c3aed; color: #a78bfa; background: #1e1e35; }
      .builder-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #1e1e30; margin-bottom: 20px; }
      .preview-bar { position: absolute; top: 0; left: 0; right: 0; background: #12121f; border-bottom: 1px solid #1e1e30; padding: 8px 16px; display: flex; align-items: center; gap: 8px; z-index: 10; }
      .preview-bar span { font-size: 12px; color: #64748b; }
      .preview-frame-wrap { position: absolute; top: 41px; left: 0; right: 0; bottom: 0; }
      .preview-frame-wrap iframe { width: 100%; height: 100%; border: none; }
      .feature-item { background: #0d0d14; border: 1px solid #1e1e30; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
      .feature-item-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b; font-weight: 600; }
      .unsaved-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; display: inline-block; margin-right: 6px; }
    </style>

    <div class="builder-wrap">
      <!-- LEFT: block editor -->
      <div class="builder-left">
        <div class="builder-toolbar">
          <div style="font-size:14px;font-weight:700;color:#a78bfa">🧱 Page Builder</div>
          <div style="display:flex;gap:8px">
            <a href="/admin/variants" class="btn btn-ghost btn-sm">← Back</a>
            <button class="btn btn-primary btn-sm" onclick="saveBlocks()">💾 Save</button>
          </div>
        </div>

        <div style="font-size:12px;color:#64748b;margin-bottom:16px">
          <span id="save-status">All changes saved</span>
        </div>

        <!-- Block list -->
        <div id="block-list"></div>

        <!-- Add block section -->
        <div style="margin-top:20px">
          <div style="font-size:12px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Add a block</div>
          <div class="add-block-grid" id="block-type-buttons">${BLOCK_TYPES.map(t => `<button class="add-block-btn" onclick="addBlock('${t.type}')">${t.label}</button>`).join('')}</div>
        </div>

        <!-- VSL Panel -->
        <div style="margin-top:24px;border-top:1px solid #1e1e30;padding-top:20px">
          <div style="font-size:12px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">🎬 VSL Video</div>
          <div class="field">
            <label>From library</label>
            <select id="vsl-library-select">
              <option value="">None</option>
              ${(vslLibrary||[]).map(vsl => `<option value="${vsl.id}" ${String(currentVslId) === String(vsl.id) ? 'selected' : ''}>${vsl.name} (${vsl.type})</option>`).join('')}
            </select>
          </div>
          </div>
          <button onclick="saveVslSettings()" style="width:100%;background:#1e1e35;border:1px solid #2d2d4a;color:#94a3b8;padding:8px 12px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;transition:.15s" onmouseover="this.style.borderColor='#7c3aed';this.style.color='#a78bfa'" onmouseout="this.style.borderColor='#2d2d4a';this.style.color='#94a3b8'">Save VSL</button>
          <div id="vsl-save-status" style="font-size:11px;color:#64748b;margin-top:6px"></div>
        </div>
      </div>

      <!-- RIGHT: live preview -->
      <div class="builder-right">
        <div class="preview-bar">
          <span>Live Preview</span>
          <button onclick="refreshPreview()" style="background:#1e1e35;border:1px solid #2d2d4a;color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">↻ Refresh</button>
          <a href="/admin/variants/${req.params.id}/preview-builder" target="_blank" style="background:#1e1e35;border:1px solid #2d2d4a;color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:11px;text-decoration:none">Open full ↗</a>
          <button onclick="toggleChat()" id="ai-toggle-btn" style="margin-left:auto;background:linear-gradient(135deg,#7c3aed,#06b6d4);border:none;color:white;padding:5px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">🤖 AI Assist</button>
        </div>
        <div class="preview-frame-wrap">
          <iframe id="preview-frame" src="/admin/variants/${req.params.id}/preview-builder"></iframe>
        </div>
      </div>

      <!-- AI Chat Panel (hidden by default) -->
      <div id="ai-panel" style="display:none;position:fixed;top:0;right:0;width:360px;height:100vh;background:#0d0d14;border-left:1px solid #1e1e30;flex-direction:column;z-index:100;box-shadow:-4px 0 24px rgba(0,0,0,.5)">
        <div style="padding:16px;border-bottom:1px solid #1e1e30;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div>
            <div style="font-size:15px;font-weight:700;color:#a78bfa">🤖 AI Page Builder</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Powered by Claude · knows your brand</div>
          </div>
          <button onclick="toggleChat()" style="background:none;border:none;color:#64748b;font-size:20px;cursor:pointer;padding:4px">✕</button>
        </div>
        <div id="chat-log" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column">
          <div style="background:#1e1e35;border-radius:12px;padding:12px 14px;font-size:13px;color:#94a3b8;line-height:1.6;border-bottom-left-radius:4px;margin-bottom:12px">
            I'm your marketing assistant for myfirstcreator.ai. Tell me what kind of landing page you want to build and I'll write the copy and add the sections. Try:<br><br>
            <span style="color:#a78bfa">• "Build a page targeting people who want passive income"</span><br>
            <span style="color:#a78bfa">• "Write me a strong hero section for TikTok traffic"</span><br>
            <span style="color:#a78bfa">• "Give me 3 headline options for cold audiences"</span><br>
            <span style="color:#a78bfa">• "Add a features section about the revenue split"</span>
          </div>
        </div>
        <div style="padding:12px;border-top:1px solid #1e1e30;flex-shrink:0">
          <div style="display:flex;gap:8px">
            <textarea id="ai-input" placeholder="Ask me to build, write, or change anything..." rows="2" style="flex:1;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:10px 12px;border-radius:8px;font-size:13px;outline:none;resize:none;font-family:inherit;line-height:1.4"></textarea>
            <button onclick="sendAIMessage()" style="background:linear-gradient(135deg,#7c3aed,#06b6d4);border:none;color:white;padding:10px 14px;border-radius:8px;cursor:pointer;font-size:16px;align-self:flex-end">↑</button>
          </div>
          <div style="font-size:11px;color:#334155;margin-top:6px;text-align:center">Enter to send · Shift+Enter for new line</div>
        </div>
      </div>
    </div>

    <script>
    window.__BUILDER__ = ${JSON.stringify({
      blockTypes: BLOCK_TYPES,
      blocks: v.blocks || [],
      vslLibrary: vslLibrary || [],
      variantVslId: v.vsl_id || null,
      variantVslUrl: v.vsl_url || '',
      variantId: v.id
    })};
    </script>
    <script src="/js/builder.js"></script>
  `, 'variants'));
});

// ─── Save VSL settings for variant (from builder panel) ─────────────────────

router.post('/:id/vsl', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const v = await getVariantForAdmin(req.params.id, adminId);
  if (!v) return res.status(403).json({ error: 'Access denied' });
  const { vsl_source, vsl_id, vsl_url } = req.body;
  const updateData = { updated_at: new Date().toISOString() };
  if (vsl_source === 'library' && vsl_id) {
    updateData.vsl_id = parseInt(vsl_id);
    updateData.vsl_type = 'library';
    updateData.vsl_url = null;
  } else if (vsl_source === 'url' && vsl_url) {
    updateData.vsl_id = null;
    updateData.vsl_type = 'url';
    updateData.vsl_url = vsl_url;
  } else {
    updateData.vsl_id = null;
    updateData.vsl_type = 'none';
    updateData.vsl_url = null;
  }
  const { error } = await supabase.from('variants').update(updateData).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── Save blocks ──────────────────────────────────────────────────────────────

router.post('/:id/builder/save', requireAuth, async (req, res) => {
  const adminId = req.session.adminId || 'steven';
  const v = await getVariantForAdmin(req.params.id, adminId);
  if (!v) return res.status(403).json({ error: 'Access denied' });
  const { blocks } = req.body;
  const { error } = await supabase.from('variants').update({
    blocks: blocks,
    page_mode: 'builder',
    updated_at: new Date().toISOString()
  }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── Preview (builder mode) ───────────────────────────────────────────────────

router.get('/:id/preview-builder', async (req, res) => {
  const { data: v } = await supabase.from('variants').select('*').eq('id', req.params.id).single();
  if (!v) return res.status(404).send('Not found');
  const { data: testimonials } = await supabase.from('testimonials').select('*').eq('active', true).order('sort_order').limit(6);
  const blocks = v.blocks || [];
  res.send(renderPageFromBlocks(blocks, testimonials || [], true));
});

// ─── AI Assist endpoint ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a marketing assistant for myfirstcreator.ai. You help the marketing team design new landing pages from scratch.

ABOUT MYFIRSTCREATOR.AI:
- A lead capture funnel for an AI creator marketplace
- People sign up to manage AI influencer accounts and earn money doing it
- It's completely free to join — no upfront cost
- Revenue split: users keep 60%, platform takes 20%, tech partner takes 20%
- Traffic comes from social media (TikTok, Instagram, vehicle wraps, etc.) — cold audience
- Tone: bold, direct, aspirational, real — not corporate, not salesy

Your job is to help write copy, suggest page structure, and generate landing page blocks. Every conversation is a fresh page being built from nothing.

When the team asks you to build something or add a section, respond with your copy/reasoning AND include the block data at the end in this format:
<actions>
[
  { "action": "add_block", "block": { "type": "hero", "headline": "...", "subheadline": "...", "cta_text": "...", "badge_text": "...", "trust_items": "✅ 100% Free\n🔒 No Credit Card" } },
  { "action": "add_block", "block": { "type": "email_capture", "title": "...", "subtitle": "...", "cta_text": "..." } }
]
</actions>

AVAILABLE BLOCK TYPES:
- hero: headline, subheadline, cta_text, badge_text, trust_items (newline-separated)
- vsl: vsl_url (YouTube embed URL), caption
- email_capture: title, subtitle, cta_text, label, show_name (bool)
- testimonials: title, label, layout ("grid" or "list"), limit
- features: title, subtitle, label, columns (2/3/4), items: [{icon, title, description}]
- image_text: title, body, cta_text, image_side ("left" or "right"), label
- cta_banner: headline, subheadline, cta_text
- html: content (raw HTML)

Only include <actions> when adding or changing blocks. For questions and copy advice, just reply with text. Keep replies concise and actionable.`;

router.post('/:id/builder/ai', requireAuth, async (req, res) => {
  const { message, blocks, history } = req.body;
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build conversation messages — no page state injected, fresh each time
    const messages = [
      ...(history || []).slice(-10),
      { role: 'user', content: message }
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages
    });

    const rawText = response.content[0]?.text || '';

    // Parse actions if present
    let reply = rawText;
    let actions = null;
    const actionMatch = rawText.match(/<actions>([\s\S]*?)<\/actions>/);
    if (actionMatch) {
      try {
        actions = JSON.parse(actionMatch[1].trim());
        reply = rawText.replace(/<actions>[\s\S]*?<\/actions>/, '').trim();
      } catch (e) {
        // If parse fails, just return the text
      }
    }

    res.json({ reply, actions });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
