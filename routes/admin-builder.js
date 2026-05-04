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
          <div class="field">
            <label>Or paste embed URL</label>
            <input type="text" id="vsl-url-input" placeholder="https://www.youtube.com/embed/...">
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
    const BLOCK_TYPES = ${blockTypesJSON};
    let blocks = ${blocksJSON};
    let dirty = false;
    const VSL_LIBRARY = ${vslLibraryJSON};
    const VARIANT_VSL_ID = ${JSON.stringify(currentVslId)};

    // ── Default block configs ────────────────────────────────────────────────
    const DEFAULTS = {
      hero: { type:'hero', headline:'Your Headline Here', subheadline:'Your compelling subheadline goes here.', cta_text:'Get Started →', badge_text:'', trust_items:'✅ 100% Free\\n🔒 No Credit Card', bg_color:'transparent', padding:'64px' },
      vsl: { type:'vsl', vsl_url:'', vsl_file:'', caption:'' },
      email_capture: { type:'email_capture', title:'Claim Your Free Spot', subtitle:'Enter your details to get instant access', cta_text:'Get Instant Access →', label:'🎟️ Free Training', show_name:true, name_placeholder:'Your first name', email_placeholder:'Your email address', bg_color:'transparent' },
      testimonials: { type:'testimonials', title:'Real Results From Real People', label:'💬 What They Say', layout:'grid', limit:6 },
      features: { type:'features', title:'Why This Works', subtitle:'', label:'⚡ The Platform', columns:3, items:[{icon:'🤖',title:'AI Creator Tech',description:'Built-in AI technology that runs 24/7'},{icon:'💰',title:'60% Revenue Share',description:'You keep the majority of everything earned'},{icon:'📈',title:'Built-in Audience',description:'Traffic and distribution already set up'}] },
      image_text: { type:'image_text', title:'Your Title', body:'Your description text goes here.', cta_text:'', image_url:'', image_side:'left', label:'' },
      cta_banner: { type:'cta_banner', headline:'Ready to Start?', subheadline:'Join thousands already earning with AI creators.', cta_text:'Claim Your Spot →', bg_color:'linear-gradient(135deg,#7c3aed,#06b6d4)', text_color:'white' },
      html: { type:'html', content:'<p style="color:#e2e8f0;text-align:center;padding:40px">Your custom HTML here</p>' },
    };

    // ── Render block list ────────────────────────────────────────────────────
    function render() {
      const list = document.getElementById('block-list');
      list.innerHTML = blocks.map((b, i) => renderBlockEditor(b, i)).join('');
      // Restore open state
      openBlocks.forEach(i => {
        const body = document.querySelector(\`[data-block-index="\${i}"] .block-body\`);
        if (body) body.classList.add('open');
      });
    }

    let openBlocks = new Set();

    function renderBlockEditor(b, i) {
      const typeInfo = BLOCK_TYPES.find(t => t.type === b.type) || { label: b.type };
      return \`<div class="block-item" data-block-index="\${i}">
        <div class="block-header" onclick="toggleBlock(\${i})">
          <span class="block-drag" title="Drag to reorder">⠿</span>
          <span class="block-label">\${typeInfo.label}</span>
          <div class="block-actions">
            <button onclick="event.stopPropagation();moveBlock(\${i},-1)" title="Move up" style="background:none;border:none;color:#64748b;cursor:pointer;padding:2px 4px;font-size:14px" \${i===0?'disabled':''}>↑</button>
            <button onclick="event.stopPropagation();moveBlock(\${i},1)" title="Move down" style="background:none;border:none;color:#64748b;cursor:pointer;padding:2px 4px;font-size:14px" \${i===blocks.length-1?'disabled':''}>↓</button>
            <button onclick="event.stopPropagation();duplicateBlock(\${i})" title="Duplicate" style="background:none;border:none;color:#64748b;cursor:pointer;padding:2px 4px;font-size:14px">⧉</button>
            <button onclick="event.stopPropagation();removeBlock(\${i})" title="Remove" style="background:none;border:none;color:#7f1d1d;cursor:pointer;padding:2px 4px;font-size:14px">✕</button>
          </div>
        </div>
        <div class="block-body">
          \${renderBlockForm(b, i)}
        </div>
      </div>\`;
    }

    function renderBlockForm(b, i) {
      const f = (key, label, type='text', extra='') => \`
        <div class="field">
          <label>\${label}</label>
          <input type="\${type}" value="\${esc(b[key]||'')}" onchange="updateField(\${i},'\${key}',this.value)" \${extra}>
        </div>\`;
      const ta = (key, label, rows=3) => \`
        <div class="field">
          <label>\${label}</label>
          <textarea rows="\${rows}" onchange="updateField(\${i},'\${key}',this.value)">\${esc(b[key]||'')}</textarea>
        </div>\`;
      const sel = (key, label, options) => \`
        <div class="field">
          <label>\${label}</label>
          <select onchange="updateField(\${i},'\${key}',this.value)">\${options.map(o=>\`<option value="\${o.v}" \${b[key]===o.v?'selected':''}>\${o.l}</option>\`).join('')}</select>
        </div>\`;
      const chk = (key, label) => \`
        <div class="field" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" \${b[key]!==false?'checked':''} onchange="updateField(\${i},'\${key}',this.checked)" style="width:auto;margin:0">
          <label style="margin:0">\${label}</label>
        </div>\`;

      switch(b.type) {
        case 'hero': return f('headline','Headline') + ta('subheadline','Subheadline') + f('cta_text','CTA Button Text') + f('badge_text','Badge Pill Text (optional)') + ta('trust_items','Trust Items (one per line)',3) + f('bg_color','Background Color','text','placeholder="transparent or #hex or CSS gradient"') + f('padding','Vertical Padding','text','placeholder="64px"');
        case 'vsl': return renderVslBlockForm(b, i);
        case 'email_capture': return f('title','Title') + f('subtitle','Subtitle') + f('cta_text','Button Text') + f('label','Section Label (optional)') + chk('show_name','Show name field') + f('name_placeholder','Name Placeholder','text') + f('email_placeholder','Email Placeholder','text') + f('bg_color','Background Color','text','placeholder="transparent"');
        case 'testimonials': return f('title','Section Title') + f('label','Section Label') + sel('layout','Layout',[{v:'grid',l:'Grid'},{v:'list',l:'List'}]) + f('limit','Max Testimonials to Show','number');
        case 'features': return f('title','Section Title') + f('subtitle','Subtitle') + f('label','Section Label') + sel('columns','Columns',[{v:2,l:'2 Columns'},{v:3,l:'3 Columns'},{v:4,l:'4 Columns'}]) + renderFeatureItems(b, i);
        case 'image_text': return f('title','Title') + ta('body','Body Text') + f('cta_text','CTA Button (optional)') + f('image_url','Image URL') + sel('image_side','Image Position',[{v:'left',l:'Image Left'},{v:'right',l:'Image Right'}]) + f('label','Label (optional)');
        case 'cta_banner': return f('headline','Headline') + f('subheadline','Subheadline') + f('cta_text','Button Text') + f('bg_color','Background','text','placeholder="linear-gradient(135deg,#7c3aed,#06b6d4)"') + f('text_color','Text Color','text','placeholder="white"');
        case 'html': return \`<div class="field"><label>Custom HTML</label><textarea rows="8" onchange="updateField(\${i},'content',this.value)">\${esc(b.content||'')}</textarea></div>\`;
        default: return '<p style="color:#64748b;font-size:13px">No options for this block type.</p>';
      }
    }

    function renderFeatureItems(b, i) {
      const items = b.items || [];
      const rows = items.map((item, j) => \`
        <div class="feature-item">
          <div class="feature-item-header">Feature \${j+1} <button onclick="removeFeatureItem(\${i},\${j})" style="background:none;border:none;color:#7f1d1d;cursor:pointer;font-size:12px">✕ Remove</button></div>
          <div style="display:grid;grid-template-columns:48px 1fr;gap:8px">
            <div class="field"><label>Icon</label><input type="text" value="\${item.icon||''}" onchange="updateFeatureItem(\${i},\${j},'icon',this.value)" style="text-align:center"></div>
            <div class="field"><label>Title</label><input type="text" value="\${esc(item.title||'')}" onchange="updateFeatureItem(\${i},\${j},'title',this.value)"></div>
          </div>
          <div class="field"><label>Description</label><input type="text" value="\${esc(item.description||'')}" onchange="updateFeatureItem(\${i},\${j},'description',this.value)"></div>
        </div>\`).join('');
      return \`<div style="margin-top:12px"><div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:8px">Feature Items</div>\${rows}<button onclick="addFeatureItem(\${i})" class="btn btn-ghost btn-sm" style="margin-top:4px;width:100%">+ Add Feature</button></div>\`;
    }

    function renderVslBlockForm(b, i) {
      const libOptions = VSL_LIBRARY.map(vsl =>
        '<option value="' + vsl.id + '" ' + (String(b.vsl_library_id) === String(vsl.id) ? 'selected' : '') + '>' + vsl.name + ' (' + vsl.type + ')</option>'
      ).join('');
      const hasLib = VSL_LIBRARY.length > 0;
      const onchangeLib = 'updateField(' + i + ',\'vsl_library_id\',this.value||null);if(this.value){updateField(' + i + ',\'vsl_url\',\'\');updateField(' + i + ',\'vsl_file\',' + "'');}";
      const onchangeUrl = 'updateField(' + i + ',\'vsl_url\',this.value);if(this.value)updateField(' + i + ',\'vsl_library_id\',null);';
      const onchangeFile = 'updateField(' + i + ',\'vsl_file\',this.value);';
      const onchangeCap = 'updateField(' + i + ',\'caption\',this.value);';
      return '<div class="field">'
        + '<label>From Library</label>'
        + '<select onchange="' + onchangeLib + '">'
        + '<option value="">None (use URL below)</option>'
        + (hasLib ? libOptions : '<option disabled>No VSLs in library yet</option>')
        + '</select>'
        + (hasLib ? '' : '<div style="font-size:11px;color:#475569;margin-top:4px"><a href="/admin/vsl" target="_blank" style="color:#a78bfa">Add VSLs to library &#8599;</a></div>')
        + '</div>'
        + '<div class="field"><label>Or paste embed URL</label><input type="text" value="' + esc(b.vsl_url||'') + '" onchange="' + onchangeUrl + '" placeholder="https://www.youtube.com/embed/..."></div>'
        + '<div class="field"><label>Or direct video URL</label><input type="text" value="' + esc(b.vsl_file||'') + '" onchange="' + onchangeFile + '"></div>'
        + '<div class="field"><label>Caption (optional)</label><input type="text" value="' + esc(b.caption||'') + '" onchange="' + onchangeCap + '"></div>';
    }

    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

    // ── Block actions ────────────────────────────────────────────────────────
    function toggleBlock(i) {
      if (openBlocks.has(i)) openBlocks.delete(i); else openBlocks.add(i);
      const body = document.querySelector(\`[data-block-index="\${i}"] .block-body\`);
      if (body) body.classList.toggle('open');
    }

    function addBlock(type) {
      blocks.push(JSON.parse(JSON.stringify(DEFAULTS[type] || { type })));
      dirty = true; markUnsaved();
      const newIdx = blocks.length - 1;
      openBlocks.add(newIdx);
      render(); refreshPreview();
      // Scroll to new block
      setTimeout(() => document.querySelector(\`[data-block-index="\${newIdx}"]\`)?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 100);
    }

    function removeBlock(i) {
      if (!confirm('Remove this block?')) return;
      blocks.splice(i, 1);
      openBlocks = new Set([...openBlocks].filter(x=>x!==i).map(x=>x>i?x-1:x));
      dirty = true; markUnsaved(); render(); refreshPreview();
    }

    function moveBlock(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= blocks.length) return;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      openBlocks = new Set([...openBlocks].map(x => x===i?j : x===j?i : x));
      dirty = true; markUnsaved(); render(); refreshPreview();
    }

    function duplicateBlock(i) {
      const copy = JSON.parse(JSON.stringify(blocks[i]));
      blocks.splice(i+1, 0, copy);
      openBlocks.add(i+1);
      dirty = true; markUnsaved(); render(); refreshPreview();
    }

    function updateField(blockIdx, key, value) {
      blocks[blockIdx][key] = value;
      dirty = true; markUnsaved();
      debouncePreview();
    }

    function updateFeatureItem(blockIdx, itemIdx, key, value) {
      if (!blocks[blockIdx].items) blocks[blockIdx].items = [];
      if (!blocks[blockIdx].items[itemIdx]) blocks[blockIdx].items[itemIdx] = {};
      blocks[blockIdx].items[itemIdx][key] = value;
      dirty = true; markUnsaved(); debouncePreview();
    }

    function addFeatureItem(blockIdx) {
      if (!blocks[blockIdx].items) blocks[blockIdx].items = [];
      blocks[blockIdx].items.push({ icon:'✨', title:'Feature Title', description:'Feature description' });
      dirty = true; markUnsaved(); render(); debouncePreview();
    }

    function removeFeatureItem(blockIdx, itemIdx) {
      blocks[blockIdx].items.splice(itemIdx, 1);
      dirty = true; markUnsaved(); render(); debouncePreview();
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    async function saveBlocks() {
      const btn = document.querySelector('.btn-primary');
      btn.textContent = 'Saving...'; btn.disabled = true;
      try {
        const res = await fetch('/admin/variants/${req.params.id}/builder/save', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ blocks })
        });
        const data = await res.json();
        if (data.ok) { dirty = false; document.getElementById('save-status').innerHTML = '✅ Saved'; }
        else { alert('Save failed: ' + (data.error||'unknown')); }
      } catch(e) { alert('Save error: ' + e.message); }
      btn.textContent = '💾 Save'; btn.disabled = false;
    }

    function markUnsaved() { document.getElementById('save-status').innerHTML = '<span class="unsaved-dot"></span>Unsaved changes'; }

    // ── Preview ───────────────────────────────────────────────────────────────
    let previewTimer;
    function debouncePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(refreshPreview, 1200); }

    async function refreshPreview() {
      // Save silently then reload iframe
      await fetch('/admin/variants/${req.params.id}/builder/save', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ blocks })
      });
      document.getElementById('preview-frame').src = '/admin/variants/${req.params.id}/preview-builder?t=' + Date.now();
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    // ── VSL Panel ────────────────────────────────────────────────────────────────
    async function loadVslLibrary() {
      const sel = document.getElementById('vsl-library-select');
      // Use the injected VSL_LIBRARY data
      sel.innerHTML = '<option value="">None</option>' + VSL_LIBRARY.map(v =>
        '<option value="' + v.id + '" ' + (VARIANT_VSL_ID == v.id ? 'selected' : '') + '>' + v.name + ' (' + v.type + ')</option>'
      ).join('');
    }

    async function saveVslSettings() {
      const vslId = document.getElementById('vsl-library-select').value;
      const vslUrl = document.getElementById('vsl-url-input').value.trim();
      const statusEl = document.getElementById('vsl-save-status');
      statusEl.textContent = 'Saving...';
      try {
        // Find existing VSL block or create one
        let vslBlockIdx = blocks.findIndex(b => b.type === 'vsl');
        if (vslBlockIdx === -1) {
          blocks.push({ type: 'vsl', vsl_url: '', vsl_file: '', caption: '' });
          vslBlockIdx = blocks.length - 1;
        }
        if (vslId) {
          // Library VSL — resolve actual URL from VSL_LIBRARY
          const libVsl = VSL_LIBRARY.find(v => String(v.id) === String(vslId));
          const resolvedUrl = libVsl ? (libVsl.url || libVsl.file_path || '') : '';
          blocks[vslBlockIdx].vsl_library_id = parseInt(vslId);
          blocks[vslBlockIdx].vsl_url = libVsl && libVsl.type === 'url' ? resolvedUrl : '';
          blocks[vslBlockIdx].vsl_file = libVsl && libVsl.type === 'file' ? resolvedUrl : '';
        } else if (vslUrl) {
          blocks[vslBlockIdx].vsl_library_id = null;
          blocks[vslBlockIdx].vsl_url = vslUrl;
          blocks[vslBlockIdx].vsl_file = '';
        } else {
          blocks[vslBlockIdx].vsl_url = '';
          blocks[vslBlockIdx].vsl_file = '';
          blocks[vslBlockIdx].vsl_library_id = null;
        }
        // Save blocks
        dirty = true;
        const res = await fetch('/admin/variants/${req.params.id}/builder/save', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ blocks })
        });
        const data = await res.json();
        if (data.ok) {
          dirty = false; markSaved();
          statusEl.textContent = '\u2705 VSL saved';
          render();
          refreshPreview();
        } else {
          statusEl.textContent = '\u274c Error: ' + (data.error || 'unknown');
        }
      } catch(e) {
        statusEl.textContent = '\u274c Error: ' + e.message;
      }
    }

    function init() {
      // Open first block by default if blocks exist
      if (blocks.length > 0) openBlocks.add(0);
      render();
      // Pre-fill URL input if variant has a vsl_url
      const variantVslUrl = ${JSON.stringify(v.vsl_url || '')};
      if (variantVslUrl) document.getElementById('vsl-url-input').value = variantVslUrl;
    }

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', e => { if(dirty) { e.preventDefault(); e.returnValue=''; } });

    // ── AI Chat ──────────────────────────────────────────────────────────────
    let chatHistory = [];
    let aiThinking = false;

    function toggleChat() {
      const panel = document.getElementById('ai-panel');
      const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) document.getElementById('ai-input').focus();
    }

    function appendMessage(role, text, actions) {
      const log = document.getElementById('chat-log');
      const div = document.createElement('div');
      div.style.cssText = \`margin-bottom:12px;display:flex;flex-direction:column;align-items:\${role==='user'?'flex-end':'flex-start'}\`;
      const bubble = document.createElement('div');
      bubble.style.cssText = \`max-width:85%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;\${role==='user'?'background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;border-bottom-right-radius:4px':'background:#1e1e35;color:#e2e8f0;border-bottom-left-radius:4px'}\`;
      bubble.textContent = text;
      div.appendChild(bubble);
      if (actions && actions.length > 0) {
        const applyBtn = document.createElement('button');
        applyBtn.textContent = '✨ Apply ' + actions.length + ' change' + (actions.length>1?'s':'');
        applyBtn.style.cssText = 'margin-top:6px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer';
        applyBtn.onclick = () => { applyActions(actions); applyBtn.textContent = '✅ Applied'; applyBtn.disabled = true; };
        div.appendChild(applyBtn);
      }
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    async function sendAIMessage() {
      const input = document.getElementById('ai-input');
      const msg = input.value.trim();
      if (!msg || aiThinking) return;
      input.value = '';
      aiThinking = true;

      appendMessage('user', msg, null);
      chatHistory.push({ role: 'user', content: msg });

      // Thinking indicator
      const log = document.getElementById('chat-log');
      const thinking = document.createElement('div');
      thinking.id = 'ai-thinking';
      thinking.style.cssText = 'color:#64748b;font-size:12px;padding:4px 0;margin-bottom:8px';
      thinking.textContent = '🤖 Thinking...';
      log.appendChild(thinking); log.scrollTop = log.scrollHeight;

      try {
        const res = await fetch('/admin/variants/${req.params.id}/builder/ai', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ message: msg, history: chatHistory.slice(-10) })
        });
        const data = await res.json();
        thinking.remove();
        if (data.error) {
          appendMessage('assistant', '❌ Error: ' + data.error, null);
        } else {
          appendMessage('assistant', data.reply, data.actions);
          chatHistory.push({ role: 'assistant', content: data.reply });
        }
      } catch(e) {
        thinking.remove();
        appendMessage('assistant', '❌ Connection error. Try again.', null);
      }
      aiThinking = false;
    }

    function applyActions(actions) {
      actions.forEach(a => {
        if (a.action === 'add_block') {
          blocks.push(a.block);
        } else if (a.action === 'update_block' && a.index !== undefined) {
          Object.assign(blocks[a.index] || {}, a.fields);
          if (blocks[a.index]) Object.assign(blocks[a.index], a.fields);
        } else if (a.action === 'remove_block' && a.index !== undefined) {
          blocks.splice(a.index, 1);
        } else if (a.action === 'move_block') {
          const [item] = blocks.splice(a.from, 1);
          blocks.splice(a.to, 0, item);
        } else if (a.action === 'set_blocks') {
          blocks.length = 0;
          blocks.push(...a.blocks);
        }
      });
      dirty = true; markUnsaved(); render(); refreshPreview();
    }

    const aiInput = document.getElementById('ai-input');
    if (aiInput) aiInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
    });

    try {
      init();
    } catch(e) {
      console.error('Builder init error:', e);
      const grid = document.getElementById('block-type-buttons');
      if (grid) grid.innerHTML = '<div style="color:#f87171;font-size:12px;padding:8px">⚠️ Builder error: ' + e.message + '</div>';
    }
    </script>
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

router.get('/:id/preview-builder', requireAuth, async (req, res) => {
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
