const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { pool } = require('../config/database');
const logger   = require('../config/logger');
const { generateTokens, authenticate } = require('../middleware/auth');
const { validate, registerRules, loginRules } = require('../middleware/validate');

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', registerRules, validate, async (req, res) => {
  const { email, username, password, first_name, last_name } = req.body;
  try {
    const [exist] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?', [email, username]
    );
    if (exist.length) return res.status(409).json({ error: 'Email или username уже занят' });

    const hash         = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS) || 12);
    const verifyToken  = crypto.randomBytes(32).toString('hex');

    const [result] = await pool.query(
      `INSERT INTO users (email, username, password_hash, verify_token) VALUES (?,?,?,?)`,
      [email, username, hash, verifyToken]
    );
    const userId = result.insertId;

    await pool.query(
      `INSERT INTO profiles (user_id, first_name, last_name) VALUES (?,?,?)`,
      [userId, first_name || null, last_name || null]
    );

    const user = { id: userId, role: 'user' };
    const { accessToken, refreshToken } = generateTokens(user);

    logger.info('User registered', { userId, email });
    res.status(201).json({
      message: 'Аккаунт создан',
      accessToken, refreshToken,
      user: { id: userId, email, username, role: 'user' },
    });
  } catch (err) {
    logger.error('Register error', { err: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', loginRules, validate, async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.username, u.role, u.password_hash, u.is_verified,
              p.first_name, p.last_name, p.avatar_url
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.email = ?`, [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Неверный email или пароль' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Неверный email или пароль' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const { accessToken, refreshToken } = generateTokens(user);
    const { password_hash, ...safeUser } = user;

    logger.info('User login', { userId: user.id });
    res.json({ accessToken, refreshToken, user: safeUser });
  } catch (err) {
    logger.error('Login error', { err: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── POST /api/auth/refresh ─────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Токен не предоставлен' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET + '_refresh');
    const [rows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [decoded.id]);
    if (!rows.length) return res.status(401).json({ error: 'Пользователь не найден' });
    const { accessToken, refreshToken: newRefresh } = generateTokens(rows[0]);
    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Недействительный refresh токен' });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.json({ message: 'Если email найден, письмо отправлено' });

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600_000); // 1 hour
    await pool.query(
      'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [token, expires, rows[0].id]
    );
    // Email sending omitted (configure nodemailer separately)
    logger.info('Password reset requested', { userId: rows[0].id });
    res.json({ message: 'Если email найден, письмо отправлено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Нет данных' });
  try {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()', [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Токен недействителен или истёк' });

    const hash = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS) || 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [hash, rows[0].id]
    );
    res.json({ message: 'Пароль обновлён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.username, u.role, u.is_verified,
              p.first_name, p.last_name, p.avatar_url, p.cover_url, p.bio,
              p.location, p.website, p.gender, p.birth_date,
              p.countries_count, p.trips_count, p.photos_count,
              p.followers_count, p.following_count, p.is_public
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?`, [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
