function getRefSlug() {
  const path = window.location.pathname;
  const match = path.match(/^\/r\/(.+)/);
  return match ? match[1] : null;
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.headline) document.getElementById('hero-headline').innerHTML = data.headline.replace(/\n/g, '<br>');
    if (data.subheadline) document.getElementById('hero-sub').textContent = data.subheadline;
    if (data.cta) {
      document.getElementById('hero-cta').textContent = data.cta + ' →';
      document.getElementById('hero-cta-btn').textContent = data.cta + ' →';
    }
  } catch (e) {}
}

async function loadCount() {
  try {
    const res = await fetch('/api/count');
    const data = await res.json();
    const el = document.getElementById('signup-count');
    if (el && data.count > 10) el.textContent = `${data.count.toLocaleString()}+ people registered`;
  } catch (e) {}
}

function showUnmuteOverlay(container, onUnmute) {
  var btn = document.createElement('button');
  btn.textContent = '🔊 Tap to Unmute';
  btn.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;border:2px solid #fff;border-radius:999px;padding:10px 22px;font-size:15px;font-weight:700;cursor:pointer;z-index:20;white-space:nowrap;backdrop-filter:blur(4px)';
  btn.onclick = function () { onUnmute(); btn.remove(); };
  var wrap = container.querySelector('.vsl-wrapper') || container;
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  wrap.appendChild(btn);
}

function loadYouTubePlayer(videoId, wrapper) {
  var uid = 'yt_' + Math.random().toString(36).slice(2, 8);
  var div = document.createElement('div');
  div.id = uid;
  wrapper.appendChild(div);

  function initPlayer() {
    new YT.Player(uid, {
      videoId: videoId,
      playerVars: { rel: 0, modestbranding: 1, autoplay: 1, mute: 1, playsinline: 1 },
      events: {
        onReady: function (event) {
          setTimeout(function () {
            event.target.unMute();
            event.target.setVolume(100);
            setTimeout(function () {
              if (event.target.isMuted()) {
                showUnmuteOverlay(wrapper.parentElement || wrapper, function () {
                  event.target.unMute();
                  event.target.setVolume(100);
                });
              }
            }, 400);
          }, 2000);
        }
      }
    });
  }

  if (window.YT && window.YT.Player) {
    initPlayer();
  } else {
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () { if (prev) prev(); initPlayer(); };
  }
}

async function loadVSL() {
  try {
    const res = await fetch('/api/vsl');
    const data = await res.json();
    const section = document.getElementById('vsl-section');
    const wrapper = document.getElementById('vsl-wrapper');
    if (!section || !wrapper) return;

    if (data.type === 'url' && data.url) {
      let src = data.url;
      src = src.replace('youtube.com/watch?v=', 'youtube.com/embed/');
      src = src.replace('youtu.be/', 'youtube.com/embed/');

      const ytMatch = src.match(/youtube\.com\/embed\/([^?&]+)/);
      if (ytMatch) {
        section.style.display = '';
        loadYouTubePlayer(ytMatch[1], wrapper);
      } else {
        // Vimeo or other embed — add autoplay param
        src += (src.includes('?') ? '&' : '?') + 'autoplay=1&muted=0';
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.frameBorder = '0';
        iframe.allow = 'autoplay; encrypted-media; fullscreen';
        iframe.allowFullscreen = true;
        wrapper.appendChild(iframe);
        section.style.display = '';
      }
    } else if (data.type === 'file' && data.file) {
      const video = document.createElement('video');
      video.src = data.file;
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.addEventListener('loadedmetadata', function () { video.currentTime = 0.001; });
      wrapper.appendChild(video);
      section.style.display = '';

      setTimeout(function () {
        video.muted = true; // must start muted for Chrome autoplay policy
        video.play().then(function () {
          video.muted = false; // try to unmute after play starts
          video.volume = 1;
          setTimeout(function () {
            if (video.muted) {
              // Chrome kept it muted — show overlay
              showUnmuteOverlay(wrapper.parentElement || wrapper, function () {
                video.muted = false;
                video.volume = 1;
              });
            }
          }, 300);
        }).catch(function () {
          // Autoplay blocked entirely — leave paused with thumbnail visible
        });
      }, 2000);
    }
  } catch (e) {}
}

async function loadTestimonials() {
  try {
    const res = await fetch('/api/testimonials');
    const testimonials = await res.json();
    if (!testimonials.length) return;

    const grid = document.getElementById('testimonials-grid');
    const section = document.getElementById('testimonials-section');

    grid.innerHTML = testimonials.filter(t => t.type !== 'telegram').map(t => {
      const initial = t.name.charAt(0).toUpperCase();
      const avatar = t.image_path
        ? `<div class="tcard-avatar"><img src="${t.image_path}" alt="${t.name}"></div>`
        : `<div class="tcard-avatar">${initial}</div>`;
      return `
      <div class="tcard">
        <div class="tcard-header">
          ${avatar}
          <div>
            <div class="tcard-name">${t.name}</div>
            ${t.handle ? `<div class="tcard-handle">${t.handle}</div>` : ''}
          </div>
        </div>
        ${t.earnings ? `<div class="tcard-earnings">💰 ${t.earnings}</div>` : ''}
        ${t.quote ? `<div class="tcard-quote">"${t.quote}"</div>` : ''}
      </div>`;
    }).join('');

    section.style.display = '';
  } catch (e) {}
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('hero-cta-btn');
  const msgEl = document.getElementById('form-message');

  const name = form.name.value.trim();
  const email = form.email.value.trim();

  btn.disabled = true;
  btn.textContent = 'Reserving your spot...';

  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });
    const data = await res.json();
    msgEl.style.display = '';
    if (data.success) {
      if (data.redirect) { window.location.href = data.redirect; return; }
      msgEl.className = 'success';
      msgEl.textContent = '🎉 ' + (data.message || "You're in! Check your email for details.");
      form.style.display = 'none';
      setTimeout(() => {
        document.getElementById('testimonials-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 800);
    } else {
      msgEl.className = 'error';
      msgEl.textContent = data.error || 'Something went wrong. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Try Again';
    }
  } catch (err) {
    msgEl.style.display = '';
    msgEl.className = 'error';
    msgEl.textContent = 'Connection error. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Try Again';
  }
});

loadSettings();
loadCount();
loadVSL();
loadTestimonials();
