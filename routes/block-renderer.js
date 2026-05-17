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
  { type: 'video_testimonials', label: '🎬 Video Testimonials' },
  { type: 'marketplace_creators', label: '🤖 AI Creators Grid' },
  { type: 'marketplace_categories', label: '🗂 Category Browser' },
  { type: 'marketplace_lead', label: '🎯 Marketplace Lead Form' },
];
module.exports.BLOCK_TYPES = BLOCK_TYPES;

const MP_BLOCK_TYPES = [
  { type: 'mp_header',        label: '🔝 Header / Nav' },
  { type: 'mp_hero',          label: '🎯 Hero / Main CTA' },
  { type: 'mp_creator_scroll',label: '🎬 Creator Showcase Scroll' },
  { type: 'mp_how_it_works',  label: '📋 How It Works (3 Cards)' },
  { type: 'mp_feature',       label: '⚡️ Feature Card' },
  { type: 'mp_community',     label: '💬 Community Section' },
  { type: 'mp_pricing',       label: '💰 Pricing (Create.Post.Profit)' },
  { type: 'mp_final_cta',     label: '🚀 Start Your Trial CTA' },
  { type: 'mp_footer',        label: '🔻 Footer' },
];
module.exports.MP_BLOCK_TYPES = MP_BLOCK_TYPES;

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
    case 'video_testimonials': return renderVideoTestimonials(block, testimonialData);
    case 'marketplace_creators': return renderMarketplaceCreators(block);
    case 'marketplace_categories': return renderMarketplaceCategories(block);
    case 'marketplace_lead': return renderMarketplaceLead(block);
    // Marketplace blocks
    case 'mp_mode': return ''; // sentinel — renders nothing
    case 'mp_header': return renderMpHeader(block);
    case 'mp_hero': return renderMpHero(block);
    case 'mp_creator_scroll': return renderMpCreatorScroll(block);
    case 'mp_how_it_works': return renderMpHowItWorks(block);
    case 'mp_feature': return renderMpFeature(block);
    case 'mp_community': return renderMpCommunity(block);
    case 'mp_pricing': return renderMpPricing(block);
    case 'mp_final_cta': return renderMpFinalCta(block);
    case 'mp_footer': return renderMpFooter(block);
    default: return '';
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
  const isFile = !!b.vsl_file;
  const src = b.vsl_file || b.vsl_url;
  const uid = 'vsl_' + Math.random().toString(36).slice(2, 8);
  const isYouTube = !isFile && /youtube\.com\/embed\//.test(src);
  const ytVideoId = isYouTube ? (src.match(/youtube\.com\/embed\/([^?&]+)/) || [])[1] : null;

  let mediaHTML, scriptHTML;

  if (isFile) {
    mediaHTML = `<div class="vsl-wrap" id="wrap-${uid}"><video id="${uid}" src="${src}" controls preload="metadata" playsinline></video></div>`;
    scriptHTML = `<script>(function(){
  var v=document.getElementById('${uid}');if(!v)return;
  v.addEventListener('loadedmetadata',function(){v.currentTime=0.001;});
  setTimeout(function(){
    v.muted=true;
    v.play().then(function(){
      v.muted=false;v.volume=1;
      setTimeout(function(){
        if(v.muted){
          var wrap=document.getElementById('wrap-${uid}');
          var btn=document.createElement('button');
          btn.textContent='🔊 Tap to Unmute';
          btn.style.cssText='position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;border:2px solid #fff;border-radius:999px;padding:10px 22px;font-size:15px;font-weight:700;cursor:pointer;z-index:20;white-space:nowrap';
          btn.onclick=function(){v.muted=false;v.volume=1;btn.remove();};
          wrap.appendChild(btn);
        }
      },300);
    }).catch(function(){});
  },2000);
})();<\/script>`;
  } else if (isYouTube && ytVideoId) {
    mediaHTML = `<div class="vsl-wrap" id="wrap-${uid}"><div id="${uid}"></div></div>`;
    scriptHTML = `<script>(function(){
  function initPlayer(){
    new YT.Player('${uid}',{
      videoId:'${ytVideoId}',
      playerVars:{rel:0,modestbranding:1,autoplay:1,mute:1,playsinline:1},
      events:{onReady:function(e){
        setTimeout(function(){
          e.target.unMute();e.target.setVolume(100);
          setTimeout(function(){
            if(e.target.isMuted()){
              var wrap=document.getElementById('wrap-${uid}');
              var btn=document.createElement('button');
              btn.textContent='🔊 Tap to Unmute';
              btn.style.cssText='position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;border:2px solid #fff;border-radius:999px;padding:10px 22px;font-size:15px;font-weight:700;cursor:pointer;z-index:20;white-space:nowrap';
              btn.onclick=function(){e.target.unMute();e.target.setVolume(100);btn.remove();};
              wrap.appendChild(btn);
            }
          },400);
        },2000);
      }}
    });
  }
  if(window.YT&&window.YT.Player){initPlayer();}
  else{
    var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
    var prev=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=function(){if(prev)prev();initPlayer();};
  }
})();<\/script>`;
  } else {
    const embedSrc = src + (src.includes('?') ? '&' : '?') + 'autoplay=1';
    mediaHTML = `<div class="vsl-wrap"><iframe src="${embedSrc}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>`;
    scriptHTML = '';
  }

  return `
  <section class="block-vsl" style="padding:48px 0;background:rgba(124,58,237,.04);border-top:1px solid #1e1e30;border-bottom:1px solid #1e1e30">
    <style>.vsl-wrap{position:relative;padding-bottom:56.25%;height:0;border-radius:16px;overflow:hidden;box-shadow:0 0 60px rgba(124,58,237,.2)}.vsl-wrap iframe,.vsl-wrap video{position:absolute;top:0;left:0;width:100%;height:100%;border:none}.vsl-wrap>div{position:absolute;top:0;left:0;width:100%;height:100%}@media(max-width:768px){.block-vsl{padding:0}.vsl-wrap{border-radius:0;box-shadow:none}}</style>
    <div class="container" style="padding:0 20px">
      ${b.caption ? `<p style="text-align:center;color:#94a3b8;margin-bottom:20px;font-size:15px">${b.caption}</p>` : ''}
      ${mediaHTML}
    </div>
  </section>
  ${scriptHTML}`;
}

function renderEmailCapture(b) {
  const bg = b.bg_color || 'transparent';
  const isLink = b.cta_destination === 'link';
  const linkHref = b.cta_link || '#signup';
  return `
  <section class="block-email" id="signup" style="padding:72px 20px;background:${bg};text-align:center">
    <div class="signup-box">
      ${b.label ? `<div class="section-label">${b.label}</div>` : ''}
      ${b.title ? `<h2>${b.title}</h2>` : ''}
      ${!isLink && b.subtitle ? `<p style="color:#64748b;margin:8px 0 24px;font-size:15px">${b.subtitle}</p>` : ''}
      ${isLink
        ? `<a href="${linkHref}" ${b.cta_link ? 'target="_blank"' : ''} class="btn-submit" style="display:block;text-decoration:none;text-align:center">${b.cta_text||'Get Instant Access →'}</a>`
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
      <div class="testimonials-carousel-wrap" id="wrap-${blockId}">
        <button class="car-btn car-prev" onclick="carMove_${blockId}(-1)">&#8249;</button>
        <div class="carousel-viewport">
          <div class="carousel-track" id="track-${blockId}" style="display:flex;gap:12px;transition:transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94);align-items:flex-start">${carouselCards}</div>
        </div>
        <button class="car-btn car-next" onclick="carMove_${blockId}(1)">&#8250;</button>
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
    function cardWidth() {
      if (!allCards[0]) return 0;
      var gap = parseFloat(window.getComputedStyle(track).gap) || 12;
      return allCards[0].getBoundingClientRect().width + gap;
    }
    function goTo(idx, animate) {
      track.style.transition = animate === false ? 'none' : 'transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)';
      track.style.transform = 'translateX(-' + (idx * cardWidth()) + 'px)';
    }
    track.addEventListener('transitionend', function() {
      if (current >= total) { current -= total; goTo(current, false); }
      if (current < 0) { current += total; goTo(current, false); }
    });
    function advance() { current++; goTo(current, true); }
    function startTimer() { timer = setInterval(advance, 3500); }
    function stopTimer() { clearInterval(timer); }
    function initCarousel() {
      var cw = cardWidth();
      if (cw === 0) { requestAnimationFrame(initCarousel); return; }
      goTo(0, false);
      startTimer();
    }
    wrap.addEventListener('mouseenter', stopTimer);
    wrap.addEventListener('mouseleave', startTimer);
    window.addEventListener('resize', function() { clearInterval(timer); goTo(current, false); startTimer(); });
    window['carMove_${blockId}'] = function(dir) { stopTimer(); current += dir; goTo(current, true); startTimer(); };
    requestAnimationFrame(initCarousel);
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

function trackingScript(sid) {
  return `<script>
(function(){
  var sid='${sid}';
  var slug=(document.cookie.match(/mfc_ref=([^;]+)/)||[])[1]||null;
  var vid=(document.cookie.match(/mfc_variant=([^;]+)/)||[])[1]||null;
  var t0=Date.now();
  function bn(url,d){try{navigator.sendBeacon(url,JSON.stringify(d));}catch(e){}}
  function time(){var s=Math.round((Date.now()-t0)/1000);if(s>=2)bn('/api/track/time',{sid:sid,secs:s});}
  function ev(type,el,val){bn('/api/track/event',{sid:sid,slug:slug,variantId:vid,type:type,element:el,value:String(val||'').slice(0,100)});}
  document.addEventListener('visibilitychange',function(){if(document.hidden)time();});
  window.addEventListener('beforeunload',time);
  document.addEventListener('click',function(e){
    var t=e.target.closest('.btn-submit,.btn-hero,[data-track]');
    if(!t)return;
    var el=t.dataset&&t.dataset.track?t.dataset.track:(t.classList.contains('btn-submit')?'cta_submit':t.classList.contains('btn-hero')?'cta_hero':'cta');
    ev('click',el,(t.href||t.innerText||'').trim().slice(0,80));
  },true);
  document.addEventListener('submit',function(e){
    if(e.target.querySelector('[type=email]'))ev('form_submit','email_form','');
  },true);
  function tv(v){
    var ms=[10,25,50,75,90],reached=[];
    v.addEventListener('play',function(){ev('video','video_play','0');});
    v.addEventListener('timeupdate',function(){
      if(!v.duration)return;
      var pct=v.currentTime/v.duration*100;
      ms.forEach(function(m){if(pct>=m&&reached.indexOf(m)===-1){reached.push(m);ev('video','video_progress',String(m));}});
    });
    v.addEventListener('ended',function(){ev('video','video_end','100');});
  }
  document.querySelectorAll('video').forEach(tv);
  document.querySelectorAll('.vsl-wrap iframe,.vsl-section iframe').forEach(function(f){
    f.parentElement.addEventListener('click',function(){ev('video','video_iframe_click',(f.src||'').slice(0,100));},true);
  });
})();
<\/script>`;
}

function renderPageFromBlocks(blocks, testimonialData = [], isPreview = false, visitSid = null) {
  const isMarketplace = (blocks || []).some(b => b.type === 'mp_mode' || (b.type && b.type.startsWith('mp_')));
  const bodyBlocks = (blocks || []).filter(b => b.type !== 'mp_mode').map(b => renderBlock(b, testimonialData)).join('\n');
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
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${isMarketplace ? '#0a0a0a' : '#0d0d14'};color:${isMarketplace ? '#ffffff' : '#e2e8f0'};min-height:100vh;overflow-x:hidden}
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
    .testimonials-carousel-wrap{position:relative;padding:0 44px}
    .carousel-viewport{overflow:hidden;width:100%}
    .car-btn{position:absolute;top:50%;transform:translateY(-50%);background:rgba(18,18,31,0.85);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
    .car-prev{left:0}.car-next{right:0}
    .testimonial-card{flex:0 0 calc(33.333% - 8px);background:#12121f;border:1px solid #1e1e30;border-radius:16px;padding:24px;text-align:center}
    .testimonial-card.tg-card{padding:8px;background:transparent;border:none}
    @media(max-width:768px){.testimonials-carousel-wrap{padding:0}.testimonial-card{flex:0 0 100%}.car-btn{display:none}.carousel-track{gap:0}}
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
  ${!isPreview && visitSid ? trackingScript(visitSid) : ''}
</body>
</html>`;
}

// ─── Marketplace block renderers ─────────────────────────────────────────────────────

function renderMpHeader(b) {
  const logoText = b.logo_text || 'AI Creator Marketplace';
  const ctaText = b.cta_text || 'Get Started Free';
  const ctaUrl = b.cta_url || '#';
  const navLinks = b.nav_links || [
    { label: 'How It Works', href: '#how' },
    { label: 'Browse Creators', href: '#creators' },
    { label: 'Community', href: '#community' },
    { label: 'Pricing', href: '#pricing' },
  ];
  return `
  <nav style="position:sticky;top:0;z-index:100;background:rgba(10,10,10,.92);backdrop-filter:blur(12px);border-bottom:1px solid #1f1f1f;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between">
    <a href="/" style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;color:#fff;text-decoration:none">
      <div style="width:32px;height:32px;background:#ff3366;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px">🤖</div>
      ${logoText}
    </a>
    <ul style="display:flex;gap:28px;list-style:none;margin:0;padding:0">
      ${navLinks.map(l => `<li><a href="${l.href}" style="color:#9ca3af;text-decoration:none;font-size:14px;font-weight:500">${l.label}</a></li>`).join('')}
    </ul>
    <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:#ff3366;color:#fff;padding:10px 22px;border-radius:50px;font-size:14px;font-weight:700;text-decoration:none">${ctaText}</a>
  </nav>`;
}

function renderMpHero(b) {
  const h1 = b.headline1 || 'Build and Scale Your';
  const h2 = b.headline2 || 'AI Creator Income';
  const h3 = b.headline3 || 'Starting Today';
  const sub = b.subheadline || 'Browse thousands of AI creators, claim your affiliate link, and start earning commissions — all without creating content yourself.';
  const ctaText = b.cta_text || 'Get Started For Free';
  const ctaUrl = b.cta_url || '#';
  const proof = b.social_proof || 'Join 50,000+ successful affiliates';
  return `
  <section style="padding:80px 40px 72px;text-align:center">
    <div style="max-width:900px;margin:0 auto">
      <h1 style="font-size:clamp(44px,7vw,80px);font-weight:900;line-height:1.05;letter-spacing:-2px;margin-bottom:24px">
        ${h1}<br><span style="color:#ff3366">${h2}</span><br>${h3}
      </h1>
      <p style="color:#9ca3af;font-size:clamp(15px,2vw,18px);line-height:1.7;max-width:580px;margin:0 auto 40px">${sub}</p>
      <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:#ff3366;color:#fff;padding:18px 48px;border-radius:50px;font-size:18px;font-weight:700;text-decoration:none">${ctaText} →</a>
      <div style="margin-top:12px;color:#6b7280;font-size:13px">${proof}</div>
    </div>
  </section>`;
}

function renderMpCreatorScroll(b) {
  const items = b.items || [];
  const cards = items.length ? items.map(item => {
    const icon = item.engagement_type === 'views' ? '▶️' : '♥️';
    const iconColor = item.engagement_type === 'views' ? '#fff' : '#ff3366';
    let media = '';
    if (item.media_type === 'video' && item.video) {
      media = `<video src="${item.video}" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`;
    } else if (item.image) {
      media = `<img src="${item.image}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" alt="">`;
    } else {
      media = `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#1a0a0f,#0a1a0a);display:flex;align-items:center;justify-content:center;font-size:56px">${item.emoji || '🤖'}</div>`;
    }
    return `
    <div style="flex:0 0 200px;position:relative;border-radius:16px;overflow:hidden;aspect-ratio:9/16;background:#141414">
      ${media}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 40%)"></div>
      ${item.engagement ? `<div style="position:absolute;bottom:14px;left:14px;display:flex;gap:6px;flex-wrap:wrap">
        ${item.earnings ? `<span style="background:rgba(0,0,0,.6);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;color:#fff;display:inline-flex;align-items:center;gap:4px"><span style="color:#22c55e">💰</span> ${item.earnings}</span>` : ''}
        <span style="background:rgba(0,0,0,.6);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;color:#fff;display:inline-flex;align-items:center;gap:4px"><span style="color:${iconColor}">${icon}</span> ${item.engagement}</span>
      </div>` : ''}
    </div>`;
  }).join('') : [['#1a0a0f','💃','2.1M','$12.4K'],['#0a0f1a','🤖','780K','$5.8K'],['#1a0a1a','👑','1.2M','$8.1K'],['#0f1a0a','🎭','340K','$3.2K'],['#1a1a0a','🔥','920K','$15.3K'],['#0a1a1a','💎','1.8M','$21.7K']].map(([bg,emoji,lk,earn]) => `
    <div style="flex:0 0 200px;position:relative;border-radius:16px;overflow:hidden;aspect-ratio:9/16;background:#141414">
      <div style="position:absolute;inset:0;background:${bg};display:flex;align-items:center;justify-content:center;font-size:56px">${emoji}</div>
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 40%)"></div>
      <div style="position:absolute;bottom:14px;left:14px;display:flex;gap:6px">
        <span style="background:rgba(0,0,0,.6);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;color:#fff"><span style="color:#22c55e">💰</span> ${earn}</span>
        <span style="background:rgba(0,0,0,.6);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;color:#fff"><span style="color:#ff3366">♥️</span> ${lk}</span>
      </div>
    </div>`).join('');
  return `
  <section style="padding:0 0 80px;overflow:hidden">
    <div style="display:flex;gap:12px;padding:0 40px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">
      ${cards}
    </div>
  </section>`;
}

function renderMpHowItWorks(b) {
  const title = b.title || 'HOW IT WORKS';
  const cards = [
    { title: b.card1_title || 'BROWSE YOUR CREATOR', text: b.card1_text || 'Explore thousands of AI-powered creators across every niche. Pick one that matches your audience — no experience required.', color: b.card1_color || '#ff3366', mockup: 'browse' },
    { title: b.card2_title || 'SHARE YOUR LINK', text: b.card2_text || 'Get your unique affiliate link instantly. Post it on TikTok, Instagram, X, YouTube, or email — anywhere your audience lives.', color: b.card2_color || '#ff3366', mockup: 'share' },
    { title: b.card3_title || 'GET PAID', text: b.card3_text || 'Earn commissions on every signup and sale your links generate. Paid weekly — directly to your bank or PayPal.', color: b.card3_color || '#22c55e', mockup: 'paid' },
  ];
  const mockupFor = (type, color) => {
    if (type === 'browse') return `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
      ${['\ud83d\udc69\u200d\ud83e\uddb0','\ud83d\udc71\u200d\u2640\ufe0f','\ud83d\udc69','\ud83d\udc69\u200d\ud83e\uddb3','\ud83d\udc69\u200d\ud83e\uddb1'].map(e => `<div style="width:48px;height:48px;background:#1a1a1a;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;border:2px solid #2a2a2a">${e}</div>`).join('')}
      <div style="width:100%;height:32px;background:${color};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;margin-top:8px">Choose a Creator</div>
    </div>`;
    if (type === 'share') return `<div style="display:flex;gap:12px;align-items:flex-end">
      ${['📱','🎯','🔗'].map((e,i) => `<div style="width:56px;height:96px;background:#141414;border-radius:12px;border:2px solid #1f1f1f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:${i===1?'28px':'22px'};transform:${i===0?'rotate(-8deg)':i===2?'rotate(8deg)':'scale(1.1)'}">${e}</div>`).join('')}
    </div>`;
    return `<div style="background:#0d1a0d;border:1px solid #1a2e1a;border-radius:12px;padding:14px 16px;min-width:220px">
      <div style="font-size:24px;font-weight:900;color:#22c55e;margin-bottom:8px">$21,704.23</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${[['$2,113','Referrals'],['$731','Tips'],['$5,300','Bonuses'],['$13,560','Commissions']].map(([v,l])=>`<div style="background:#0a1a0a;border-radius:6px;padding:8px"><div style="font-size:13px;font-weight:700;color:#22c55e">${v}</div><div style="font-size:10px;color:#6b7280">${l}</div></div>`).join('')}
      </div>
    </div>`;
  };
  return `
  <section style="padding:80px 40px;background:#080810" id="how">
    <h2 style="text-align:center;font-size:clamp(28px,5vw,48px);font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:white;margin-bottom:48px">${title}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;max-width:1100px;margin:0 auto">
      ${cards.map(c => `
      <div style="background:#141414;border:1px solid #1f1f1f;border-radius:20px;overflow:hidden;display:flex;flex-direction:column">
        <div style="padding:32px 24px 16px;background:#0f0f0f;display:flex;align-items:center;justify-content:center;min-height:180px">${mockupFor(c.mockup, c.color)}</div>
        <div style="padding:24px 24px 28px;display:flex;flex-direction:column;flex:1">
          <div style="width:40px;height:40px;border-radius:50%;background:${c.color};display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:700;margin-bottom:14px">→</div>
          <div style="font-size:clamp(18px,2.5vw,24px);font-weight:900;letter-spacing:-0.5px;margin-bottom:10px;line-height:1.1">${c.title}</div>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">${c.text}</p>
        </div>
      </div>`).join('')}
    </div>
  </section>`;
}

function renderMpFeature(b) {
  const badge = b.badge || 'FEATURE';
  const title = b.title || 'Feature Title';
  const text = b.text || 'Feature description goes here.';
  const text2 = b.text2 || '';
  const ctaText = b.cta_text || 'Learn More →';
  const ctaUrl = b.cta_url || '#';
  const imgSide = b.image_side || 'left';
  const glow = b.glow !== false;
  const pinkTitle = b.pink_title !== false;
  const glowStyle = glow ? 'border-color:rgba(255,51,102,.35);box-shadow:0 0 60px rgba(255,51,102,.08)' : '';
  const imgBlock = `
    <div style="background:#0f0f0f;display:flex;align-items:center;justify-content:center;padding:32px;min-height:320px;overflow:hidden">
      ${b.image_url
        ? `<img src="${b.image_url}" style="max-width:100%;border-radius:12px;object-fit:cover" alt="">`
        : `<div style="background:#141414;border:1px solid #1f1f1f;border-radius:16px;padding:24px;text-align:center;min-width:200px"><div style="font-size:48px;margin-bottom:12px">🤖</div><div style="color:#475569;font-size:12px">Add an image URL in the block settings</div></div>`}
    </div>`;
  const textBlock = `
    <div style="padding:48px 40px;display:flex;flex-direction:column;gap:16px">
      <span style="display:inline-block;background:rgba(255,51,102,.12);border:1px solid rgba(255,51,102,.3);color:#ff3366;border-radius:20px;padding:5px 14px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;align-self:flex-start">${badge}</span>
      <div style="font-size:clamp(22px,3vw,36px);font-weight:900;line-height:1.1;letter-spacing:-1px">${pinkTitle ? `<span style="color:#ff3366">${title}</span>` : title}</div>
      <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0">${text}</p>
      ${text2 ? `<p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0">${text2}</p>` : ''}
      <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:#ff3366;color:#fff;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:700;text-decoration:none;align-self:flex-start">${ctaText}</a>
    </div>`;
  return `
  <section style="padding:0 40px 16px">
    <div style="background:#141414;border:1px solid #1f1f1f;border-radius:20px;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;${glowStyle}">
      ${imgSide === 'left' ? imgBlock + textBlock : textBlock + imgBlock}
    </div>
  </section>`;
}

function renderMpCommunity(b) {
  const h1 = b.headline1 || "Don't Build Alone.";
  const h2 = b.headline2 || 'Join the Inner Circle.';
  const text = b.text || "Connect with top affiliate earners, share what's working, and get exclusive strategies from our private creator community.";
  const ctaTxt = b.cta_text || 'Join the Discord →';
  const ctaUrl = b.cta_url || '#';
  return `
  <section style="padding:0 40px 80px">
    <div style="background:#161616;border:1px solid #1f1f1f;border-radius:20px;display:grid;grid-template-columns:1fr 1fr;align-items:center;overflow:hidden">
      <div style="padding:56px 48px;display:flex;flex-direction:column;gap:20px">
        <div>
          <div style="font-size:clamp(28px,4vw,48px);font-weight:900;line-height:1.05;letter-spacing:-1px">${h1}</div>
          <div style="font-size:clamp(28px,4vw,48px);font-weight:900;line-height:1.05;letter-spacing:-1px;color:#ff3366">${h2}</div>
        </div>
        <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0">${text}</p>
        <a href="${ctaUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:transparent;color:#fff;padding:14px 28px;border-radius:50px;font-size:16px;font-weight:600;text-decoration:none;border:2px solid #5865f2;align-self:flex-start">${ctaTxt}</a>
      </div>
      <div style="background:#313338;height:100%;min-height:360px;display:flex;overflow:hidden">
        <div style="width:180px;background:#2b2d31;padding:16px 0;flex-shrink:0">
          <div style="width:40px;height:40px;border-radius:50%;background:#ff3366;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto 16px">🤖</div>
          ${['# start-here','# affiliates','# wins','# strategies','# creator-tips','# scaling'].map((c,i) => `<div style="padding:4px 8px 4px 14px;font-size:12px;color:${i===0?'#dbdee1':'#949ba4'};border-radius:4px;margin:2px 6px;${i===0?'background:#404249':''}">${c}</div>`).join('')}
        </div>
        <div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
          <div style="font-size:13px;font-weight:700;color:#f2f3f5;border-bottom:1px solid #3f4147;padding-bottom:10px"># start-here</div>
          <div style="display:flex;gap:10px">
            <div style="width:32px;height:32px;border-radius:50%;background:#5865f2;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px">😎</div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#f2f3f5;margin-bottom:2px">Alex_Affiliate <span style="font-size:10px;color:#949ba4;font-weight:400">Today at 9:41 AM</span></div>
              <div style="font-size:12px;color:#dbdee1;line-height:1.4">Just hit my first $5k month! 🚀</div>
              <div style="background:#1e1f22;border-radius:8px;padding:10px;margin-top:6px;border-left:3px solid #ff3366">
                <div style="font-size:18px;font-weight:900;color:#22c55e">$5,247.00</div>
                <div style="font-size:10px;color:#949ba4;margin-top:2px">Monthly earnings</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderMpPricing(b) {
  const headline = b.headline || 'Create. Post. Profit.';
  const sub = b.subheadline || 'Join the platform that pays affiliates every week';
  const plans = b.plans && b.plans.length ? b.plans : [
    { name: 'Starter Affiliate', price: 'Free',   per: 'forever', featured: false, features: ['Browse all creators', 'Get your affiliate link', 'Basic analytics', 'Email support'] },
    { name: 'Pro Affiliate',     price: '$29',    per: 'mo',      featured: true,  features: ['Everything in Starter', 'Advanced analytics', 'Priority creator access', 'Weekly payout', 'Account manager'] },
    { name: 'Agency',            price: '$79',    per: 'mo',      featured: false, features: ['Everything in Pro', 'Manage 5 sub-affiliates', 'White-label dashboard', 'API access'] },
    { name: 'Enterprise',        price: 'Custom', per: '',        featured: false, features: ['Everything in Agency', 'Unlimited sub-affiliates', 'Custom integrations', 'SLA guarantee'] },
  ];
  const ctaUrl = b.cta_url || '#';
  const pricingCards = plans.map((plan, i) => {
    const isFeat = plan.featured || i === 1;
    const price = plan.price || 'Free';
    const per = plan.per || '';
    return `
    <div style="background:#141414;border:1px solid ${isFeat ? 'rgba(255,51,102,.5)' : '#1f1f1f'};border-radius:20px;padding:28px 24px;display:flex;flex-direction:column;gap:20px;position:relative;${isFeat ? 'box-shadow:0 0 60px rgba(255,51,102,.1)' : ''}">
      ${isFeat ? `<div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:#ff3366;color:#fff;padding:6px 18px;border-radius:50px;font-size:12px;font-weight:800;white-space:nowrap">Most Popular</div>` : ''}
      <div style="font-size:18px;font-weight:700">${plan.name}</div>
      <div style="display:flex;align-items:baseline;gap:4px;font-weight:900">
        ${price === 'Free' || price === 'Custom'
          ? `<span style="font-size:36px">${price}</span>`
          : `<span style="font-size:48px">${price}</span><span style="font-size:16px;color:#6b7280">/${per}</span>`}
      </div>
      <ul style="list-style:none;display:flex;flex-direction:column;gap:12px;flex:1;padding:0;margin:0">
        ${(plan.features || []).map(f => `<li style="display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#9ca3af"><span style="color:#ff3366;font-weight:900;flex-shrink:0">✓</span>${f}</li>`).join('')}
      </ul>
      <a href="${ctaUrl}" target="_blank" style="width:100%;display:block;text-align:center;padding:14px;border-radius:50px;font-size:15px;font-weight:700;text-decoration:none;${isFeat ? 'background:#ff3366;color:#fff' : 'background:#1f1f1f;color:#fff'}">Try It Free</a>
    </div>`;
  }).join('');
  return `
  <section style="padding:80px 40px;text-align:center" id="pricing">
    <h2 style="font-size:clamp(32px,5vw,56px);font-weight:900;letter-spacing:-1px;margin-bottom:16px">${headline}</h2>
    <p style="color:#9ca3af;font-size:16px;margin-bottom:48px">${sub}</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:start;max-width:1100px;margin:0 auto">
      ${pricingCards}
    </div>
  </section>`;
}

function renderMpFinalCta(b) {
  const headline = b.headline || 'Start Your AI Creator\nIncome Journey Today';
  const sub = b.subheadline || 'Join 50,000+ affiliates already earning commissions every week';
  const ctaText = b.cta_text || 'Start Your Free Trial';
  const ctaUrl = b.cta_url || '#';
  const trustText = b.trust_text || 'No credit card required • Cancel anytime';
  return `
  <section style="padding:100px 40px;text-align:center;border-top:1px solid #1f1f1f">
    <h2 style="font-size:clamp(32px,5vw,60px);font-weight:900;letter-spacing:-2px;margin-bottom:16px;line-height:1.1">${headline.replace(/\n/g, '<br>')}</h2>
    <p style="color:#9ca3af;font-size:16px;margin-bottom:36px">${sub}</p>
    <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:#ff3366;color:#fff;padding:20px 52px;border-radius:50px;font-size:20px;font-weight:700;text-decoration:none">${ctaText}</a>
    <p style="color:#4b5563;font-size:13px;margin-top:16px">${trustText}</p>
  </section>`;
}

function renderMpFooter(b) {
  const logoText = b.logo_text || 'AI Creator Marketplace';
  const tagline = b.tagline || 'Build and Scale Your AI Creator Income';
  const ctaUrl = b.cta_url || '#';
  return `
  <footer style="border-top:1px solid #1f1f1f;padding:56px 40px 32px;display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:40px">
    <div>
      <div style="display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;color:#fff;margin-bottom:12px">
        <div style="width:28px;height:28px;background:#ff3366;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px">🤖</div>
        ${logoText}
      </div>
      <p style="color:#9ca3af;font-size:14px;font-weight:600;margin:0">${tagline}</p>
    </div>
    <div>
      <div style="font-size:14px;font-weight:700;margin-bottom:16px">Platform</div>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        ${[['Features','/features'],['Pricing','/pricing'],['Browse Creators','/creators'],['Community','/community']].map(([l,h])=>`<li><a href="${ctaUrl}${h}" target="_blank" style="color:#9ca3af;text-decoration:none;font-size:14px">${l}</a></li>`).join('')}
      </ul>
    </div>
    <div>
      <div style="font-size:14px;font-weight:700;margin-bottom:16px">Legal</div>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        ${[['Terms of Use','/terms'],['Privacy Policy','/privacy'],['Affiliate Program','/affiliates']].map(([l,h])=>`<li><a href="${ctaUrl}${h}" target="_blank" style="color:#9ca3af;text-decoration:none;font-size:14px">${l}</a></li>`).join('')}
      </ul>
    </div>
  </footer>
  <div style="border-top:1px solid #1f1f1f;padding:20px 40px;text-align:center;color:#374151;font-size:12px">
    <p>© ${new Date().getFullYear()} AI Creator Marketplace · All rights reserved</p>
  </div>`;
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

function renderMarketplaceCreators(b) {
  const uid = 'mc_' + Math.random().toString(36).slice(2, 8);
  const limit = parseInt(b.limit) || 12;
  const mktUrl = b.marketplace_url || 'https://aicreatormarketplace.com';
  const skeletons = Array(6).fill('<div style="background:#12121f;border-radius:16px;aspect-ratio:3/4;animation:mfc-pulse 1.5s ease-in-out infinite"></div>').join('');

  return `
<section style="padding:72px 20px;background:#0d0d14">
  <style>
    @keyframes mfc-pulse{0%,100%{opacity:.4}50%{opacity:.8}}
    .mc-card{background:#12121f;border:1px solid #1e1e30;border-radius:16px;overflow:hidden;text-decoration:none;display:block;transition:.2s}
    .mc-card:hover{border-color:rgba(124,58,237,.5);transform:translateY(-3px)}
    .mc-card img,.mc-img-ph{width:100%;aspect-ratio:3/4;object-fit:cover;display:block;background:#1a1a2e}
    .mc-img-ph{display:flex;align-items:center;justify-content:center;font-size:56px}
    .mc-info{padding:14px}
    .mc-name{font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:6px}
    .mc-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;margin:2px}
  </style>
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:40px">
      ${b.label ? `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#7c3aed;margin-bottom:12px">${b.label}</div>` : ''}
      <h2 style="font-size:clamp(26px,4vw,42px);font-weight:800;color:#f1f5f9;margin-bottom:12px">${b.title || 'Browse AI Creators'}</h2>
      ${b.subtitle ? `<p style="color:#94a3b8;font-size:17px;max-width:600px;margin:0 auto">${b.subtitle}</p>` : ''}
    </div>
    <div id="cats-${uid}" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:32px"></div>
    <div id="grid-${uid}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:20px">${skeletons}</div>
    <div style="text-align:center;margin-top:36px">
      <button id="more-${uid}" style="display:none;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.4);color:#a78bfa;padding:13px 32px;border-radius:999px;font-size:15px;font-weight:700;cursor:pointer" onclick="mcLoadMore_${uid}()">Load More</button>
    </div>
    ${b.cta_text ? `<div style="text-align:center;margin-top:48px"><a href="${b.cta_link || mktUrl}" target="_blank" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700">${b.cta_text}</a></div>` : ''}
  </div>
</section>
<script>
(function(){
  var page=1, activeCat=null;
  var mktUrl='${mktUrl}';

  function chipHTML(id, label, active) {
    return '<button onclick="mcFilter_${uid}(\''+id+'\',this)" style="background:'+(active?'rgba(124,58,237,.2)':'#1a1a2e')+';border:1px solid '+(active?'rgba(124,58,237,.5)':'#2d2d4a')+';color:'+(active?'#a78bfa':'#94a3b8')+';padding:8px 18px;border-radius:999px;font-size:13px;cursor:pointer;transition:.15s">'+label+'</button>';
  }

  function renderCards(creators, append) {
    var grid = document.getElementById('grid-${uid}');
    if (!creators.length && !append) { grid.innerHTML='<div style="text-align:center;color:#475569;padding:48px;grid-column:1/-1">No creators found</div>'; return; }
    var html = creators.map(function(c) {
      var imgEl = (c.image&&c.image.url) ? '<img src="'+c.image.url+'" alt="'+(c.name||c.ident)+'" loading="lazy" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block">' : '<div class="mc-img-ph">🤖</div>';
      var badges = (c.badges||[]).slice(0,2).map(function(bg){ return '<span class="mc-badge" style="background:'+bg.color+'22;color:'+bg.color+'">'+bg.value+'</span>'; }).join('');
      return '<a href="'+mktUrl+'/creators/'+c.slug+'" target="_blank" class="mc-card">'+imgEl+'<div class="mc-info"><div class="mc-name">'+(c.name||c.ident)+'</div>'+(badges?'<div>'+badges+'</div>':'')+'</div></a>';
    }).join('');
    if (append) grid.insertAdjacentHTML('beforeend', html);
    else grid.innerHTML = html;
  }

  function load(append) {
    var grid = document.getElementById('grid-${uid}');
    if (!append) grid.innerHTML = skeletons;
    var url='/api/marketplace/creators?perPage=${limit}&page='+page;
    if (activeCat) url+='&category='+encodeURIComponent(activeCat);
    fetch(url).then(function(r){return r.json();}).then(function(d){
      renderCards(d.data||[], append);
      document.getElementById('more-${uid}').style.display = d.links&&d.links.next ? 'inline-block' : 'none';
    }).catch(function(){ grid.innerHTML='<div style="text-align:center;color:#475569;padding:48px;grid-column:1/-1">Failed to load creators</div>'; });
  }

  function loadCats() {
    fetch('/api/marketplace/categories').then(function(r){return r.json();}).then(function(d){
      var cats=document.getElementById('cats-${uid}');
      var items=d.data||[];
      if(!items.length) return;
      cats.innerHTML = chipHTML('', 'All', true) + items.map(function(c){ return chipHTML(c.id, c.name, false); }).join('');
    });
  }

  window['mcFilter_${uid}'] = function(catId, btn) {
    activeCat = catId || null; page = 1;
    document.querySelectorAll('#cats-${uid} button').forEach(function(b){ b.style.background='#1a1a2e'; b.style.borderColor='#2d2d4a'; b.style.color='#94a3b8'; });
    btn.style.background='rgba(124,58,237,.2)'; btn.style.borderColor='rgba(124,58,237,.5)'; btn.style.color='#a78bfa';
    load(false);
  };
  window['mcLoadMore_${uid}'] = function(){ page++; load(true); };

  loadCats();
  load(false);
})();
<\/script>`;
}

function renderMarketplaceCategories(b) {
  const uid = 'mcat_' + Math.random().toString(36).slice(2, 8);
  const mktUrl = b.marketplace_url || 'https://aicreatormarketplace.com';
  const skeletons = Array(6).fill('<div style="background:#12121f;border-radius:14px;height:130px;animation:mfc-pulse 1.5s ease-in-out infinite"></div>').join('');

  return `
<section style="padding:72px 20px;background:#0e0e1c">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:40px">
      ${b.label ? `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#06b6d4;margin-bottom:12px">${b.label}</div>` : ''}
      <h2 style="font-size:clamp(24px,4vw,40px);font-weight:800;color:#f1f5f9;margin-bottom:12px">${b.title || 'Browse by Category'}</h2>
      ${b.subtitle ? `<p style="color:#94a3b8;font-size:16px">${b.subtitle}</p>` : ''}
    </div>
    <div id="catgrid-${uid}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px">${skeletons}</div>
  </div>
</section>
<script>
(function(){
  var mktUrl='${mktUrl}';
  fetch('/api/marketplace/categories').then(function(r){return r.json();}).then(function(d){
    var cats=d.data||[];
    var grid=document.getElementById('catgrid-${uid}');
    if(!cats.length){grid.innerHTML='<p style="color:#475569;text-align:center;grid-column:1/-1">No categories found</p>';return;}
    grid.innerHTML=cats.map(function(cat){
      var bg=(cat.images&&cat.images[0]) ? 'background:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.7)),url('+cat.images[0].url+') center/cover' : 'background:linear-gradient(135deg,#1a1a2e,#2d2d4a)';
      return '<a href="'+mktUrl+'/categories/'+cat.slug+'" target="_blank" style="display:flex;flex-direction:column;justify-content:flex-end;min-height:130px;'+bg+';border-radius:14px;padding:16px;text-decoration:none;border:1px solid #1e1e30;transition:.2s" onmouseover="this.style.borderColor=\'rgba(124,58,237,.5)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'#1e1e30\';this.style.transform=\'none\'">'
        +'<div style="font-size:14px;font-weight:700;color:#f1f5f9">'+cat.name+'</div>'
        +(cat.creatorsCount?'<div style="font-size:12px;color:#94a3b8;margin-top:3px">'+cat.creatorsCount+' creators</div>':'')
        +'</a>';
    }).join('');
  }).catch(function(){ document.getElementById('catgrid-${uid}').innerHTML='<p style="color:#475569;text-align:center;grid-column:1/-1">Failed to load</p>'; });
})();
<\/script>`;
}

function renderMarketplaceLead(b) {
  const uid = 'mlead_' + Math.random().toString(36).slice(2, 8);
  const bg = b.bg_color || 'transparent';

  return `
<section style="padding:72px 20px;background:${bg};text-align:center">
  <div class="signup-box" style="max-width:480px;margin:0 auto;background:#12121f;border:1px solid rgba(124,58,237,.3);border-radius:20px;padding:48px 32px;box-shadow:0 0 80px rgba(124,58,237,.1)">
    ${b.label ? `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#7c3aed;margin-bottom:12px">${b.label}</div>` : ''}
    ${b.title ? `<h2 style="font-size:clamp(22px,4vw,32px);font-weight:800;color:#f1f5f9;margin-bottom:10px">${b.title}</h2>` : ''}
    ${b.subtitle ? `<p style="color:#64748b;font-size:15px;margin-bottom:28px;line-height:1.6">${b.subtitle}</p>` : ''}
    <form id="form-${uid}" onsubmit="mlSubmit_${uid}(event)">
      <input type="email" id="email-${uid}" placeholder="${b.placeholder || 'Enter your email address'}" required
        style="width:100%;background:#1a1a2e;border:1px solid #2d2d4a;color:#e2e8f0;padding:14px 16px;border-radius:10px;font-size:15px;margin-bottom:12px;outline:none;font-family:inherit">
      <button type="submit" id="btn-${uid}"
        style="width:100%;padding:16px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit">
        ${b.cta_text || 'Claim My Creator →'}
      </button>
    </form>
    <div id="msg-${uid}" style="display:none;margin-top:16px;padding:14px 18px;border-radius:10px;font-size:14px;font-weight:500"></div>
    <div style="font-size:12px;color:#475569;margin-top:12px">🔒 No spam. Free to start.</div>
  </div>
</section>
<script>
window['mlSubmit_${uid}'] = async function(e) {
  e.preventDefault();
  var btn=document.getElementById('btn-${uid}');
  var msg=document.getElementById('msg-${uid}');
  var email=document.getElementById('email-${uid}').value.trim();
  btn.disabled=true; btn.textContent='One moment...';
  // Fire and show success — server saves locally first so signup is guaranteed
  var payload={email:email};
  ${b.campaign_id ? `payload.campaign_id='${b.campaign_id}';` : ''}
  await Promise.allSettled([
    fetch('/api/marketplace/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
  ]);
  msg.style.display='block';
  msg.style.background='#064e3b';msg.style.color='#6ee7b7';msg.style.border='1px solid #065f46';
  msg.textContent="🎉 You're in! Check your email for next steps.";
  document.getElementById('form-${uid}').style.display='none';
};
<\/script>`;
}

function renderVideoTestimonials(b, allTestimonials) {
  const limit = parseInt(b.count) || 0;
  const videos = (allTestimonials || [])
    .filter(t => t.type === 'video' && t.video_path && t.active !== false);
  const items = limit > 0 ? videos.slice(0, limit) : videos;

  if (!items.length) return `
    <section style="padding:72px 20px;text-align:center">
      <div class="container">
        <p style="color:#475569">Upload video testimonials in Admin → Testimonials → Video tab to display them here.</p>
      </div>
    </section>`;

  const blockId = 'vtc-' + Math.random().toString(36).slice(2, 7);
  const headline = b.headline || 'What Our Students Are Saying';
  const subhead = b.subheadline || 'Join thousands of creators building real income streams.';
  const ctaText = b.cta_text || 'Claim Your Free Spot →';
  const ctaUrl = b.cta_url || '#signup';

  const cards = items.map((t, idx) => `
    <div class="vtc-card" data-idx="${idx}">
      <video class="vtc-video" src="${t.video_path}" preload="none" playsinline
        style="width:100%;height:100%;object-fit:cover;display:block;border-radius:16px"></video>
      <button class="vtc-play-btn" onclick="vtcTogglePlay(this)" aria-label="Play">
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="40" r="39" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.8)" stroke-width="2"/>
          <polygon points="32,24 60,40 32,56" fill="white"/>
        </svg>
      </button>
      <div class="vtc-info">
        <div class="vtc-name">${t.name}</div>
        ${t.earnings ? `<div class="vtc-earnings">${t.earnings}</div>` : ''}
      </div>
    </div>`).join('');

  const dots = items.map((_, i) => `<button class="vtc-dot ${i===0?'vtc-dot-active':''}" onclick="vtcGoTo_${blockId}(${i})" aria-label="Slide ${i+1}"></button>`).join('');

  return `
    <section class="vtc-section" id="${blockId}" style="padding:72px 0;background:#f8f9fc;overflow:hidden">
      <div style="text-align:center;padding:0 20px;margin-bottom:40px">
        <h2 style="font-size:clamp(26px,4vw,46px);font-weight:800;color:#0f172a;line-height:1.2;max-width:760px;margin:0 auto">${headline}</h2>
      </div>

      <div class="vtc-outer" style="position:relative;width:100%;overflow:hidden">
        <div class="vtc-track" id="${blockId}-track" style="display:flex;transition:transform .4s cubic-bezier(.4,0,.2,1);will-change:transform">
          ${cards}
        </div>
        ${items.length > 1 ? `
        <button class="vtc-arrow vtc-arrow-left" onclick="vtcGoTo_${blockId}(vtcIdx_${blockId}-1)" aria-label="Previous">&#8592;</button>
        <button class="vtc-arrow vtc-arrow-right" onclick="vtcGoTo_${blockId}(vtcIdx_${blockId}+1)" aria-label="Next">&#8594;</button>` : ''}
      </div>

      ${items.length > 1 ? `<div class="vtc-dots" style="display:flex;justify-content:center;gap:8px;margin-top:24px">${dots}</div>` : ''}

      <div style="text-align:center;padding:40px 20px 0;max-width:640px;margin:0 auto">
        <p style="color:#475569;font-size:16px;line-height:1.7;margin-bottom:28px">${subhead}</p>
        <a href="${ctaUrl}" class="vtc-cta-btn" style="display:inline-block;background:#0f172a;color:white;padding:16px 40px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;transition:.2s"
          onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='#0f172a'">${ctaText}</a>
      </div>
    </section>

    <style>
    .vtc-section * { box-sizing: border-box; }
    .vtc-track { padding: 0 10%; gap: 0; }
    .vtc-card {
      flex: 0 0 80%;
      position: relative;
      aspect-ratio: 16/9;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      margin: 0 2%;
      transition: transform .3s, opacity .3s;
      opacity: .6;
      transform: scale(.95);
    }
    .vtc-card.vtc-active { opacity: 1; transform: scale(1); }
    .vtc-play-btn {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%,-50%);
      background: none; border: none; cursor: pointer;
      width: 80px; height: 80px; padding: 0;
      transition: transform .15s;
    }
    .vtc-play-btn:hover { transform: translate(-50%,-50%) scale(1.1); }
    .vtc-info {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 40px 20px 16px;
      background: linear-gradient(to top, rgba(0,0,0,.8) 0%, transparent 100%);
      color: white;
    }
    .vtc-name { font-size: 15px; font-weight: 700; }
    .vtc-earnings { font-size: 13px; color: #6ee7b7; margin-top: 2px; }
    .vtc-arrow {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgba(255,255,255,.9); border: none; border-radius: 50%;
      width: 44px; height: 44px; font-size: 20px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 12px rgba(0,0,0,.2); transition: .15s; z-index: 2;
    }
    .vtc-arrow:hover { background: white; transform: translateY(-50%) scale(1.08); }
    .vtc-arrow-left { left: 4%; }
    .vtc-arrow-right { right: 4%; }
    .vtc-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #cbd5e1; border: none; cursor: pointer;
      padding: 0; transition: .2s;
    }
    .vtc-dot-active { background: #0f172a; width: 24px; border-radius: 4px; }
    @media (max-width: 768px) {
      .vtc-track { padding: 0; gap: 0; }
      .vtc-card { flex: 0 0 100%; margin: 0; border-radius: 0; }
      .vtc-arrow-left { left: 8px; }
      .vtc-arrow-right { right: 8px; }
    }
    </style>

    <script>
    (function() {
      var BID = '${blockId}';
      var TOTAL = ${items.length};
      window['vtcIdx_' + BID] = 0;

      function goTo(idx) {
        idx = ((idx % TOTAL) + TOTAL) % TOTAL;
        window['vtcIdx_' + BID] = idx;
        var track = document.getElementById(BID + '-track');
        if (!track) return;
        track.querySelectorAll('.vtc-video').forEach(function(v) {
          v.pause();
          var btn = v.nextElementSibling;
          if (btn) { btn.classList.remove('vtc-playing'); setPlayIcon(btn); }
        });
        var cards = track.querySelectorAll('.vtc-card');
        cards.forEach(function(c, i) {
          c.classList.toggle('vtc-active', i === idx);
        });
        var cardW = track.parentElement.offsetWidth * 0.84;
        track.style.transform = 'translateX(-' + (idx * cardW) + 'px)';
        document.querySelectorAll('#' + BID + ' .vtc-dot').forEach(function(d, i) {
          d.classList.toggle('vtc-dot-active', i === idx);
        });
      }
      window['vtcGoTo_' + BID] = goTo;

      function setPlayIcon(btn) {
        btn.innerHTML = '<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="39" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.8)" stroke-width="2"/><polygon points="32,24 60,40 32,56" fill="white"/></svg>';
      }
      function setPauseIcon(btn) {
        btn.innerHTML = '<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="39" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.8)" stroke-width="2"/><rect x="26" y="24" width="10" height="32" rx="2" fill="white"/><rect x="44" y="24" width="10" height="32" rx="2" fill="white"/></svg>';
      }
      window.vtcTogglePlay = function(btn) {
        var card = btn.closest('.vtc-card');
        var video = card.querySelector('.vtc-video');
        var idx = parseInt(card.dataset.idx);
        goTo(idx);
        if (video.paused) {
          document.querySelectorAll('#' + BID + ' .vtc-video').forEach(function(v) {
            if (v !== video) { v.pause(); var b2 = v.nextElementSibling; if (b2) { b2.classList.remove('vtc-playing'); setPlayIcon(b2); } }
          });
          video.play();
          btn.classList.add('vtc-playing');
          setPauseIcon(btn);
          video.onended = function() { btn.classList.remove('vtc-playing'); setPlayIcon(btn); };
        } else {
          video.pause();
          btn.classList.remove('vtc-playing');
          setPlayIcon(btn);
        }
      };

      var touchX = null;
      var outer = document.querySelector('#' + BID + ' .vtc-outer');
      if (outer) {
        outer.addEventListener('touchstart', function(e) { touchX = e.touches[0].clientX; }, { passive: true });
        outer.addEventListener('touchend', function(e) {
          if (touchX === null) return;
          var dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 40) goTo(window['vtcIdx_' + BID] + (dx < 0 ? 1 : -1));
          touchX = null;
        }, { passive: true });
      }

      goTo(0);
      window.addEventListener('resize', function() { goTo(window['vtcIdx_' + BID]); });
    })();
    </script>`;
}

module.exports = { renderBlock, renderPageFromBlocks, trackingScript, BLOCK_TYPES, MP_BLOCK_TYPES };
