const jwt    = require('jsonwebtoken');
const { pool } = require('../config/database');

// ── Verify JWT ─────────────────────────────────────────────
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ error: 'Токен авторизации не предоставлен' });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      'SELECT id, email, username, role, is_verified FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'Пользователь не найден' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Токен истёк', expired: true });
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

// ── Optional auth (public + private routes) ────────────────
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT id, email, username, role FROM users WHERE id = ?',
      [decoded.id]
    );
    if (rows.length) req.user = rows[0];
  } catch (_) {}
  next();
}

// ── Role guard ─────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Доступ запрещён' });
    next();
  };
}

// ── Generate tokens ────────────────────────────────────────
function generateTokens(user) {
  const payload = { id: user.id, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET + '_refresh', {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d',
  });
  return { accessToken, refreshToken };
}

module.exports = { authenticate, optionalAuth, requireRole, generateTokens };
