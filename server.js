require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const publicRouter = require('./routes/public');
const adminRouter = require('./routes/admin');
const superAdminRouter = require('./routes/superadmin');
const { router: addcalRouter } = require('./routes/addcal');

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Cookie-based session — survives across Vercel serverless instances
app.use(cookieSession({
  name: 'mfc_sess',
  keys: [process.env.SESSION_SECRET || 'mfc-secret-change-this'],
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production'
}));

// Shim so req.session.destroy() still works (used in logout)
app.use((req, res, next) => {
  if (req.session && !req.session.destroy) {
    req.session.destroy = (cb) => { req.session = null; if (cb) cb(); };
  }
  next();
});

// Public router first — catches / for variant serving before static fallback
app.use('/', publicRouter);
app.use('/admin', adminRouter);
app.use('/admin/events', addcalRouter);

const marketplaceRouter = require('./routes/marketplace');
app.use('/api/marketplace', marketplaceRouter);
app.use('/superadmin', superAdminRouter);

// Static files — fallback for CSS/JS/images and index.html when no variant is set
app.use(express.static(path.join(__dirname, 'public')));

// For local dev
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`✅ myfirstcreator.ai running on port ${PORT}`));
}

module.exports = app;
