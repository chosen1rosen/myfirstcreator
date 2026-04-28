# myfirstcreator.ai

Landing page + admin dashboard for myfirstcreator.ai.

## Stack
- Node.js + Express
- SQLite (zero-config database)
- Vanilla HTML/CSS/JS

## Setup

```bash
cp .env.example .env
# Edit .env with your settings

npm install
npm start
```

## Deploy (Railway — recommended)

1. Push to GitHub: `chosen1rosen/myfirstcreator`
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables from `.env`
4. Railway gives you a URL — point GoDaddy DNS there

## Deploy (Render)

1. Push to GitHub
2. [render.com](https://render.com) → New Web Service → connect repo
3. Start command: `npm start`
4. Add env vars

## GoDaddy DNS Setup

1. Log into GoDaddy → Manage DNS for myfirstcreator.ai
2. Add/edit the A record to point to your server IP, OR
3. If using Railway/Render, add a CNAME record pointing to their domain

## Admin

Visit `/admin` → login with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from your .env

**Admin features:**
- 📊 Dashboard — live stats (signups, visitors, top sources)
- 📧 Signups — full list with IP, timestamp, tracking source, search & filter
- 🎬 VSL — paste YouTube/Vimeo URL or upload video file
- 💬 Testimonials — add/hide/delete with photo upload
- 🔗 Tracking Links — create slugs (e.g. `/r/instagram`), track visits + signup conversion
- ⚙️ Settings — edit headline, sub-headline, CTA button text, signup count offset

## Tracking Links

Create a slug like `instagram` → share `myfirstcreator.ai/r/instagram`
- Tracks every click (IP, user agent, timestamp)
- Attributes email signups to the source
- Dashboard shows visits + conversions + CVR per link
