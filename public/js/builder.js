    const BLOCK_TYPES = window.__BUILDER__.blockTypes;
    let blocks = window.__BUILDER__.blocks;
    let dirty = false;
    const VSL_LIBRARY = window.__BUILDER__.vslLibrary;
    const VARIANT_VSL_ID = window.__BUILDER__.variantVslId;

    // ── Default block configs ────────────────────────────────────────────────
    const DEFAULTS = {
      hero: { type:'hero', headline:'Your Headline Here', subheadline:'Your compelling subheadline goes here.', cta_text:'Get Started →', badge_text:'', trust_items:'✅ 100% Free\\n🔒 No Credit Card', bg_color:'transparent', padding:'64px' },
      vsl: { type:'vsl', vsl_url:'', vsl_file:'', caption:'' },
      email_capture: { type:'email_capture', title:'Claim Your Free Spot', subtitle:'Enter your details to get instant access', cta_text:'Get Instant Access →', label:'🎟️ Free Training', show_name:true, name_placeholder:'Your first name', email_placeholder:'Your email address', bg_color:'transparent' },
      testimonials: { type:'testimonials', title:'Real Results From Real People', label:'💬 What They Say', layout:'grid', limit:6 },
      features: { type:'features', title:'Why This Works', subtitle:'', label:'⚡ The Platform', columns:3, items:[{icon:'🤖',title:'AI Creator Tech',description:'Built-in AI technology that runs 24/7'},{icon:'💰',title:'60% Revenue Share',description:'You keep the majority of everything earned'},{icon:'📈',title:'Built-in Audience',description:'Traffic and distribution already set up'}] },
      image_text: { type:'image_text', title:'Your Title', body:'Your description text goes here.', cta_text:'', image_url:'', image_side:'left', label:'', cta_destination:'signup', cta_link:'' },
      cta_banner: { type:'cta_banner', headline:'Ready to Start?', subheadline:'Join thousands already earning with AI creators.', cta_text:'Claim Your Spot →', bg_color:'linear-gradient(135deg,#7c3aed,#06b6d4)', text_color:'white', cta_destination:'signup', cta_link:'' },
      html: { type:'html', content:'<p style="color:#e2e8f0;text-align:center;padding:40px">Your custom HTML here</p>' },
      how_it_works: { type:'how_it_works', title:'HOW IT WORKS', steps:[
        { title:'Choose your 100% Free AI Creator', description:'Pick from our library of AI creators — no upfront cost, no technical skills required.', image:'', color:'#ff3366' },
        { title:'Watch Our Free Education', description:'Access our complete training library to learn how to grow and monetize your AI creator.', image:'', color:'#7c3aed' },
        { title:'Generate Unlimited Content on our Apex AI Generator', description:'Create professional photos and videos for TikTok, Reels, and more with one click.', image:'', color:'#06b6d4' },
        { title:'Go Viral', description:'Your AI creator stays 100% consistent across every post, building a real audience fast.', image:'', color:'#ff3366' },
        { title:'Get Paid', description:'Earn through fan subscriptions, brand deals, and automated revenue streams — you keep 60%.', image:'', color:'#22c55e' }
      ]},
    };

    // ── Render block list ────────────────────────────────────────────────────
    function render() {
      const list = document.getElementById('block-list');
      list.innerHTML = blocks.map((b, i) => renderBlockEditor(b, i)).join('');
      // Restore open state
      openBlocks.forEach(i => {
        const body = document.querySelector(`[data-block-index="${i}"] .block-body`);
        if (body) body.classList.add('open');
      });
    }

    let openBlocks = new Set();

    function renderBlockEditor(b, i) {
      const typeInfo = BLOCK_TYPES.find(t => t.type === b.type) || { label: b.type };
      return `<div class="block-item" data-block-index="${i}">
        <div class="block-header" onclick="toggleBlock(${i})">
          <span class="block-drag" title="Drag to reorder">⠿</span>
          <span class="block-label">${typeInfo.label}</span>
          <div class="block-actions">
            <button onclick="event.stopPropagation();moveBlock(${i},-1)" title="Move up" style="background:none;border:none;color:#64748b;cursor:pointer;padding:2px 4px;font-size:14px" ${i===0?'disabled':''}>↑</button>
            <button onclick="event.stopPropagation();moveBlock(${i},1)" title="Move down" style="background:none;border:none;color:#64748b;cursor:pointer;padding:2px 4px;font-size:14px" ${i===blocks.length-1?'disabled':''}>↓</button>
            <button onclick="event.stopPropagation();duplicateBlock(${i})" title="Duplicate" style="background:none;border:none;color:#64748b;cursor:pointer;padding:2px 4px;font-size:14px">⧉</button>
            <button onclick="event.stopPropagation();removeBlock(${i})" title="Remove" style="background:none;border:none;color:#7f1d1d;cursor:pointer;padding:2px 4px;font-size:14px">✕</button>
          </div>
        </div>
        <div class="block-body">
          ${renderBlockForm(b, i)}
        </div>
      </div>`;
    }

    function renderBlockForm(b, i) {
      const f = (key, label, type='text', extra='') => `
        <div class="field">
          <label>${label}</label>
          <input type="${type}" value="${esc(b[key]||'')}" onchange="updateField(${i},'${key}',this.value)" ${extra}>
        </div>`;
      const ta = (key, label, rows=3) => `
        <div class="field">
          <label>${label}</label>
          <textarea rows="${rows}" onchange="updateField(${i},'${key}',this.value)">${esc(b[key]||'')}</textarea>
        </div>`;
      const sel = (key, label, options) => `
        <div class="field">
          <label>${label}</label>
          <select onchange="updateField(${i},'${key}',this.value)">${options.map(o=>`<option value="${o.v}" ${b[key]===o.v?'selected':''}>${o.l}</option>`).join('')}</select>
        </div>`;
      const chk = (key, label) => `
        <div class="field" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" ${b[key]!==false?'checked':''} onchange="updateField(${i},'${key}',this.checked)" style="width:auto;margin:0">
          <label style="margin:0">${label}</label>
        </div>`;

      switch(b.type) {
        case 'hero': return f('headline','Headline') + ta('subheadline','Subheadline') + f('cta_text','CTA Button Text') + ctaDest(b, i) + f('badge_text','Badge Pill Text (optional)') + ta('trust_items','Trust Items (one per line)',3) + f('bg_color','Background Color','text','placeholder="transparent or #hex or CSS gradient"') + f('padding','Vertical Padding','text','placeholder="64px"');
        case 'vsl': return renderVslBlockForm(b, i);
        case 'email_capture': return f('title','Title') + f('subtitle','Subtitle') + f('cta_text','Button Text') + f('label','Section Label (optional)') + chk('show_name','Show name field') + f('name_placeholder','Name Placeholder','text') + f('email_placeholder','Email Placeholder','text') + f('bg_color','Background Color','text','placeholder="transparent"');
        case 'testimonials': return f('title','Section Title') + f('label','Section Label') + sel('layout','Layout',[{v:'grid',l:'Grid'},{v:'list',l:'List'}]) + f('limit','Max Testimonials to Show','number');
        case 'features': return f('title','Section Title') + f('subtitle','Subtitle') + f('label','Section Label') + sel('columns','Columns',[{v:2,l:'2 Columns'},{v:3,l:'3 Columns'},{v:4,l:'4 Columns'}]) + renderFeatureItems(b, i);
        case 'image_text': return f('title','Title') + ta('body','Body Text') + f('cta_text','CTA Button (optional)') + ctaDest(b, i) + f('image_url','Image URL') + sel('image_side','Image Position',[{v:'left',l:'Image Left'},{v:'right',l:'Image Right'}]) + f('label','Label (optional)');
        case 'cta_banner': return f('headline','Headline') + f('subheadline','Subheadline') + f('cta_text','Button Text') + ctaDest(b, i) + f('bg_color','Background','text','placeholder="linear-gradient(135deg,#7c3aed,#06b6d4)"') + f('text_color','Text Color','text','placeholder="white"');
        case 'html': return `<div class="field"><label>Custom HTML</label><textarea rows="8" onchange="updateField(${i},'content',this.value)">${esc(b.content||'')}</textarea></div>`;
        case 'how_it_works': return renderHowItWorksForm(b, i);
        default: return '<p style="color:#64748b;font-size:13px">No options for this block type.</p>';
      }
    }

    function renderFeatureItems(b, i) {
      const items = b.items || [];
      const rows = items.map((item, j) => `
        <div class="feature-item">
          <div class="feature-item-header">Feature ${j+1} <button onclick="removeFeatureItem(${i},${j})" style="background:none;border:none;color:#7f1d1d;cursor:pointer;font-size:12px">✕ Remove</button></div>
          <div style="display:grid;grid-template-columns:48px 1fr;gap:8px">
            <div class="field"><label>Icon</label><input type="text" value="${item.icon||''}" onchange="updateFeatureItem(${i},${j},'icon',this.value)" style="text-align:center"></div>
            <div class="field"><label>Title</label><input type="text" value="${esc(item.title||'')}" onchange="updateFeatureItem(${i},${j},'title',this.value)"></div>
          </div>
          <div class="field"><label>Description</label><input type="text" value="${esc(item.description||'')}" onchange="updateFeatureItem(${i},${j},'description',this.value)"></div>
        </div>`).join('');
      return `<div style="margin-top:12px"><div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:8px">Feature Items</div>${rows}<button onclick="addFeatureItem(${i})" class="btn btn-ghost btn-sm" style="margin-top:4px;width:100%">+ Add Feature</button></div>`;
    }

    function renderVslBlockForm(b, i) {
      if (VSL_LIBRARY.length === 0) {
        return '<div class="field"><p style="color:#64748b;font-size:12px">No VSLs in library. <a href="/admin/vsl" target="_blank" style="color:#a78bfa">Upload one first</a></p></div>';
      }
      var opts = '<option value="">-- Select VSL --</option>';
      for (var vi = 0; vi < VSL_LIBRARY.length; vi++) {
        var vsl = VSL_LIBRARY[vi];
        var sel = String(b.vsl_library_id) === String(vsl.id) ? ' selected' : '';
        opts += '<option value="' + vsl.id + '"' + sel + '>' + esc(vsl.name) + ' (' + vsl.type + ')</option>';
      }
      var capVal = esc(b.caption || '');
      return '<div class="field"><label>VSL from Library</label>'
        + '<select onchange="updateVslBlock(' + i + ', this.value)">' + opts + '</select></div>'
        + '<div class="field"><label>Caption (optional)</label>'
        + '<input type="text" value="' + capVal + '" onchange="updateField(' + i + ',\'caption\',this.value)"></div>';
    }

    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

    function ctaDest(b, i) {
      var isLink = b.cta_destination === 'link';
      var linkVal = b.cta_link || '';
      return '<div class="field"><label>CTA Destination</label>'
        + '<div style="display:flex;gap:16px;margin-bottom:8px">'
        + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#94a3b8;margin:0">'
        + '<input type="radio" name="cta_dest_' + i + '" value="signup" ' + (!isLink ? 'checked' : '') + ' onchange="updateField(' + i + ',\'cta_destination\',\'signup\');toggleCtaLink(' + i + ',false)" style="width:auto;margin:0"> Email signup form</label>'
        + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#94a3b8;margin:0">'
        + '<input type="radio" name="cta_dest_' + i + '" value="link" ' + (isLink ? 'checked' : '') + ' onchange="updateField(' + i + ',\'cta_destination\',\'link\');toggleCtaLink(' + i + ',true)" style="width:auto;margin:0"> Direct link (external URL)</label>'
        + '</div>'
        + '<input type="text" id="cta_link_' + i + '" value="' + esc(linkVal) + '" placeholder="https://addcal.co/your-webinar" '
        + 'onchange="updateField(' + i + ',\'cta_link\',this.value)" '
        + 'style="' + (isLink ? '' : 'display:none;') + '">'
        + '</div>';
    }

    function toggleCtaLink(i, show) {
      var el = document.getElementById('cta_link_' + i);
      if (el) el.style.display = show ? '' : 'none';
    }




    function updateVslBlock(i, vslId) {
      var libVsl = null;
      for (var vi = 0; vi < VSL_LIBRARY.length; vi++) {
        if (String(VSL_LIBRARY[vi].id) === String(vslId)) { libVsl = VSL_LIBRARY[vi]; break; }
      }
      blocks[i].vsl_library_id = vslId ? parseInt(vslId) : null;
      if (libVsl) {
        blocks[i].vsl_file = libVsl.file_path || '';
        blocks[i].vsl_url = libVsl.url || '';
      } else {
        blocks[i].vsl_file = '';
        blocks[i].vsl_url = '';
      }
      dirty = true; markUnsaved(); debouncePreview();
    }

    // ── Block actions ────────────────────────────────────────────────────────
    function toggleBlock(i) {
      if (openBlocks.has(i)) openBlocks.delete(i); else openBlocks.add(i);
      const body = document.querySelector(`[data-block-index="${i}"] .block-body`);
      if (body) body.classList.toggle('open');
    }

    function addBlock(type) {
      blocks.push(JSON.parse(JSON.stringify(DEFAULTS[type] || { type })));
      dirty = true; markUnsaved();
      const newIdx = blocks.length - 1;
      openBlocks.add(newIdx);
      render(); refreshPreview();
      // Scroll to new block
      setTimeout(() => document.querySelector(`[data-block-index="${newIdx}"]`)?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 100);
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

    function renderHowItWorksForm(b, i) {
      var steps = b.steps || [];
      var rows = steps.map(function(step, j) {
        return '<div style="background:#0d0d14;border:1px solid #2d2d4a;border-radius:8px;padding:12px;margin-bottom:8px">'
          + '<div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:8px">STEP ' + (j+1) + ' <button onclick="removeHowItWorksStep(' + i + ',' + j + ')" style="float:right;background:none;border:none;color:#7f1d1d;cursor:pointer;font-size:11px">✕ Remove</button></div>'
          + '<div class="field"><label>Title</label><input type="text" value="' + esc(step.title||'') + '" onchange="updateHowItWorksStep(' + i + ',' + j + ',\'title\',this.value)"></div>'
          + '<div class="field"><label>Description</label><textarea rows="2" onchange="updateHowItWorksStep(' + i + ',' + j + ',\'description\',this.value)">' + esc(step.description||'') + '</textarea></div>'
          + '<div class="field"><label>Background Image URL (optional)</label><input type="text" value="' + esc(step.image||'') + '" onchange="updateHowItWorksStep(' + i + ',' + j + ',\'image\',this.value)" placeholder="https://..."></div>'
          + '<div class="field"><label>Arrow Button Color</label><input type="text" value="' + esc(step.color||'#ff3366') + '" onchange="updateHowItWorksStep(' + i + ',' + j + ',\'color\',this.value)" placeholder="#ff3366"></div>'
          + '</div>';
      }).join('');
      const f = (key, label) => `<div class="field"><label>${label}</label><input type="text" value="${esc(b[key]||'')}" onchange="updateField(${i},'${key}',this.value)"></div>`;
      return f('title', 'Section Title')
        + '<div style="margin-top:12px"><div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:8px">Steps</div>'
        + rows
        + '<button onclick="addHowItWorksStep(' + i + ')" class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px">+ Add Step</button></div>';
    }

    function updateHowItWorksStep(blockIdx, stepIdx, key, val) {
      if (!blocks[blockIdx].steps) blocks[blockIdx].steps = [];
      blocks[blockIdx].steps[stepIdx][key] = val;
      dirty = true; markUnsaved(); debouncePreview();
    }
    function addHowItWorksStep(blockIdx) {
      if (!blocks[blockIdx].steps) blocks[blockIdx].steps = [];
      blocks[blockIdx].steps.push({ title:'New Step', description:'', image:'', color:'#ff3366' });
      dirty = true; markUnsaved(); render(); debouncePreview();
    }
    function removeHowItWorksStep(blockIdx, stepIdx) {
      if (!blocks[blockIdx].steps) return;
      blocks[blockIdx].steps.splice(stepIdx, 1);
      dirty = true; markUnsaved(); render(); debouncePreview();
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    async function saveBlocks() {
      const btn = document.querySelector('.btn-primary');
      btn.textContent = 'Saving...'; btn.disabled = true;
      try {
        const res = await fetch('/admin/variants/' + window.__BUILDER__.variantId + '/builder/save', {
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
      await fetch('/admin/variants/' + window.__BUILDER__.variantId + '/builder/save', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ blocks })
      });
      document.getElementById('preview-frame').src = '/admin/variants/' + window.__BUILDER__.variantId + '/preview-builder?t=' + Date.now();
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
        const res = await fetch('/admin/variants/' + window.__BUILDER__.variantId + '/builder/save', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ blocks })
        });
        const data = await res.json();
        if (data.ok) {
          dirty = false; document.getElementById('save-status').innerHTML = '\u2705 Saved';
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
      const variantVslUrl = window.__BUILDER__.variantVslUrl || '';
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
      div.style.cssText = `margin-bottom:12px;display:flex;flex-direction:column;align-items:${role==='user'?'flex-end':'flex-start'}`;
      const bubble = document.createElement('div');
      bubble.style.cssText = `max-width:85%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;${role==='user'?'background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;border-bottom-right-radius:4px':'background:#1e1e35;color:#e2e8f0;border-bottom-left-radius:4px'}`;
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
        const res = await fetch('/admin/variants/' + window.__BUILDER__.variantId + '/builder/ai', {
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