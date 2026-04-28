require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const publicRouter = require('./routes/public');
const adminRouter = require('./routes/admin');

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mfc-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, sameSite: 'lax' }
}));

app.use('/', publicRouter);
app.use('/admin', adminRouter);

// For local dev
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`✅ myfirstcreator.ai running on port ${PORT}`));
}

module.exports = app;
