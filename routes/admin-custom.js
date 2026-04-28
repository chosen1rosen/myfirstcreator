const express = require('express');
const router = express.Router();
const supabase = require('../db');
const layout = require('./admin-layout');
const Anthropic = require('@anthropic-ai/sdk');

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.redirect('/admin/login');
}

const STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MyFirstCreator.ai</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d0d14;
      color: #e2e8f0;
      min-height: 100vh;
    }
    /* Add your styles here */
  </style>
</head>
<body>

  <!-- Your page content here -->

  <script>
    // Signup form — wire to your form with id="signup-form"
    const form = document.getElementById('signup-form');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('name')?.value || '',
            email: document.getElementById('email').value
          })
        });
        const data = await res.json();
        alert(data.message || "You're in!");
        btn.disabled = false;
      });
    }
  </script>
</body>
</html>`;

const AI_SYSTEM_PROMPT = `You are an expert landing page developer and copywriter for myfirstcreator.ai.

ABOUT THE SITE:
- myfirstcreator.ai is a lead capture funnel for an AI creator marketplace
- People sign up to manage AI influencer accounts and earn money (60% revenue share, free to join)
- Cold traffic from TikTok, Instagram, vehicle wraps
- Brand: bold, modern, dark (#0d0d14 bg), purple (#7c3aed) + cyan (#06b6d4) accents
- Tone: energetic, direct, aspirational — not corporate

YOUR JOB:
- Write complete, production-ready HTML/CSS landing pages
- When asked to build or update a page, output the FULL updated HTML wrapped in <html_update> tags
- Make it beautiful, high-converting, and mobile-responsive

CRITICAL — DYNAMIC CONTENT (always use these, never hardcode):
The page loads live content from the backend API. Always include this JS block to load VSL and testimonials dynamically:

<script>
// Load VSL
fetch('/api/vsl').then(r=>r.json()).then(d=>{
  const wrap = document.getElementById('vsl-container');
  if (!wrap) return;
  if (d.type==='url' && d.url) wrap.innerHTML = '<div class="vsl-wrap"><iframe src="'+d.url+'" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>';
  else if (d.type==='file' && d.file) wrap.innerHTML = '<video src="'+d.file+'" controls style="width:100%;border-radius:12px"></video>';
  else wrap.style.display='none';
});
// Load testimonials
fetch('/api/testimonials').then(r=>r.json()).then(items=>{
  const grid = document.getElementById('testimonials-grid');
  if (!grid || !items.length) { const s = document.getElementById('testimonials-section'); if(s) s.style.display='none'; return; }
  grid.innerHTML = items.map(t=>'<div class="t-card">'+
    (t.image_path?'<img src="'+t.image_path+'" alt="'+t.name+'">':'')+
    '<div class="t-name">'+t.name+'</div>'+
    (t.earnings?'<div class="t-earn">'+t.earnings+'</div>':'')+
    '<div class="t-quote">"'+t.quote+'"</div>'+
  '</div>').join('');
});
// Signup form
const form = document.getElementById('signup-form');
if (form) form.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = form.querySelector('button[type="submit"]');
  btn.textContent='One moment...'; btn.disabled=true;
  const res = await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('name')?.value||'',email:document.getElementById('email').value})});
  const data = await res.json();
  const msg = document.getElementById('success-msg');
  if(msg){msg.textContent=data.message;msg.style.display='block';}
  btn.textContent='Get Started'; btn.disabled=false;
});
</script>

IMPORTANT RULES FOR DYNAMIC SECTIONS:
- VSL video: use <div id="vsl-container"></div> — the JS above fills it automatically
- Testimonials: use <section id="testimonials-section"><div id="testimonials-grid"></div></section>
- Signup form: use <form id="signup-form"> with <input id="email"> and optionally <input id="name">
- NEVER hardcode video URLs, testimonial names/quotes, or emails — always use the dynamic approach
OUTPUT RULES — choose the right format for the job:

For SMALL changes (colors, text, font sizes, spacing, single element tweaks):
Use <css_patch> with only the overriding CSS rules — do NOT rewrite the whole page:
<css_patch>
.btn-submit { background: red !important; background-image: none !important; }
</css_patch>

For LARGE changes (new sections, layout restructure, major redesign):
Output the full page inside <html_update>...</html_update>

For advice/copy suggestions with no code: just reply with text.

IMPORTANT: Prefer css_patch for anything that is purely a style change. It applies instantly and is much faster than a full rewrite.`;

// ─── Custom HTML editor (3-panel layout) ─────────────────────────────────────

router.get('/:id/custom', requireAuth, async (req, res) => {
  const { data: v } = await supabase.from('variants').select('*').eq('id', req.params.id).single();
  if (!v) return res.redirect('/admin/variants');

  const currentHtml = v.custom_html || STARTER_HTML;

  res.send(layout(`Custom Editor — ${v.name}`, `
    <style>
      .editor-wrap { display: grid; grid-template-columns: 300px 1fr 1fr; gap: 0; height: calc(100vh - 120px); margin: -32px; overflow: hidden; }

      /* Chat panel */
      .chat-panel { background: #0d0d14; border-right: 1px solid #1e1e30; display: flex; flex-direction: column; }
      .chat-header { padding: 14px 16px; border-bottom: 1px solid #1e1e30; background: #12121f; flex-shrink: 0; }
      .chat-header-title { font-size: 14px; font-weight: 700; color: #a78bfa; }
      .chat-header-sub { font-size: 11px; color: #475569; margin-top: 2px; }
      #chat-log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
      .chat-input-wrap { padding: 12px; border-top: 1px solid #1e1e30; flex-shrink: 0; background: #0d0d14; }
      .chat-input-row { display: flex; gap: 8px; }
      #ai-input { flex: 1; background: #1a1a2e; border: 1px solid #2d2d4a; color: #e2e8f0; padding: 10px 12px; border-radius: 8px; font-size: 13px; outline: none; resize: none; font-family: inherit; line-height: 1.4; max-height: 120px; overflow-y: auto; }
      #ai-input:focus { border-color: #7c3aed; }
      .send-btn { background: linear-gradient(135deg, #7c3aed, #06b6d4); border: none; color: white; padding: 10px 14px; border-radius: 8px; cursor: pointer; font-size: 16px; align-self: flex-end; }
      .msg-user { align-self: flex-end; background: linear-gradient(135deg,#7c3aed,#06b6d4); color: white; padding: 9px 13px; border-radius: 12px 12px 4px 12px; font-size: 13px; max-width: 85%; line-height: 1.5; word-break: break-word; }
      .msg-ai { align-self: flex-start; background: #1e1e35; color: #e2e8f0; padding: 9px 13px; border-radius: 12px 12px 12px 4px; font-size: 13px; max-width: 85%; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
      .msg-ai.streaming { border-left: 2px solid #7c3aed; }
      .msg-system { align-self: center; color: #475569; font-size: 11px; font-style: italic; }
      .apply-btn { margin-top: 6px; background: linear-gradient(135deg,#7c3aed,#06b6d4); color: white; border: none; border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; align-self: flex-start; }
      .applied-label { margin-top: 4px; color: #6ee7b7; font-size: 11px; align-self: flex-start; }

      /* Code editor */
      .code-panel { background: #0a0a12; border-right: 1px solid #1e1e30; display: flex; flex-direction: column; }
      .panel-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid #1e1e30; background: #12121f; flex-shrink: 0; }
      #code-area { flex: 1; background: #0a0a12; color: #a8b5c8; border: none; outline: none; padding: 16px; font-family: 'JetBrains Mono','Fira Code','Cascadia Code','Courier New',monospace; font-size: 12.5px; line-height: 1.7; resize: none; tab-size: 2; overflow-y: auto; }

      /* Preview */
      .preview-panel { background: #090910; position: relative; display: flex; flex-direction: column; }
      .preview-frame-wrap { flex: 1; position: relative; }
      .preview-frame-wrap iframe { width: 100%; height: 100%; border: none; }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
      .dot-saved { background: #22c55e; }
      .dot-unsaved { background: #f59e0b; }
      .dot-streaming { background: #7c3aed; animation: pulse 1s infinite; }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    </style>

    <div class="editor-wrap">

      <!-- ── LEFT: tabbed panel (AI chat + Content) ── -->
      <div class="chat-panel">
        <!-- Tab bar -->
        <div style="display:flex;border-bottom:1px solid #1e1e30;background:#12121f;flex-shrink:0">
          <button id="tab-ai" onclick="switchTab('ai')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:2px solid #7c3aed;color:#a78bfa;font-size:13px;font-weight:600;cursor:pointer">🤖 AI</button>
          <button id="tab-content" onclick="switchTab('content')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:2px solid transparent;color:#64748b;font-size:13px;font-weight:600;cursor:pointer">📦 Content</button>
        </div>

        <!-- AI tab -->
        <div id="panel-ai" style="display:flex;flex-direction:column;flex:1;overflow:hidden">
          <div id="chat-log" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px">
            <div class="msg-ai">Hey! Tell me what landing page you want and I'll build it. I'll write the full HTML + CSS right in the editor as I work.<br><br>
Try:<br>
<span style="color:#a78bfa">• "Build a bold red + white page for TikTok traffic"</span><br>
<span style="color:#a78bfa">• "Make the hero more urgent and punchy"</span><br>
<span style="color:#a78bfa">• "Write copy focused on the 60% revenue share"</span><br><br>
<span style="color:#475569;font-size:12px">💡 Tip: VSL + testimonials are managed in the Content tab — the AI will wire them in automatically.</span></div>
          </div>
          <div class="chat-input-wrap">
            <div class="chat-input-row">
              <textarea id="ai-input" rows="2" placeholder="Describe what you want..."></textarea>
              <button class="send-btn" onclick="sendMessage()">↑</button>
            </div>
            <div style="font-size:11px;color:#334155;margin-top:6px;text-align:center">Enter to send · Shift+Enter for newline</div>
          </div>
        </div>

        <!-- Content tab -->
        <div id="panel-content" style="display:none;flex:1;overflow-y:auto;padding:16px">

          <!-- VSL -->
          <div style="margin-bottom:20px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin-bottom:10px">🎬 VSL Video</div>
            <div style="margin-bottom:8px">
              <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">YouTube / Vimeo Embed URL</label>
              <input type="text" id="vsl-url-input" placeholder="https://www.youtube.com/embed/..." style="width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:8px 10px;border-radius:6px;font-size:12px;outline:none">
            </div>
            <button onclick="saveVSL()" style="width:100%;background:#1e1e35;border:1px solid #2d2d4a;color:#94a3b8;padding:8px;border-radius:6px;font-size:12px;cursor:pointer">Save VSL</button>
            <div id="vsl-msg" style="font-size:11px;margin-top:6px;display:none"></div>
          </div>

          <div style="border-top:1px solid #1e1e30;padding-top:16px;margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin-bottom:10px">💬 Testimonials</div>
            <div id="testimonials-list" style="margin-bottom:10px"></div>
            <button onclick="openAddTestimonial()" style="width:100%;background:linear-gradient(135deg,#7c3aed,#06b6d4);border:none;color:white;padding:8px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">+ Add Testimonial</button>
          </div>

          <!-- Add testimonial form (hidden by default) -->
          <div id="add-testimonial-form" style="display:none;background:#12121f;border:1px solid #1e1e30;border-radius:10px;padding:14px;margin-bottom:16px">
            <div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:10px">New Testimonial</div>
            <input type="text" id="t-name" placeholder="Name" style="width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:7px 10px;border-radius:6px;font-size:12px;outline:none;margin-bottom:6px">
            <input type="text" id="t-handle" placeholder="@handle or title (optional)" style="width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:7px 10px;border-radius:6px;font-size:12px;outline:none;margin-bottom:6px">
            <input type="text" id="t-earnings" placeholder="Earnings e.g. $4,200/mo (optional)" style="width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:7px 10px;border-radius:6px;font-size:12px;outline:none;margin-bottom:6px">
            <textarea id="t-quote" placeholder="Their quote..." rows="3" style="width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:7px 10px;border-radius:6px;font-size:12px;outline:none;resize:vertical;font-family:inherit;margin-bottom:8px"></textarea>
            <div style="display:flex;gap:8px">
              <button onclick="saveTestimonial()" style="flex:1;background:linear-gradient(135deg,#7c3aed,#06b6d4);border:none;color:white;padding:7px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Save</button>
              <button onclick="document.getElementById('add-testimonial-form').style.display='none'" style="background:#1e1e35;border:1px solid #2d2d4a;color:#94a3b8;padding:7px 12px;border-radius:6px;font-size:12px;cursor:pointer">Cancel</button>
            </div>
          </div>

          <div style="border-top:1px solid #1e1e30;padding-top:14px">
            <a href="/admin/testimonials" target="_blank" style="display:block;text-align:center;font-size:12px;color:#64748b;text-decoration:none">Open full testimonials manager ↗</a>
            <a href="/admin/vsl" target="_blank" style="display:block;text-align:center;font-size:12px;color:#64748b;text-decoration:none;margin-top:6px">Open full VSL manager ↗</a>
          </div>
        </div>
      </div>

      <!-- ── MIDDLE: code editor ── -->
      <div class="code-panel">
        <div class="panel-toolbar">
          <a href="/admin/variants" class="btn btn-ghost btn-sm" style="padding:4px 10px;font-size:12px">← Back</a>
          <span style="flex:1;font-size:12px;color:#64748b;font-family:monospace">index.html</span>
          <span id="save-status"><span class="status-dot dot-saved"></span><span style="font-size:11px;color:#22c55e">Saved</span></span>
          <button onclick="manualSave()" style="background:#1e1e35;border:1px solid #2d2d4a;color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">💾 Save</button>
          <button onclick="formatPreview()" style="background:#1e1e35;border:1px solid #2d2d4a;color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">↻</button>
        </div>
        <textarea id="code-area" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
      </div>

      <!-- ── RIGHT: live preview ── -->
      <div class="preview-panel">
        <div class="panel-toolbar">
          <span style="font-size:12px;color:#64748b">Live Preview</span>
          <a href="/admin/variants/${req.params.id}/preview-custom" target="_blank" style="margin-left:auto;background:#1e1e35;border:1px solid #2d2d4a;color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:11px;text-decoration:none">Open full ↗</a>
        </div>
        <div class="preview-frame-wrap">
          <iframe id="preview-frame" src="/admin/variants/${req.params.id}/preview-custom"></iframe>
        </div>
      </div>

    </div>

    <script>
    // ── Init ──────────────────────────────────────────────────────────────────
    const ta = document.getElementById('code-area');
    let dirty = false;
    let saveTimer;
    let chatHistory = [];
    let isStreaming = false;
    let pendingHtml = null;

    // Load initial HTML
    ta.value = ${JSON.stringify(currentHtml).replace(/<\/script>/gi, '<\\/script>')};

    // ── Code editor ───────────────────────────────────────────────────────────
    ta.addEventListener('input', () => {
      dirty = true; setStatus('unsaved');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(autoSave, 2000);
    });

    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = s + 2;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); manualSave(); }
    });

    function setStatus(state) {
      const el = document.getElementById('save-status');
      if (state === 'saved') el.innerHTML = '<span class="status-dot dot-saved"></span><span style="font-size:11px;color:#22c55e">Saved</span>';
      else if (state === 'unsaved') el.innerHTML = '<span class="status-dot dot-unsaved"></span><span style="font-size:11px;color:#f59e0b">Unsaved</span>';
      else if (state === 'streaming') el.innerHTML = '<span class="status-dot dot-streaming"></span><span style="font-size:11px;color:#a78bfa">AI writing...</span>';
    }

    async function autoSave() {
      await saveHtml(ta.value);
      if (!isStreaming) setStatus('saved');
      refreshPreview();
    }

    async function manualSave() {
      await saveHtml(ta.value);
      setStatus('saved');
      refreshPreview();
    }

    async function saveHtml(html) {
      dirty = false;
      await fetch('/admin/variants/${req.params.id}/custom/save', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ html })
      });
    }

    function refreshPreview() {
      document.getElementById('preview-frame').src =
        '/admin/variants/${req.params.id}/preview-custom?t=' + Date.now();
    }

    function formatPreview() { autoSave(); }

    // ── Chat ─────────────────────────────────────────────────────────────────
    const chatLog = document.getElementById('chat-log');

    function addMsg(cls, text) {
      const div = document.createElement('div');
      div.className = cls;
      div.textContent = text;
      chatLog.appendChild(div);
      chatLog.scrollTop = chatLog.scrollHeight;
      return div;
    }

    function addSysMsg(text) { addMsg('msg-system', text); }

    document.getElementById('ai-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    async function sendMessage() {
      if (isStreaming) return;
      const input = document.getElementById('ai-input');
      const msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      isStreaming = true;
      pendingHtml = null;

      addMsg('msg-user', msg);
      chatHistory.push({ role: 'user', content: msg });

      // AI bubble that streams into
      const aiBubble = addMsg('msg-ai streaming', '');
      setStatus('streaming');

      try {
        const res = await fetch('/admin/variants/${req.params.id}/custom/ai-stream', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ message: msg, history: chatHistory.slice(-8), currentHtml: ta.value })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let htmlBuffer = '';
        let inHtmlTag = false;
        let displayText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          const lines = chunk.split('\\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              const token = parsed.token || '';
              fullText += token;

              // ── CSS patch (fast path — no full rewrite) ──
              if (!inHtmlTag && fullText.includes('<css_patch>') && fullText.includes('</css_patch>')) {
                const cssMatch = fullText.match(/<css_patch>([\s\S]*?)<\/css_patch>/);
                if (cssMatch) {
                  const css = cssMatch[1].trim();
                  // Inject at end of </style> block in the editor
                  let html = ta.value;
                  if (html.includes('</style>')) {
                    html = html.replace(/(<\/style>)(?![\s\S]*<\/style>)/, '\n  /* AI patch */\n  ' + css + '\n$1');
                  } else {
                    html = html.replace('</head>', '<style>\n  /* AI patch */\n  ' + css + '\n</style>\n</head>');
                  }
                  ta.value = html;
                  displayText = fullText.replace(/<css_patch>[\s\S]*?<\/css_patch>/, '').trim();
                  aiBubble.textContent = displayText || '✅ Applied style change';
                  chatLog.scrollTop = chatLog.scrollHeight;
                }
                continue;
              }

              // ── Full HTML rewrite (streams into editor) ──
              if (!inHtmlTag) {
                if (fullText.includes('<html_update>')) {
                  inHtmlTag = true;
                  const split = fullText.split('<html_update>');
                  displayText = split[0];
                  htmlBuffer = split[1] || '';
                  if (htmlBuffer) { ta.value = htmlBuffer; ta.scrollTop = ta.scrollHeight; }
                } else {
                  displayText = fullText;
                }
              } else {
                if (fullText.includes('</html_update>')) {
                  inHtmlTag = false;
                  const endSplit = fullText.split('</html_update>');
                  htmlBuffer = endSplit[0].split('<html_update>').pop();
                  displayText = (endSplit[0].split('<html_update>')[0] || '') + (endSplit[1] || '');
                  ta.value = htmlBuffer;
                } else {
                  htmlBuffer = fullText.split('<html_update>').pop();
                  ta.value = htmlBuffer;
                  ta.scrollTop = ta.scrollHeight;
                }
              }

              aiBubble.textContent = displayText.trim() || (inHtmlTag ? '⌨️ Writing HTML...' : '');
              chatLog.scrollTop = chatLog.scrollHeight;

            } catch(e) { /* skip bad JSON */ }
          }
        }

        // Done streaming
        aiBubble.classList.remove('streaming');
        chatHistory.push({ role: 'assistant', content: fullText });

        // Save and refresh if any HTML was changed
        if (htmlBuffer.includes('<') || fullText.includes('<css_patch>')) {
          await saveHtml(ta.value);
          refreshPreview();
          addSysMsg('✅ Preview updated');
        }

      } catch(err) {
        aiBubble.textContent = '❌ Error: ' + err.message;
      }

      isStreaming = false;
      setStatus('saved');
    }

    window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    // ── Tabs ──────────────────────────────────────────────────────────────────
    function switchTab(tab) {
      const isAI = tab === 'ai';
      document.getElementById('panel-ai').style.display = isAI ? 'flex' : 'none';
      document.getElementById('panel-content').style.display = isAI ? 'none' : 'block';
      document.getElementById('tab-ai').style.borderBottomColor = isAI ? '#7c3aed' : 'transparent';
      document.getElementById('tab-ai').style.color = isAI ? '#a78bfa' : '#64748b';
      document.getElementById('tab-content').style.borderBottomColor = isAI ? 'transparent' : '#7c3aed';
      document.getElementById('tab-content').style.color = isAI ? '#64748b' : '#a78bfa';
      if (!isAI) loadContentPanel();
    }

    // ── Content panel ─────────────────────────────────────────────────────────
    async function loadContentPanel() {
      // Load current VSL URL
      try {
        const vsl = await fetch('/api/vsl').then(r => r.json());
        if (vsl.url) document.getElementById('vsl-url-input').value = vsl.url;
      } catch(e) {}
      // Load testimonials list
      loadTestimonialsList();
    }

    async function loadTestimonialsList() {
      try {
        const items = await fetch('/api/testimonials').then(r => r.json());
        const list = document.getElementById('testimonials-list');
        if (!items.length) { list.innerHTML = '<div style="font-size:12px;color:#475569;text-align:center;padding:8px">No testimonials yet</div>'; return; }
        list.innerHTML = items.map(t => \`<div style="background:#12121f;border:1px solid #1e1e30;border-radius:8px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600;color:#e2e8f0">\${t.name}</div>
            \${t.earnings ? \`<div style="font-size:11px;color:#22c55e">\${t.earnings}</div>\` : ''}
            <div style="font-size:11px;color:#64748b;margin-top:2px">\${(t.quote||'').substring(0,50)}...</div>
          </div>
          <button onclick="deleteTestimonial(\${t.id})" style="background:none;border:none;color:#7f1d1d;cursor:pointer;font-size:14px;padding:4px">✕</button>
        </div>\`).join('');
      } catch(e) {}
    }

    async function saveVSL() {
      const url = document.getElementById('vsl-url-input').value.trim();
      const msg = document.getElementById('vsl-msg');
      try {
        await fetch('/admin/variants/${req.params.id}/custom/save-vsl', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ vsl_url: url, vsl_type: url ? 'url' : 'none' })
        });
        msg.textContent = '✅ Saved — preview will update'; msg.style.color = '#6ee7b7'; msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 3000);
        refreshPreview();
      } catch(e) { msg.textContent = '❌ Save failed'; msg.style.display = 'block'; }
    }

    function openAddTestimonial() {
      document.getElementById('add-testimonial-form').style.display = 'block';
    }

    async function saveTestimonial() {
      const name = document.getElementById('t-name').value.trim();
      const handle = document.getElementById('t-handle').value.trim();
      const earnings = document.getElementById('t-earnings').value.trim();
      const quote = document.getElementById('t-quote').value.trim();
      if (!name || !quote) { alert('Name and quote are required'); return; }
      try {
        await fetch('/admin/variants/${req.params.id}/custom/save-testimonial', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ name, handle, earnings, quote, active: true, sort_order: 99 })
        });
        document.getElementById('add-testimonial-form').style.display = 'none';
        document.getElementById('t-name').value = '';
        document.getElementById('t-handle').value = '';
        document.getElementById('t-earnings').value = '';
        document.getElementById('t-quote').value = '';
        loadTestimonialsList();
        refreshPreview();
      } catch(e) { alert('Save failed: ' + e.message); }
    }

    async function deleteTestimonial(id) {
      if (!confirm('Remove this testimonial?')) return;
      await fetch('/admin/variants/${req.params.id}/custom/delete-testimonial/' + id, { method: 'POST' });
      loadTestimonialsList();
      refreshPreview();
    }
    </script>
  `, 'variants'));
});

// ─── Streaming AI endpoint ────────────────────────────────────────────────────

router.post('/:id/custom/ai-stream', requireAuth, async (req, res) => {
  const { message, history, currentHtml } = req.body;
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages = [
      ...(history || []).slice(-8),
      {
        role: 'user',
        content: currentHtml && currentHtml.trim().length > 50
          ? `Current page HTML:\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nRequest: ${message}`
          : message
      }
    ];

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: AI_SYSTEM_PROMPT,
      messages
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const token = chunk.delta.text;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ token: '\n❌ ' + err.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ─── Content management routes ───────────────────────────────────────────────

router.post('/:id/custom/save-vsl', requireAuth, async (req, res) => {
  const { vsl_url, vsl_type } = req.body;
  await supabase.from('settings').upsert({ key: 'vsl_type', value: vsl_type || 'none', updated_at: new Date().toISOString() });
  if (vsl_url) await supabase.from('settings').upsert({ key: 'vsl_url', value: vsl_url, updated_at: new Date().toISOString() });
  res.json({ ok: true });
});

router.post('/:id/custom/save-testimonial', requireAuth, async (req, res) => {
  const { name, handle, earnings, quote, active, sort_order } = req.body;
  const { error } = await supabase.from('testimonials').insert({
    name, handle: handle || null, earnings: earnings || null,
    quote, active: active !== false, sort_order: sort_order || 99
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/:id/custom/delete-testimonial/:tid', requireAuth, async (req, res) => {
  await supabase.from('testimonials').delete().eq('id', req.params.tid);
  res.json({ ok: true });
});

// ─── Save custom HTML ─────────────────────────────────────────────────────────

router.post('/:id/custom/save', requireAuth, async (req, res) => {
  const { html } = req.body;
  const { error } = await supabase.from('variants').update({
    custom_html: html,
    page_mode: 'custom',
    updated_at: new Date().toISOString()
  }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─── Preview ──────────────────────────────────────────────────────────────────

router.get('/:id/preview-custom', requireAuth, async (req, res) => {
  const { data: v } = await supabase.from('variants').select('custom_html').eq('id', req.params.id).single();
  if (!v?.custom_html) return res.send('<p style="color:#fff;padding:40px;font-family:sans-serif;background:#0d0d14">Nothing here yet — ask the AI to build something!</p>');
  const html = v.custom_html.replace(
    '<body>',
    '<body><div style="position:fixed;top:0;left:0;right:0;background:#7c3aed;color:white;text-align:center;padding:6px;font-size:12px;z-index:99999;font-family:sans-serif">⚠️ PREVIEW — not live</div><div style="height:32px"></div>'
  );
  res.send(html);
});

module.exports = router;
