require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const cron        = require('node-cron');
const path        = require('path');

const { testConnection, pool } = require('./config/database');
const logger = require('./config/logger');

const authRouter    = require('./routes/auth');
const tripsRouter   = require('./routes/trips');
const adminRouter   = require('./routes/admin');
const { photosRouter, expensesRouter, usersRouter } = require('./routes/extras');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security ──────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ crossOriginEmbedderPolicy: false }));

const corsOptions = {
  origin: (origin, callback) => {
    // В dev-режиме разрешаем всё: file://, любой localhost-порт, Live Server
    if (!origin || process.env.NODE_ENV !== 'production') return callback(null, true);
    const allowed = (process.env.FRONTEND_URL || '')
      .split(',')
      .map(s => s.trim())
      .concat([
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://127.0.0.1:3000',
    
        'https://dipom.vercel.app',
        'https://dipom-9zkwjx7v6-sxdsaikos-projects.vercel.app',
      ]);
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight для всех маршрутов

// ── Global rate limit ─────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Слишком много запросов, попробуйте позже' },
});
app.use('/api/', limiter);

// Stricter limit for auth (только в production)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 15 : 1000,
  message: { error: 'Превышен лимит попыток авторизации' },
});
app.use('/api/auth/', authLimiter);

// ── Middleware ────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) },
  skip: (req) => req.path === '/api/health',
}));

// ── Activity logger middleware ─────────────────────────────
app.use(async (req, res, next) => {
  const logged = ['POST','PUT','DELETE'];
  if (logged.includes(req.method) && req.path.startsWith('/api/') && req.user) {
    pool.query(
      'INSERT INTO activity_log (user_id, action, ip, user_agent) VALUES (?,?,?,?)',
      [req.user?.id, `${req.method} ${req.path}`,
       req.ip, req.headers['user-agent']?.slice(0,200)]
    ).catch(() => {});
  }
  next();
});

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',    authRouter);
app.use('/api/trips',   tripsRouter);
app.use('/api',         photosRouter);
app.use('/api',         expensesRouter);
app.use('/api/users',   usersRouter);
app.use('/api/admin',   adminRouter);

// Countries endpoint
app.get('/api/countries', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name_ru AS name, iso2, flag_emoji, continent FROM countries ORDER BY name_ru'
  );
  res.json(rows);
});

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() });
});

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack, path: req.path });
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'Файл слишком большой (макс 10MB)' });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Ошибка сервера' : err.message,
  });
});

// ── Cron: cleanup expired reset tokens daily ──────────────
cron.schedule('0 3 * * *', async () => {
  try {
    const [r] = await pool.query(
      'UPDATE users SET reset_token=NULL, reset_expires=NULL WHERE reset_expires < NOW()'
    );
    logger.info(`Cron: cleared ${r.affectedRows} expired reset tokens`);
  } catch (e) {
    logger.error('Cron error', { err: e.message });
  }
});

// ── Boot ──────────────────────────────────────────────────
(async () => {
  await testConnection();
  app.listen(PORT, () => {
    logger.info(`🚀  WanderLog API running on port ${PORT}`);
    logger.info(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  });
})();
