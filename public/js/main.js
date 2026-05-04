// Get tracking slug from URL (persisted via cookie by server)
function getRefSlug() {
  const path = window.location.pathname;
  const match = path.match(/^\/r\/(.+)/);
  return match ? match[1] : null;
}

// Load site settings
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

// Load signup count
async function loadCount() {
  try {
    const res = await fetch('/api/count');
    const data = await res.json();
    const el = document.getElementById('signup-count');
    if (data.count > 10) {
      el.textContent = `${data.count.toLocaleString()}+ people registered`;
    }
  } catch (e) {}
}

// Load VSL
async function loadVSL() {
  try {
    const res = await fetch('/api/vsl');
    const data = await res.json();
    const section = document.getElementById('vsl-section');
    const wrapper = document.getElementById('vsl-wrapper');

    if (data.type === 'url' && data.url) {
      let src = data.url;
      // Convert youtube watch URLs to embed
      src = src.replace('youtube.com/watch?v=', 'youtube.com/embed/');
      src = src.replace('youtu.be/', 'youtube.com/embed/');
      // Add autoplay=0, rel=0 params if youtube/vimeo
      wrapper.innerHTML = `<iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      section.style.display = '';
    } else if (data.type === 'file' && data.file) {
      wrapper.innerHTML = `<video src="${data.file}" controls preload="metadata"></video>`;
      section.style.display = '';
    }
    // else: hide section (default)
  } catch (e) {}
}

// Load testimonials
async function loadTestimonials() {
  try {
    const res = await fetch('/api/testimonials');
    const testimonials = await res.json();
    if (!testimonials.length) return;

    const grid = document.getElementById('testimonials-grid');
    const section = document.getElementById('testimonials-section');

    grid.innerHTML = testimonials.filter(t => t.type !== "telegram").map(t => {
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
          ${t.quote ? `<div class="tcard-quote">"${t.quote}"</div>` : ""}
        </div>`;
    }).join('');

    section.style.display = '';
  } catch (e) {}
}

// Handle signup form
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
      msgEl.className = 'success';
      msgEl.textContent = '🎉 ' + (data.message || "You're in! Check your email for details.");
      form.style.display = 'none';
      // Scroll to testimonials
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

// Init
loadSettings();
loadCount();
loadVSL();
loadTestimonials();
