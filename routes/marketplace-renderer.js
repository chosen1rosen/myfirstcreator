const supabase = require('../db');

const BASE = 'https://api.aicreatormarketplace.com';
const PINK = '#ff3366';

async function getToken() {
  if (process.env.MARKETPLACE_SITE_TOKEN) return process.env.MARKETPLACE_SITE_TOKEN;
  const { data } = await supabase.from('settings').select('value').eq('key', 'marketplace_site_token').single();
  return data?.value || null;
}

async function apiGet(path, token) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function renderMarketplacePage(variant, isPreview = false) {
  const token = await getToken();

  let cfg = {};
  if (variant.blocks) {
    const b = Array.isArray(variant.blocks) ? variant.blocks[0] : variant.blocks;
    if (b && typeof b === 'object') cfg = b;
  }

  const headline1   = cfg.hero_headline1   || 'Build and Scale Your';
  const headline2   = cfg.hero_headline2   || 'AI Creator Income';
  const headline3   = cfg.hero_headline3   || 'Starting Today';
  const subheadline = cfg.hero_subheadline || 'Browse thousands of AI creators, claim your affiliate link, and start earning commissions — all without creating content yourself.';
  const ctaText     = cfg.cta_text         || 'Get Started For Free';
  const ctaUrl      = cfg.cta_url          || 'https://aicreatormarketplace.com';
  const socialProof = cfg.social_proof     || 'Join 50,000+ successful affiliates';
  const campaignId  = cfg.campaign_id      || '';
  const creatorLimit = parseInt(cfg.creator_limit || '8');

  const [siteConfig, creatorsData, plansData] = await Promise.all([
    token ? apiGet('/v1/site/config', token) : null,
    token ? apiGet(`/v1/creators?limit=${creatorLimit}&featured=true`, token) : null,
    token ? apiGet('/v1/plans', token) : null,
  ]);

  const creators      = creatorsData?.creators || creatorsData?.data || [];
  const plans         = plansData?.plans       || plansData?.data    || [];
  const totalCreators = siteConfig?.stats?.total_creators || '5,000+';
  const communityUrl  = siteConfig?.community_url         || ctaUrl;

  // ── Creator showcase ────────────────────────────────────────────────────────
  const showcaseCards = creators.length
    ? creators.map(c => {
        const avatar     = c.avatar_url || c.image_url || c.avatar || '';
        const name       = c.name       || c.username  || 'AI Creator';
        const earnings   = c.earnings   || c.monthly_earnings || '';
        const likes      = c.likes      || c.followers  || '';
        const profileUrl = c.profile_url || `${ctaUrl}/creator/${c.id || c.slug || ''}`;
        return `
        <a href="${profileUrl}" target="_blank" class="creator-card" style="text-decoration:none">
          ${avatar
            ? `<img src="${avatar}" alt="${name}" style="width:100%;height:100%;object-fit:cover">`
            : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#1a1a1a,#2a1a2a);display:flex;align-items:center;justify-content:center;font-size:40px">🤖</div>`}
          <div class="creator-card-overlay">
            ${earnings ? `<span class="creator-stat"><span style="color:#22c55e">💰</span> ${earnings}</span>` : ''}
            ${likes    ? `<span class="creator-stat"><span style="color:#ff3366">♥</span> ${likes}</span>`    : ''}
          </div>
        </a>`;
      }).join('')
    : [
        ['#1a0a0f','💃','2.1M','$12.4K'],
        ['#0a0f1a','🤖','780K','$5.8K'],
        ['#1a0a1a','👑','1.2M','$8.1K'],
        ['#0f1a0a','🎭','340K','$3.2K'],
        ['#1a1a0a','🔥','920K','$15.3K'],
        ['#0a1a1a','💎','1.8M','$21.7K'],
      ].map(([bg, emoji, lk, earn]) => `
        <a href="${ctaUrl}" target="_blank" class="creator-card" style="text-decoration:none">
          <div style="width:100%;height:100%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:56px">${emoji}</div>
          <div class="creator-card-overlay">
            <span class="creator-stat"><span style="color:#22c55e">💰</span> ${earn}</span>
            <span class="creator-stat"><span style="color:#ff3366">♥</span> ${lk}</span>
          </div>
        </a>`).join('');

  // ── Pricing ─────────────────────────────────────────────────────────────────
  const defaultPlans = [
    { name: 'Starter Affiliate', price: 'Free',   per: 'forever', featured: false, features: ['Browse all creators', 'Get your affiliate link', 'Basic analytics dashboard', 'Email support'] },
    { name: 'Pro Affiliate',     price: '$29',    per: 'mo',      featured: true,  features: ['Everything in Starter', 'Advanced analytics', 'Priority creator access', 'Weekly payout', 'Dedicated account manager'] },
    { name: 'Agency',            price: '$79',    per: 'mo',      featured: false, features: ['Everything in Pro', 'Manage 5 sub-affiliates', 'White-label dashboard', 'API access', 'Priority support'] },
    { name: 'Enterprise',        price: 'Custom', per: '',        featured: false, features: ['Everything in Agency', 'Unlimited sub-affiliates', 'Custom integrations', 'SLA guarantee', 'Dedicated team'] },
  ];
  const pricingPlans = plans.length ? plans : defaultPlans;

  const pricingCards = pricingPlans.map((plan, i) => {
    const isFeatured = plan.featured || plan.popular || i === 1;
    const features   = plan.features || [];
    const price      = plan.price    || plan.amount   || 'Free';
    const per        = plan.per      || plan.interval || (price === 'Free' ? 'forever' : 'mo');
    return `
    <div class="pricing-card ${isFeatured ? 'pricing-card-featured' : ''}">
      ${isFeatured ? `<div class="pricing-popular">Most Popular</div>` : ''}
      <div class="pricing-name">${plan.name}</div>
      <div class="pricing-price">
        ${price === 'Free' || price === 'Custom'
          ? `<span style="font-size:36px;font-weight:900">${price}</span>`
          : `<span style="font-size:48px;font-weight:900">${price}</span><span style="font-size:16px;color:#6b7280">/${per}</span>`}
      </div>
      <ul class="pricing-features">
        ${features.map(f => `<li><span class="check">✓</span>${f}</li>`).join('')}
      </ul>
      <a href="${ctaUrl}" target="_blank" class="${isFeatured ? 'btn-pink' : 'btn-ghost'} btn-full">Try It Free</a>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${headline1} ${headline2} — AI Creator Marketplace</title>
  <meta name="description" content="${subheadline}">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--pink:${PINK};--dark:#0a0a0a;--card:#141414;--card2:#161616;--border:#1f1f1f;--text:#ffffff;--muted:#9ca3af;--radius:20px}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--dark);color:var(--text);min-height:100vh;overflow-x:hidden}

    /* Nav */
    .nav{position:sticky;top:0;z-index:100;background:rgba(10,10,10,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between}
    .nav-logo{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;color:var(--text);text-decoration:none}
    .nav-logo-icon{width:32px;height:32px;background:var(--pink);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px}
    .nav-links{display:flex;gap:32px;list-style:none}
    .nav-links a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500;transition:.2s}
    .nav-links a:hover{color:var(--text)}
    .nav-right{display:flex;align-items:center;gap:16px}
    .nav-login{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500}
    @media(max-width:768px){.nav{padding:0 20px}.nav-links{display:none}}

    /* Buttons */
    .btn-pink{display:inline-block;background:var(--pink);color:#fff;padding:14px 32px;border-radius:50px;font-size:16px;font-weight:700;text-decoration:none;border:none;cursor:pointer;transition:.2s;text-align:center}
    .btn-pink:hover{opacity:.88;transform:translateY(-1px)}
    .btn-pink-lg{padding:18px 48px;font-size:18px}
    .btn-ghost{display:inline-block;background:#1f1f1f;color:var(--text);padding:14px 32px;border-radius:50px;font-size:16px;font-weight:600;text-decoration:none;border:none;cursor:pointer;transition:.2s;text-align:center}
    .btn-ghost:hover{background:#2a2a2a}
    .btn-purple{display:inline-flex;align-items:center;gap:8px;background:transparent;color:var(--text);padding:14px 28px;border-radius:50px;font-size:16px;font-weight:600;text-decoration:none;border:2px solid #5865f2;transition:.2s}
    .btn-purple:hover{background:rgba(88,101,242,.15)}
    .btn-full{width:100%;display:block;text-align:center;margin-top:auto}

    /* Hero */
    .hero{padding:80px 40px 72px;text-align:center;max-width:900px;margin:0 auto}
    .hero h1{font-size:clamp(44px,7vw,80px);font-weight:900;line-height:1.05;letter-spacing:-2px;margin-bottom:24px}
    .hero h1 .pink{color:var(--pink)}
    .hero-sub{color:var(--muted);font-size:clamp(15px,2vw,18px);line-height:1.7;max-width:580px;margin:0 auto 40px}
    .hero-cta-wrap{display:flex;flex-direction:column;align-items:center;gap:12px}
    .hero-social-proof{color:#6b7280;font-size:13px}

    /* Creator Showcase */
    .showcase{padding:0 0 80px;overflow:hidden}
    .showcase-scroll{display:flex;gap:12px;padding:0 40px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
    .showcase-scroll::-webkit-scrollbar{display:none}
    .creator-card{flex-shrink:0;width:200px;height:320px;border-radius:16px;overflow:hidden;position:relative;display:block;background:#141414}
    .creator-card-overlay{position:absolute;bottom:0;left:0;right:0;padding:12px;background:linear-gradient(transparent,rgba(0,0,0,.85));display:flex;gap:8px;flex-wrap:wrap}
    .creator-stat{display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,.6);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;color:#fff}
    @media(max-width:600px){.creator-card{width:160px;height:260px}}

    /* Sections */
    .section{padding:80px 40px}
    .section-center{text-align:center}
    .section h2{font-size:clamp(32px,5vw,56px);font-weight:900;letter-spacing:-1px;margin-bottom:16px}
    .section-sub{color:var(--muted);font-size:16px;margin-bottom:48px}
    @media(max-width:768px){.section{padding:56px 20px}}

    /* How It Works */
    .how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .how-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column}
    .how-card-img{width:100%;aspect-ratio:16/10;background:#0f0f0f;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .how-card-body{padding:28px 24px 32px;flex:1;display:flex;flex-direction:column}
    .how-card-title{font-size:clamp(22px,3vw,32px);font-weight:900;letter-spacing:-1px;margin-bottom:10px;line-height:1.1}
    .how-card-text{color:var(--muted);font-size:14px;line-height:1.6;flex:1}
    .how-card-arrow{width:44px;height:44px;border-radius:50%;background:var(--pink);display:flex;align-items:center;justify-content:center;font-size:18px;margin-top:20px;flex-shrink:0;align-self:flex-start}
    @media(max-width:768px){.how-grid{grid-template-columns:1fr}}

    /* Feature Cards */
    .feature-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:grid;grid-template-columns:1fr 1fr;align-items:center;margin-bottom:16px}
    .feature-card.reverse{direction:rtl}
    .feature-card.reverse>*{direction:ltr}
    .feature-card-glow{border-color:rgba(255,51,102,.35);box-shadow:0 0 60px rgba(255,51,102,.08),inset 0 0 0 1px rgba(255,51,102,.1)}
    .feature-img{width:100%;height:100%;min-height:320px;background:#0f0f0f;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .feature-body{padding:48px 40px;display:flex;flex-direction:column;gap:16px}
    .feature-badge{display:inline-block;background:rgba(255,51,102,.12);border:1px solid rgba(255,51,102,.3);color:var(--pink);border-radius:20px;padding:5px 14px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;align-self:flex-start}
    .feature-title{font-size:clamp(22px,3vw,36px);font-weight:900;line-height:1.1;letter-spacing:-1px}
    .feature-title .pink{color:var(--pink)}
    .feature-text{color:var(--muted);font-size:15px;line-height:1.7}
    @media(max-width:768px){.feature-card{grid-template-columns:1fr}.feature-card.reverse{direction:ltr}.feature-img{min-height:220px}.feature-body{padding:28px 24px}}

    /* Community */
    .community-card{background:var(--card2);border:1px solid var(--border);border-radius:var(--radius);display:grid;grid-template-columns:1fr 1fr;align-items:center;overflow:hidden;margin:0 40px}
    .community-body{padding:56px 48px;display:flex;flex-direction:column;gap:20px}
    .community-text{color:var(--muted);font-size:15px;line-height:1.7}
    .community-screenshot{width:100%;height:100%;min-height:360px;background:#313338;display:flex;overflow:hidden}
    @media(max-width:768px){.community-card{grid-template-columns:1fr;margin:0 20px}.community-body{padding:36px 24px}.community-screenshot{min-height:200px}}

    /* Pricing */
    .pricing-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:start}
    .pricing-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:28px 24px;display:flex;flex-direction:column;gap:20px;position:relative}
    .pricing-card-featured{border-color:rgba(255,51,102,.5);box-shadow:0 0 60px rgba(255,51,102,.1)}
    .pricing-popular{position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:var(--pink);color:#fff;padding:6px 18px;border-radius:50px;font-size:12px;font-weight:800;white-space:nowrap}
    .pricing-name{font-size:18px;font-weight:700}
    .pricing-price{display:flex;align-items:baseline;gap:4px;font-weight:900}
    .pricing-features{list-style:none;display:flex;flex-direction:column;gap:12px;flex:1}
    .pricing-features li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--muted)}
    .check{color:var(--pink);font-weight:900;flex-shrink:0;margin-top:1px}
    @media(max-width:900px){.pricing-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:560px){.pricing-grid{grid-template-columns:1fr}}

    /* Final CTA */
    .final-cta{padding:100px 40px;text-align:center;border-top:1px solid var(--border)}
    .final-cta h2{font-size:clamp(32px,5vw,60px);font-weight:900;letter-spacing:-2px;margin-bottom:16px;line-height:1.1}
    .final-cta-sub{color:var(--muted);font-size:16px;margin-bottom:36px}
    .final-cta-trust{color:#4b5563;font-size:13px;margin-top:16px}

    /* Footer */
    .footer{border-top:1px solid var(--border);padding:56px 40px 32px;display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:40px}
    .footer-logo{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;text-decoration:none;color:var(--text);margin-bottom:12px}
    .footer-logo-icon{width:28px;height:28px;background:var(--pink);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px}
    .footer-tagline{color:var(--muted);font-size:14px;font-weight:600;margin-bottom:20px}
    .footer-col h4{font-size:14px;font-weight:700;margin-bottom:16px}
    .footer-col ul{list-style:none;display:flex;flex-direction:column;gap:10px}
    .footer-col ul a{color:var(--muted);text-decoration:none;font-size:14px;transition:.2s}
    .footer-col ul a:hover{color:var(--text)}
    .footer-bottom{border-top:1px solid var(--border);padding:20px 40px;text-align:center;color:#374151;font-size:12px}
    @media(max-width:768px){.footer{grid-template-columns:1fr;padding:40px 20px}.footer-bottom{padding:20px}}

    /* Discord mock */
    .discord-mock{width:100%;height:100%;background:#313338;display:flex;font-family:'Segoe UI',sans-serif;overflow:hidden}
    .discord-sidebar{width:200px;background:#2b2d31;padding:16px 0;flex-shrink:0}
    .discord-server{width:44px;height:44px;border-radius:50%;background:var(--pink);display:flex;align-items:center;justify-content:center;font-size:20px;margin:0 auto 16px}
    .discord-section{padding:4px 16px 2px;font-size:10px;font-weight:700;color:#949ba4;letter-spacing:.05em;text-transform:uppercase;margin-top:8px}
    .discord-channel{padding:4px 8px 4px 16px;font-size:13px;color:#949ba4;border-radius:4px;margin:1px 8px}
    .discord-channel.active{background:#404249;color:#dbdee1}
    .discord-main{flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
    .discord-header{font-size:14px;font-weight:700;color:#f2f3f5;border-bottom:1px solid #3f4147;padding-bottom:12px}
    .discord-msg{display:flex;gap:10px}
    .discord-avatar{width:34px;height:34px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px}
    .discord-msg-name{font-size:13px;font-weight:700;color:#f2f3f5;margin-bottom:2px}
    .discord-msg-name span{font-size:10px;color:#949ba4;font-weight:400;margin-left:6px}
    .discord-msg-text{font-size:13px;color:#dbdee1;line-height:1.4}
    .discord-earnings{background:#1e1f22;border-radius:8px;padding:10px;margin-top:6px;border-left:3px solid var(--pink)}
    .discord-earnings-amount{font-size:20px;font-weight:900;color:#22c55e}
    .discord-earnings-label{font-size:10px;color:#949ba4;margin-top:2px}
  </style>
</head>
<body>

${isPreview ? `<div style="position:fixed;top:0;left:0;right:0;background:#7c3aed;color:white;text-align:center;padding:8px;font-size:13px;z-index:99999;pointer-events:none">⚠️ PREVIEW MODE — not live</div><div style="height:36px"></div>` : ''}

<!-- NAV -->
<nav class="nav">
  <a href="/" class="nav-logo">
    <div class="nav-logo-icon">🤖</div>
    AI Creator Marketplace
  </a>
  <ul class="nav-links">
    <li><a href="#how">How It Works</a></li>
    <li><a href="#creators">Browse Creators</a></li>
    <li><a href="#community">Community</a></li>
    <li><a href="#pricing">Pricing</a></li>
  </ul>
  <div class="nav-right">
    <a href="${ctaUrl}/login" target="_blank" class="nav-login">Login</a>
    <a href="${ctaUrl}" target="_blank" class="btn-pink" style="padding:10px 22px;font-size:14px">${ctaText}</a>
  </div>
</nav>

<!-- HERO -->
<div style="padding:0 40px">
  <div class="hero">
    <h1>
      ${headline1}<br>
      <span class="pink">${headline2}</span><br>
      ${headline3}
    </h1>
    <p class="hero-sub">${subheadline}</p>
    <div class="hero-cta-wrap">
      <a href="${ctaUrl}" target="_blank" class="btn-pink btn-pink-lg">${ctaText} →</a>
      <span class="hero-social-proof">${socialProof}</span>
    </div>
  </div>
</div>

<!-- CREATOR SHOWCASE -->
<section class="showcase" id="creators">
  <div class="showcase-scroll">
    ${showcaseCards}
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="section" id="how">
  <div class="section-center" style="margin-bottom:40px">
    <h2>HOW IT WORKS</h2>
  </div>
  <div class="how-grid">

    <div class="how-card">
      <div class="how-card-img" style="padding:24px;gap:8px;flex-direction:column">
        <div style="display:flex;gap:6px">
          ${['👩‍🦰','👱‍♀️','👩','👩‍🦳','👩‍🦱'].map(e => `<div style="width:48px;height:48px;background:#1a1a1a;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;border:2px solid #2a2a2a">${e}</div>`).join('')}
        </div>
        <div style="width:140px;height:32px;background:var(--pink);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff">Choose a Creator</div>
      </div>
      <div class="how-card-body">
        <div class="how-card-arrow">→</div>
        <div class="how-card-title">BROWSE YOUR CREATOR</div>
        <div class="how-card-text">Explore thousands of AI-powered creators across every niche. Pick one that matches your audience — no experience required.</div>
      </div>
    </div>

    <div class="how-card">
      <div class="how-card-img" style="padding:24px;gap:12px">
        ${['📱','🎯','🔗'].map((e,i) => `<div style="width:60px;height:100px;background:#141414;border-radius:12px;border:2px solid #1f1f1f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:${i===1?'28px':'22px'};transform:${i===0?'rotate(-8deg)':i===2?'rotate(8deg)':'scale(1.1)'}">${e}<div style="font-size:9px;color:#6b7280;text-align:center">Share<br>Link</div></div>`).join('')}
      </div>
      <div class="how-card-body">
        <div class="how-card-arrow">→</div>
        <div class="how-card-title">SHARE YOUR LINK</div>
        <div class="how-card-text">Get your unique affiliate link instantly. Post it on TikTok, Instagram, X, YouTube, or email — anywhere your audience lives.</div>
      </div>
    </div>

    <div class="how-card">
      <div class="how-card-img" style="padding:20px">
        <div style="background:#0d1a0d;border:1px solid #1a2e1a;border-radius:14px;padding:16px 20px;width:100%">
          <div style="font-size:10px;color:#6b7280;margin-bottom:8px;display:flex;justify-content:space-between"><span>Creator Earnings</span><span style="color:var(--pink)">This Month</span></div>
          <div style="font-size:32px;font-weight:900;color:#22c55e;margin-bottom:10px">$21,704.23</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            ${[['$2,113','Referrals'],['$731','Tips'],['$5,300','Bonuses'],['$13,560','Commissions']].map(([v,l])=>`<div style="background:#0a1a0a;border-radius:8px;padding:8px"><div style="font-size:14px;font-weight:700;color:#22c55e">${v}</div><div style="font-size:10px;color:#6b7280">${l}</div></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="how-card-body">
        <div class="how-card-arrow" style="background:#22c55e">💲</div>
        <div class="how-card-title">GET PAID</div>
        <div class="how-card-text">Earn commissions on every signup and sale your links generate. Paid weekly — directly to your bank or PayPal.</div>
      </div>
    </div>

  </div>
</section>

<!-- FEATURE: ANALYTICS DASHBOARD -->
<section class="section" style="padding-top:0">
  <div class="section-center" style="margin-bottom:40px">
    <h2>Build Your AI Creator Business</h2>
    <p class="section-sub">Everything you need to find, promote, and profit from AI creators — in one platform</p>
  </div>
  <div class="feature-card feature-card-glow">
    <div class="feature-img" style="padding:32px">
      <div style="background:#0d0d14;border:1px solid #1e1e30;border-radius:16px;padding:20px;width:100%;max-width:400px">
        <div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:12px">📊 YOUR DASHBOARD</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
          ${[['142','Clicks Today','#a78bfa'],['23','New Signups','#a78bfa'],['$847','Earned Today','#22c55e']].map(([v,l,c])=>`<div style="background:#12121f;border:1px solid #1e1e30;border-radius:10px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:900;color:${c}">${v}</div><div style="font-size:9px;color:#475569">${l}</div></div>`).join('')}
        </div>
        <div style="background:#12121f;border:1px solid #1e1e30;border-radius:10px;padding:12px">
          <div style="font-size:10px;color:#475569;margin-bottom:8px">Earnings This Week</div>
          <div style="display:flex;align-items:flex-end;gap:3px;height:44px">
            ${[30,45,28,60,75,88,100].map(h=>`<div style="flex:1;background:linear-gradient(to top,#7c3aed,#a78bfa);border-radius:3px 3px 0 0;height:${h}%;opacity:.8"></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="feature-body">
      <span class="feature-badge">ANALYTICS</span>
      <div class="feature-title">See Every Click,<br>Every Dollar</div>
      <p class="feature-text">Real-time dashboard shows exactly which creators, links, and campaigns are making you money. Stop guessing — start scaling what works.</p>
      <a href="${ctaUrl}" target="_blank" class="btn-pink" style="align-self:flex-start">View My Dashboard</a>
    </div>
  </div>
</section>

<!-- FEATURE: CREATOR LIBRARY -->
<section style="padding:0 40px 16px">
  <div class="feature-card">
    <div class="feature-img" style="padding:24px">
      <div style="position:relative;width:100%;max-width:340px">
        <div style="background:#141414;border:2px solid rgba(255,51,102,.4);border-radius:16px;overflow:hidden;box-shadow:0 0 40px rgba(255,51,102,.15)">
          <div style="aspect-ratio:4/3;background:linear-gradient(135deg,#1a0a0a,#0a1a0a);display:flex;align-items:center;justify-content:center;font-size:72px">🤖</div>
          <div style="padding:12px;display:flex;gap:6px;flex-wrap:wrap">
            ${['💰 Finance','🎭 Lifestyle','💪 Fitness','🎓 Education'].map(t=>`<span style="background:#1f1f1f;border:1px solid #2a2a2a;border-radius:20px;padding:3px 10px;font-size:11px;color:#9ca3af">${t}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="feature-body">
      <span class="feature-badge">CREATOR LIBRARY</span>
      <div class="feature-title"><span class="pink">Your AI Content Machine</span></div>
      <p class="feature-text">Browse and promote hundreds of AI creators instantly. Filter by niche, earnings potential, and audience size. Find your perfect match in seconds.</p>
      <a href="${ctaUrl}" target="_blank" class="btn-pink" style="align-self:flex-start">Browse Creators</a>
    </div>
  </div>
</section>

<!-- FEATURE: CAMPAIGNS -->
<section style="padding:0 40px 16px">
  <div class="feature-card reverse">
    <div class="feature-img" style="padding:24px">
      <div style="background:#141414;border-radius:16px;padding:20px;width:100%;max-width:340px">
        <div style="font-size:12px;color:#6b7280;margin-bottom:12px">📤 Share to your audience</div>
        ${[['TikTok','1,240 clicks','#ff3366'],['Instagram','890 clicks','#a78bfa'],['Email','445 clicks','#22c55e']].map(([p,c,col])=>`<div style="background:#0f0f0f;border:1px solid #1f1f1f;border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:13px;display:flex;justify-content:space-between;align-items:center"><span style="color:#e5e7eb">${p}</span><span style="color:${col};font-weight:700">${c}</span></div>`).join('')}
        <div style="background:rgba(255,51,102,.08);border:1px solid rgba(255,51,102,.2);border-radius:10px;padding:12px;margin-top:10px;text-align:center">
          <div style="font-size:18px;font-weight:900;color:#22c55e">+$2,847 earned</div>
          <div style="font-size:10px;color:#6b7280">this campaign</div>
        </div>
      </div>
    </div>
    <div class="feature-body">
      <span class="feature-badge">CAMPAIGNS</span>
      <div class="feature-title">Turn Any Platform Into Income</div>
      <p class="feature-text">One affiliate link works everywhere. Track clicks from TikTok, Instagram, YouTube, email — all in one dashboard. Scale the channels that convert.</p>
      <a href="${ctaUrl}" target="_blank" class="btn-pink" style="align-self:flex-start">Start My Campaign</a>
    </div>
  </div>
</section>

<!-- FEATURE: SMART MATCHING (glow card) -->
<section style="padding:0 40px 80px">
  <div class="feature-card feature-card-glow">
    <div class="feature-img" style="padding:24px;gap:16px;flex-wrap:wrap;align-items:center;justify-content:center">
      <div style="background:#0d0d1a;border:1px solid #1e1e30;border-radius:12px;padding:16px;width:200px">
        <div style="font-size:10px;color:#475569;margin-bottom:10px">🎯 TOP CREATORS TODAY</div>
        ${[['🤖','TechAI Pro','$3.2K/mo'],['💃','StyleBot X','$1.8K/mo'],['💪','FitMind AI','$2.1K/mo']].map(([e,n,earn])=>`<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#ff3366);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px">${e}</div><div><div style="font-size:12px;font-weight:600">${n}</div><div style="font-size:11px;color:#22c55e">${earn}</div></div></div>`).join('')}
      </div>
      <div style="background:#12121f;border:1px solid #1e1e30;border-radius:12px;padding:16px;width:150px">
        <div style="font-size:10px;color:#475569;margin-bottom:8px">Your link copied!</div>
        <div style="background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:10px;text-align:center;margin-bottom:8px">
          <div style="font-size:18px">✅</div>
          <div style="font-size:10px;color:#22c55e;font-weight:700">Ready to share</div>
        </div>
        <div style="background:var(--pink);border-radius:8px;padding:8px;text-align:center;font-size:12px;font-weight:700;color:#fff">Post Now →</div>
      </div>
    </div>
    <div class="feature-body">
      <span class="feature-badge">SMART MATCHING</span>
      <div class="feature-title">The Right Creator<br>for Your Audience</div>
      <p class="feature-text">Our AI recommends the highest-converting creators based on your audience type and platform. No guesswork — just results.</p>
      <p class="feature-text" style="margin-top:-4px">Get your personalized creator recommendations in under 60 seconds.</p>
      <a href="${ctaUrl}" target="_blank" class="btn-pink" style="align-self:flex-start">Get My Matches →</a>
    </div>
  </div>
</section>

<!-- COMMUNITY -->
<section style="padding:0 0 80px" id="community">
  <div class="community-card">
    <div class="community-body">
      <div>
        <div style="font-size:clamp(28px,4vw,48px);font-weight:900;line-height:1.05;letter-spacing:-1px">Don't Build Alone.</div>
        <div style="font-size:clamp(28px,4vw,48px);font-weight:900;line-height:1.05;letter-spacing:-1px;color:var(--pink)">Join the Inner Circle.</div>
      </div>
      <p class="community-text">Connect with top affiliate earners, share what's working, and get exclusive strategies from our private creator community. Members earn 3x more on average.</p>
      <a href="${communityUrl}" target="_blank" class="btn-purple" style="align-self:flex-start">Join the Discord →</a>
    </div>
    <div class="community-screenshot">
      <div class="discord-mock">
        <div class="discord-sidebar">
          <div class="discord-server">🤖</div>
          <div class="discord-section">Welcome</div>
          <div class="discord-channel active"># start-here</div>
          <div class="discord-channel"># rules</div>
          <div class="discord-channel"># announcements</div>
          <div class="discord-section">Community</div>
          <div class="discord-channel"># affiliates</div>
          <div class="discord-channel"># wins</div>
          <div class="discord-channel"># strategies</div>
          <div class="discord-section">Courses</div>
          <div class="discord-channel"># creator-tips</div>
          <div class="discord-channel"># scaling</div>
          <div class="discord-channel"># video-generation</div>
        </div>
        <div class="discord-main">
          <div class="discord-header"># start-here</div>
          <div class="discord-msg">
            <div class="discord-avatar" style="background:#5865f2">😎</div>
            <div>
              <div class="discord-msg-name">Alex_Affiliate <span>Today at 9:41 AM</span></div>
              <div class="discord-msg-text">Just hit my first $5k month! Started 6 weeks ago with zero followers 🚀</div>
              <div class="discord-earnings">
                <div class="discord-earnings-amount">$5,247.00</div>
                <div class="discord-earnings-label">Monthly earnings — Creator affiliates</div>
              </div>
            </div>
          </div>
          <div class="discord-msg" style="margin-top:4px">
            <div class="discord-avatar" style="background:var(--pink)">💎</div>
            <div>
              <div class="discord-msg-name">Sarah_M <span>Today at 9:43 AM</span></div>
              <div class="discord-msg-text">Congrats!! Which creators are converting best for you? 🔥</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="section section-center" id="pricing">
  <h2>Create. Post. Profit.</h2>
  <p class="section-sub">Join the platform that pays affiliates every week</p>
  <div class="pricing-grid">
    ${pricingCards}
  </div>
</section>

<!-- FINAL CTA -->
<section class="final-cta">
  <h2>Start Your AI Creator<br>Income Journey Today</h2>
  <p class="final-cta-sub">Join ${totalCreators} affiliates already earning commissions every week</p>
  <a href="${ctaUrl}" target="_blank" class="btn-pink btn-pink-lg">Start Your Free Trial</a>
  <p class="final-cta-trust">No credit card required • Cancel anytime</p>
</section>

<!-- FOOTER -->
<footer class="footer">
  <div>
    <a href="/" class="footer-logo">
      <div class="footer-logo-icon">🤖</div>
      AI Creator Marketplace
    </a>
    <p class="footer-tagline">Build and Scale Your AI Creator Income</p>
    <span style="color:#374151;font-size:20px">✉</span>
  </div>
  <div class="footer-col">
    <h4>Platform</h4>
    <ul>
      <li><a href="${ctaUrl}/features" target="_blank">Features</a></li>
      <li><a href="${ctaUrl}/pricing" target="_blank">Pricing</a></li>
      <li><a href="${ctaUrl}/creators" target="_blank">Browse Creators</a></li>
      <li><a href="${ctaUrl}/community" target="_blank">Community</a></li>
    </ul>
  </div>
  <div class="footer-col">
    <h4>Legal</h4>
    <ul>
      <li><a href="${ctaUrl}/terms" target="_blank">Terms of Use</a></li>
      <li><a href="${ctaUrl}/privacy" target="_blank">Privacy Policy</a></li>
      <li><a href="${ctaUrl}/affiliates" target="_blank">Affiliate Program</a></li>
    </ul>
  </div>
</footer>
<div class="footer-bottom">
  <p>© ${new Date().getFullYear()} AI Creator Marketplace · All rights reserved</p>
</div>

<script>
  async function mpSubmitLead(e) {
    e.preventDefault();
    const email = document.getElementById('mp-lead-email')?.value?.trim();
    if (!email) return;
    const btn = document.getElementById('mp-lead-btn');
    const msg = document.getElementById('mp-lead-msg');
    btn.textContent = 'Submitting…'; btn.disabled = true;
    try {
      await Promise.allSettled([
        fetch('/api/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email }) }),
        fetch('/api/marketplace/lead', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email, campaign_id:'${campaignId}', source: location.href }) }),
      ]);
      if (msg) {
        msg.style.cssText = 'display:block;margin-top:16px;padding:14px;border-radius:10px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e;font-size:14px;font-weight:600';
        msg.textContent = "🎉 You're in! Check your email for next steps.";
      }
      if (e.target) e.target.style.display = 'none';
    } catch {
      btn.textContent = 'Get My Link →'; btn.disabled = false;
    }
  }
</script>
</body>
</html>`;
}

module.exports = { renderMarketplacePage };