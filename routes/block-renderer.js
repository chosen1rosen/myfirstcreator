// Block renderer — converts a blocks JSON array into a full landing page HTML string

const BLOCK_TYPES = [
  { type: 'hero',          label: '🦸 Hero Section' },
  { type: 'vsl',           label: '🎬 Video (VSL)' },
  { type: 'email_capture', label: '📧 Email Capture Form' },
  { type: 'testimonials',  label: '💬 Testimonials' },
  { type: 'features',      label: '⚡ Features Grid' },
  { type: 'image_text',    label: '🖼️ Image + Text' },
  { type: 'cta_banner',    label: '🚀 CTA Banner' },
  { type: 'calendar_add',  label: '📅 Add to Calendar' },
  { type: 'html',          label: '💻 Custom HTML' },
  { type: 'how_it_works',  label: '📋 How It Works' },
  { type: 'creator_scroll', label: '🎬 Creator Scroll' },
];
module.exports.BLOCK_TYPES = BLOCK_TYPES;

// ─── render a single block to HTML ──────────────────────────────────────────

function renderBlock(block, testimonialData = []) {
  switch (block.type) {
    case 'hero': return renderHero(block);
    case 'vsl': return renderVSL(block);
    case 'email_capture': return renderEmailCapture(block);
    case 'testimonials': return renderTestimonials(block, testimonialData);
    case 'features': return renderFeatures(block);
    case 'image_text': return renderImageText(block);
    case 'cta_banner': return renderCTABanner(block);
    case 'calendar_add': return renderCalendarAdd(block);
    case 'html': return `<div class="custom-block">${block.content || ''}</div>`;
    case 'how_it_works': return renderHowItWorks(block);
    case 'creator_scroll': return renderCreatorScroll(block);
    default: return ''
  }
}

function renderHero(b) {
  const bg = b.bg_color || 'transparent';
  const trust = (b.trust_items || '').split('\n').filter(Boolean);
  return `
  <section class="block-hero" style="background:${bg};padding:${b.padding||'64px'} 20px;text-align:center">
    <div class="container">
      ${b.badge_text ? `<div class="badge-pill">${b.badge_text}</div><br>` : ''}
      <h1 class="hero-headline">${b.headline || 'Your Headline Here'}</h1>
      ${b.subheadline ? `<p class="hero-sub">${b.subheadline}</p>` : ''}
      ${b.cta_text ? `<a href="${b.cta_destination === 'link' && b.cta_link ? b.cta_link : '#signup'}" class="btn-hero" ${b.cta_destination === 'link' && b.cta_link ? 'target="_blank"' : ''}>${b.cta_text}</a>` : ''}
      ${trust.length ? `<div class="trust-row">${trust.map(t=>`<span>${t}</span>`).join('')}</div>` : ''}
    </div>
  </section>`;
}

function renderVSL(b) {
  if (!b.vsl_file && !b.vsl_url) return '';
  const src = b.vsl_file || b.vsl_url;
  const content = `<video src="${src}" controls style="width:100%;border-radius:16px;box-shadow:0 0 40px rgba(124,58,237,.2)"></video>`;
  return `
  <section class="block-vsl" style="padding:48px 20px;background:rgba(124,58,237,.04);border-top:1px solid #1e1e30;border-bottom:1px solid #1e1e30">
    <div class="container">
      ${b.caption ? `<p style="text-align:center;color:#94a3b8;margin-bottom:20px;font-size:15px">${b.caption}</p>` : ''}
      ${content}
    </div>
  </section>`;
}

function renderEmailCapture(b) {
  const bg = b.bg_color || 'transparent';
  const isLink = b.cta_destination === 'link' && b.cta_link;
  return `
  <section class="block-email" id="signup" style="padding:72px 20px;background:${bg};text-align:center">
    <div class="signup-box">
      ${b.label ? `<div class="section-label">${b.label}</div>` : ''}
      ${b.title ? `<h2>${b.title}</h2>` : ''}
      ${b.subtitle ? `<p style="color:#64748b;margin:8px 0 24px;font-size:15px">${b.subtitle}</p>` : ''}
      ${isLink
        ? `<a href="${b.cta_link}" target="_blank" class="btn-submit" style="display:block;text-decoration:none;text-align:center">${b.cta_text||'Get Instant Access →'}</a>`
        : `<form id="signup-form">
        ${b.show_name !== false ? `<input type="text" id="sig-name" placeholder="${b.name_placeholder||'Your first name'}">` : ''}
        <input type="email" id="sig-email" placeholder="${b.email_placeholder||'Your email address'}" required>
        <button type="submit" class="btn-submit">${b.cta_text||'Get Instant Access →'}</button>
        <div class="success-msg" id="success-msg"></div>
      </form>`}
    </div>
  </section>`;
}

function renderTestimonials(b, testimonialData) {
  const limit = parseInt(b.limit) || 6;
  const items = testimonialData.slice(0, limit);
  if (!items.length) return `<section style="padding:48px 20px;text-align:center"><div class="container"><p style="color:#475569">Add testimonials in the Testimonials section of the admin to display them here.</p></div></section>`;
  const makeCard = t => {
    if (t.type === 'telegram' && t.telegram_url) {
      const tgPath = t.telegram_url.replace(/^https?:\/\/t\.me\//, '').replace(/^\//, '');
return `<div class="testimonial-card tg-card"><script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-post="${tgPath}" data-width="100%"><\/script></div>`;
    }
    return `<div class="testimonial-card">
      ${t.image_path ? `<img src="${t.image_path}" alt="${t.name}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;margin-bottom:12px">` : ''}
      <div style="font-size:13px;font-weight:600;color:#f1f5f9">${t.name}</div>
      <div style="font-size:12px;color:#7c3aed;margin-bottom:8px">${t.handle||''}</div>
      ${t.earnings ? `<div style="font-size:20px;font-weight:700;color:#22c55e;margin-bottom:8px">${t.earnings}</div>` : ''}
      <div style="font-size:13px;color:#94a3b8;line-height:1.5">${t.quote ? `"${t.quote}"` : ""}</div>
    </div>`;
  };
  const cardList = items.map(makeCard);
  // Duplicate for infinite carousel loop
  const carouselCards = [...cardList, ...cardList].join('');
  const blockId = 'car-' + Math.random().toString(36).slice(2, 8);
  return `
  <section class="block-testimonials" style="padding:72px 20px;background:rgba(124,58,237,.03)">
    <div class="container">
      <div style="text-align:center;margin-bottom:32px">
        ${b.label ? `<div class="section-label">${b.label}</div>` : ''}
        ${b.title ? `<h2 style="font-size:clamp(24px,4vw,36px);font-weight:700">${b.title}</h2>` : ''}
      </div>
      <div class="testimonials-carousel-wrap" id="wrap-${blockId}" style="position:relative;overflow:hidden;padding:0 40px">
        <button class="car-btn car-prev" onclick="carMove_${blockId}(-1)" style="position:absolute;top:50%;left:0;transform:translateY(-50%);background:rgba(18,18,31,0.85);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">&#8249;</button>
        <div style="overflow:hidden">
          <div class="carousel-track" id="track-${blockId}" style="display:flex;gap:12px;transition:transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94);align-items:flex-start">${carouselCards}</div>
        </div>
        <button class="car-btn car-next" onclick="carMove_${blockId}(1)" style="position:absolute;top:50%;right:0;transform:translateY(-50%);background:rgba(18,18,31,0.85);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">&#8250;</button>
      </div>
    </div>
  </section>
  <script>
  (function(){
    var track = document.getElementById('track-${blockId}');
    var wrap = document.getElementById('wrap-${blockId}');
    if (!track) return;
    var allCards = track.querySelectorAll('.testimonial-card');
    var total = ${items.length};
    var current = 0;
    var timer;
    function cardWidth() { return allCards[0] ? allCards[0].offsetWidth + 20 : 0; }
    function goTo(idx, animate) {
      track.style.transition = animate === false ? 'none' : 'transform 0.5s ease';
      track.style.transform = 'translateX(-' + (idx * cardWidth()) + 'px)';
    }
    track.addEventListener('transitionend', function() {
      if (current >= total) { current -= total; goTo(current, false); }
      if (current < 0) { current += total; goTo(current, false); }
    });
    function advance() { current++; goTo(current, true); }
    function startTimer() { timer = setInterval(advance, 3500); }
    function stopTimer() { clearInterval(timer); }
    startTimer();
    wrap.addEventListener('mouseenter', stopTimer);
    wrap.addEventListener('mouseleave', startTimer);
    window['carMove_${blockId}'] = function(dir) { stopTimer(); current += dir; goTo(current, true); startTimer(); };
  })();
  <\/script>`;
}

function renderFeatures(b) {
  const items = b.items || [];
  const cards = items.map(item => `
    <div style="background:#12121f;border:1px solid #1e1e30;border-radius:16px;padding:28px;text-align:center">
      ${item.icon ? `<div style="font-size:36px;margin-bottom:12px">${item.icon}</div>` : ''}
      <div style="font-weight:700;font-size:16px;color:#f1f5f9;margin-bottom:8px">${item.title||''}</div>
      <div style="font-size:14px;color:#64748b;line-height:1.6">${item.description||''}</div>
    </div>`).join('');
  const cols = b.columns || 3;
  return `
  <section class="block-features" style="padding:72px 20px">
    <div class="container">
      <div style="text-align:center;margin-bottom:40px">
        ${b.label ? `<div class="section-label">${b.label}</div>` : ''}
        ${b.title ? `<h2 style="font-size:clamp(24px,4vw,36px);font-weight:700;margin-bottom:12px">${b.title}</h2>` : ''}
        ${b.subtitle ? `<p style="color:#64748b;font-size:16px;max-width:600px;margin:0 auto">${b.subtitle}</p>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${cols===2?'300':'220'}px,1fr));gap:20px">${cards}</div>
    </div>
  </section>`;
}

function renderImageText(b) {
  const reverse = b.image_side === 'right';
  const imgHTML = b.image_url ? `<img src="${b.image_url}" alt="" style="width:100%;border-radius:16px;object-fit:cover">` : `<div style="background:#1a1a2e;border:2px dashed #2d2d4a;border-radius:16px;height:300px;display:flex;align-items:center;justify-content:center;color:#475569">Image placeholder</div>`;
  const textHTML = `
    ${b.label ? `<div class="section-label" style="margin-bottom:12px">${b.label}</div>` : ''}
    ${b.title ? `<h2 style="font-size:clamp(22px,3.5vw,36px);font-weight:700;margin-bottom:16px">${b.title}</h2>` : ''}
    ${b.body ? `<p style="color:#94a3b8;font-size:16px;line-height:1.7;margin-bottom:24px">${b.body}</p>` : ''}
    ${b.cta_text ? `<a href="${b.cta_destination === 'link' && b.cta_link ? b.cta_link : '#signup'}" class="btn-hero" style="font-size:16px;padding:14px 28px" ${b.cta_destination === 'link' && b.cta_link ? 'target="_blank"' : ''}>${b.cta_text}</a>` : ''}`;
  return `
  <section class="block-image-text" style="padding:72px 20px">
    <div class="container">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;${reverse?'direction:rtl':''}">
        <div style="${reverse?'direction:ltr':''}">${reverse ? textHTML : imgHTML}</div>
        <div style="${reverse?'direction:ltr':''}">${reverse ? imgHTML : textHTML}</div>
      </div>
    </div>
  </section>`;
}

function renderCalendarAdd(b) {
  const btnText = b.button_text || 'Add to Calendar';
  const calLinks = [
    { type: 'google',    label: '🗓 Google' },
    { type: 'apple',     label: '🍎 Apple' },
    { type: 'outlook',   label: '📧 Outlook' },
    { type: 'yahoo',     label: '📌 Yahoo' },
    { type: 'office365', label: '🏢 Office 365' },
    { type: 'ical',      label: '⬇️ iCal' },
  ];
  const uid = `cal_${Math.random().toString(36).slice(2, 7)}`;
  return `
  <section class="block-calendar" style="padding:64px 20px;text-align:center">
    <div class="container">
      ${b.label ? `<div class="section-label" style="margin-bottom:12px">${b.label}</div>` : ''}
      ${b.title ? `<h2 style="font-size:clamp(22px,3.5vw,32px);font-weight:700;margin-bottom:8px">${b.title}</h2>` : ''}
      ${b.subtitle ? `<p style="color:#94a3b8;margin-bottom:32px;font-size:16px">${b.subtitle}</p>` : ''}
      <div style="max-width:480px;margin:0 auto">
        <button id="${uid}-btn" onclick="(function(uid){var opts=document.getElementById(uid+'-opts');opts.style.display=opts.style.display==='flex'?'none':'flex';document.getElementById(uid+'-btn').textContent=opts.style.display==='flex'?'📅 Choose your calendar':'📅 ${btnText}'})('${uid}')" style="width:100%;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.5);color:#a78bfa;padding:18px 32px;border-radius:14px;font-size:18px;font-weight:700;cursor:pointer;transition:.2s">📅 ${btnText}</button>
        <div id="${uid}-opts" style="margin-top:12px;display:none;flex-wrap:wrap;gap:10px;justify-content:center">
          ${calLinks.map(o => `<a href="#" data-caltype="${o.type}" class="${uid}-link" target="_blank" style="display:inline-block;padding:12px 20px;background:#12121f;border:1px solid #1e1e30;border-radius:10px;color:#e2e8f0;text-decoration:none;font-size:14px;font-weight:500;min-width:130px;text-align:center">${o.label}</a>`).join('\n          ')}
        </div>
        <p style="color:#475569;font-size:13px;margin-top:8px">Google · Apple · Outlook · Yahoo · and more</p>
      </div>
    </div>
  </section>
  <script>
    (function(){
      fetch('/api/addcal/event').then(r=>r.json()).then(({event})=>{
        if(!event||!event.links) return;
        document.querySelectorAll('.${uid}-link').forEach(function(a){
          var type=a.dataset.caltype;
          var href=event.links[type]||(type==='ical'?event.links.other:null);
          if(href){a.href=href;}else{a.style.display='none';}
        });
      }).catch(function(){});
    })();
  </script>`;
}

function renderCTABanner(b) {
  const bg = b.bg_color || 'linear-gradient(135deg,#7c3aed,#06b6d4)';
  return `
  <section class="block-cta" style="padding:80px 20px;background:${bg};text-align:center">
    <div class="container">
      ${b.headline ? `<h2 style="font-size:clamp(28px,5vw,48px);font-weight:800;color:${b.text_color||'white'};margin-bottom:24px">${b.headline}</h2>` : ''}
      ${b.subheadline ? `<p style="color:${b.text_color||'rgba(255,255,255,0.8)'};font-size:18px;margin-bottom:32px">${b.subheadline}</p>` : ''}
      ${b.cta_text ? `<a href="${b.cta_destination === 'link' && b.cta_link ? b.cta_link : '#signup'}" style="display:inline-block;padding:18px 48px;background:white;color:#7c3aed;border-radius:12px;font-size:18px;font-weight:700;text-decoration:none" ${b.cta_destination === 'link' && b.cta_link ? 'target="_blank"' : ''}>${b.cta_text}</a>` : ''}
    </div>
  </section>`;
}

// ─── render full page from blocks ────────────────────────────────────────────

function renderPageFromBlocks(blocks, testimonialData = [], isPreview = false) {
  const bodyBlocks = (blocks || []).map(b => renderBlock(b, testimonialData)).join('\n');
  // Extract CTA text from first email_capture or hero block for the signup JS
  const emailBlock = (blocks || []).find(b => b.type === 'email_capture');
  const ctaText = emailBlock?.cta_text || 'Get Instant Access →';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MyFirstCreator.ai</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d0d14;color:#e2e8f0;min-height:100vh}
    .container{max-width:900px;margin:0 auto;padding:0 20px}
    .badge-pill{display:inline-block;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);color:#a78bfa;padding:6px 16px;border-radius:999px;font-size:13px;font-weight:600;margin-bottom:20px}
    .hero-headline{font-size:clamp(32px,6vw,56px);font-weight:800;line-height:1.1;margin-bottom:20px;background:linear-gradient(135deg,#fff 60%,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .hero-sub{font-size:clamp(16px,2.5vw,20px);color:#94a3b8;max-width:640px;margin:0 auto 32px;line-height:1.6}
    .btn-hero{display:inline-block;padding:18px 40px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;text-decoration:none;border-radius:12px;font-size:18px;font-weight:700;transition:.2s;box-shadow:0 0 40px rgba(124,58,237,.4)}
    .btn-hero:hover{transform:translateY(-2px);box-shadow:0 0 60px rgba(124,58,237,.6)}
    .trust-row{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-top:24px;font-size:14px;color:#64748b}
    .vsl-wrap{position:relative;padding-bottom:56.25%;height:0;border-radius:16px;overflow:hidden;box-shadow:0 0 60px rgba(124,58,237,.2)}
    .vsl-wrap iframe,.vsl-wrap video{position:absolute;top:0;left:0;width:100%;height:100%}
    .signup-box{background:#12121f;border:1px solid #1e1e30;border-radius:20px;padding:48px 32px;max-width:480px;margin:0 auto}
    .signup-box h2{font-size:28px;font-weight:700;margin-bottom:8px}
    input[type=text],input[type=email]{width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:14px 16px;border-radius:10px;font-size:15px;margin-bottom:12px;outline:none;font-family:inherit}
    input:focus{border-color:#7c3aed}
    .btn-submit{width:100%;padding:16px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;transition:.2s}
    .btn-submit:hover{opacity:.9}
    .section-label{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#7c3aed;font-weight:600}
    .testimonial-card{flex:0 0 calc(33.333% - 8px);background:#12121f;border:1px solid #1e1e30;border-radius:16px;padding:24px;text-align:center}
    .testimonial-card.tg-card{padding:8px;background:transparent;border:none}
    @media(max-width:768px){.testimonial-card{flex:0 0 100%}}
    @media(max-width:768px){.testimonial-card{flex:0 0 88%}}
    .success-msg{background:#064e3b;border:1px solid #065f46;color:#6ee7b7;padding:16px;border-radius:10px;margin-top:12px;display:none}
    .custom-block img{max-width:100%}
    @media(max-width:640px){
      .block-image-text .container>div{grid-template-columns:1fr!important}
    }
    ${isPreview ? '#preview-banner{position:fixed;top:0;left:0;right:0;background:#7c3aed;color:white;text-align:center;padding:8px;font-size:13px;z-index:9999}body{padding-top:36px}' : ''}
  </style>
</head>
<body>
  ${isPreview ? '<div id="preview-banner">⚠️ PREVIEW MODE — not live on the site</div>' : ''}
  ${bodyBlocks}
  <footer style="text-align:center;padding:32px;border-top:1px solid #1e1e30">
    <p style="color:#475569;font-size:13px">© 2025 MyFirstCreator.ai · <a href="#" style="color:#475569">Privacy Policy</a> · <a href="#" style="color:#475569">Terms</a></p>
  </footer>
  <script>
    const form = document.getElementById('signup-form');
    if(form) form.addEventListener('submit', async e => {
      e.preventDefault();
      ${isPreview ? 'alert("Preview mode — signups disabled"); return;' : ''}
      const btn = form.querySelector('.btn-submit');
      btn.textContent = 'One moment...'; btn.disabled = true;
      const nameEl = document.getElementById('sig-name');
      const res = await fetch('/api/signup', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name: nameEl?.value||'', email: document.getElementById('sig-email').value })
      });
      const data = await res.json();
      if (data.redirect) { window.location.href = data.redirect; return; }
      const msg = document.getElementById('success-msg');
      msg.textContent = data.message || "You're in!"; msg.style.display = 'block';
      btn.textContent = '${ctaText}'; btn.disabled = false;
    });
  </script>
</body>
</html>`;
}

function renderHowItWorks(b) {
  const title = b.title || 'HOW IT WORKS';
  const steps = b.steps || [];

  const cards = steps.map((step, idx) => {
    let mediaBg = '';
    if (step.media_type === 'video' && step.video) {
      mediaBg = `<video src="${step.video}" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.85"></video>`;
    } else if (step.image) {
      mediaBg = `<img src="${step.image}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.85" alt="">`;
    }
    const cardBg = (step.image || (step.media_type === 'video' && step.video)) ? '' : 'background:linear-gradient(135deg,#1a1a2e,#0d0d14);';
    const btnColor = step.color || '#ff3366';
    return `
    <div style="position:relative;border-radius:20px;overflow:hidden;min-height:380px;${cardBg}">
      ${mediaBg}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.3) 50%,transparent 100%)"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:24px">
        <div style="font-size:clamp(20px,2.5vw,26px);font-weight:900;color:white;text-transform:uppercase;line-height:1.1;margin-bottom:8px;padding-right:52px">${step.title || 'Step ' + (idx+1)}</div>
        ${step.description ? `<p style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.5;margin:0;padding-right:52px">${step.description}</p>` : ''}
      </div>
      <div style="position:absolute;bottom:24px;right:24px;width:42px;height:42px;border-radius:50%;background:${btnColor};display:flex;align-items:center;justify-content:center;font-size:18px;color:white;font-weight:700">→</div>
    </div>`;
  }).join('');

  return `
  <section style="padding:80px 20px;background:#080810">
    <div style="max-width:1200px;margin:0 auto">
      <h2 style="text-align:center;font-size:clamp(28px,5vw,48px);font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:white;margin-bottom:48px">${title}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">
        ${cards}
      </div>
    </div>
  </section>`;
}

function renderCreatorScroll(b) {
  const title = b.title || '';
  const subtitle = b.subtitle || '';
  const items = b.items || [];

  const cards = items.map(item => {
    const engagement = item.engagement || '';
    const icon = item.engagement_type === 'views' ? '▶' : '♥';
    const iconColor = item.engagement_type === 'views' ? '#fff' : '#ff3366';

    let media = '';
    if (item.media_type === 'video' && item.video) {
      media = `<video src="${item.video}" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`;
    } else if (item.image) {
      media = `<img src="${item.image}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" alt="">`;
    }

    return `
    <div style="flex:0 0 200px;position:relative;border-radius:16px;overflow:hidden;aspect-ratio:9/16;background:#111;snap-align:start">
      ${media}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 40%)"></div>
      ${engagement ? `
      <div style="position:absolute;bottom:14px;left:14px;display:flex;align-items:center;gap:5px">
        <span style="color:${iconColor};font-size:14px">${icon}</span>
        <span style="color:white;font-size:13px;font-weight:700">${engagement}</span>
      </div>` : ''}
    </div>`;
  }).join('');

  return `
  <section style="padding:60px 0;background:#080810;overflow:hidden">
    ${title || subtitle ? `<div style="padding:0 20px;margin-bottom:32px;text-align:center">
      ${title ? `<h2 style="font-size:clamp(24px,4vw,40px);font-weight:900;color:white;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${title}</h2>` : ''}
      ${subtitle ? `<p style="color:rgba(255,255,255,0.6);font-size:16px">${subtitle}</p>` : ''}
    </div>` : ''}
    <div style="display:flex;gap:16px;overflow-x:auto;padding:0 20px 16px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      ${cards}
    </div>
  </section>`;
}

module.exports = { renderBlock, renderPageFromBlocks, BLOCK_TYPES };
