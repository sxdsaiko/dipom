const router   = require('express').Router();
const slugify  = require('slugify');
const { pool } = require('../config/database');
const logger   = require('../config/logger');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate, tripRules }        = require('../middleware/validate');

// ── GET /api/trips  (public feed) ─────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  const { page = 1, limit = 12, country, status, sort = 'created_at' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const allowed = ['created_at','likes_count','views_count','rating'];
  const orderBy = allowed.includes(sort) ? sort : 'created_at';

  try {
    let where = 'WHERE t.is_public = 1';
    const params = [];
    if (country) { where += ' AND c.iso2 = ?'; params.push(country); }
    if (status)  { where += ' AND t.status = ?'; params.push(status); }

    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.slug, t.cover_url, t.start_date, t.end_date,
              t.status, t.rating, t.likes_count, t.views_count, t.comments_count,
              u.username, u.id AS user_id,
              p.first_name, p.last_name, p.avatar_url,
              c.name_ru AS country_name, c.flag_emoji
       FROM trips t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN countries c ON c.id = t.country_id
       ${where}
       ORDER BY t.${orderBy} DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM trips t
       LEFT JOIN countries c ON c.id = t.country_id ${where}`, params
    );

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    logger.error('GET /trips', { err: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── GET /api/trips/my ──────────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  const { status } = req.query;
  try {
    let where = 'WHERE t.user_id = ?';
    const params = [req.user.id];
    if (status) { where += ' AND t.status = ?'; params.push(status); }

    const [rows] = await pool.query(
      `SELECT t.*, c.name_ru AS country_name, c.flag_emoji, ci.name AS city_name,
              (SELECT COUNT(*) FROM trip_photos tp WHERE tp.trip_id = t.id) AS photo_count,
              (SELECT COALESCE(SUM(e.amount_rub),0) FROM expenses e WHERE e.trip_id = t.id) AS spent
       FROM trips t
       LEFT JOIN countries c ON c.id = t.country_id
       LEFT JOIN cities ci   ON ci.id = t.city_id
       ${where}
       ORDER BY t.created_at DESC`, params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── POST /api/trips ────────────────────────────────────────
router.post('/', authenticate, tripRules, validate, async (req, res) => {
  const { title, description, country_id, city_id, start_date, end_date,
          status, rating, mood, total_budget, currency, is_public, goals } = req.body;
  try {
    let slug = slugify(title, { lower: true, strict: true });
    const [exist] = await pool.query(
      'SELECT id FROM trips WHERE user_id = ? AND slug = ?', [req.user.id, slug]
    );
    if (exist.length) slug = `${slug}-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO trips (user_id, title, slug, description, country_id, city_id,
        start_date, end_date, status, rating, mood, total_budget, currency, is_public)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, title, slug, description || null,
       country_id || null, city_id || null,
       start_date || null, end_date || null,
       status || 'planned', rating || null, mood || null,
       total_budget || null, currency || 'RUB',
       is_public ? 1 : 0]
    );

    await pool.query(
      'UPDATE profiles SET trips_count = trips_count + 1 WHERE user_id = ?',
      [req.user.id]
    );

    if (country_id) {
      await pool.query(
        'INSERT IGNORE INTO trip_countries (trip_id, country_id) VALUES (?,?)',
        [result.insertId, country_id]
      );
    }

    logger.info('Trip created', { tripId: result.insertId, userId: req.user.id });
    res.status(201).json({ id: result.insertId, slug });
  } catch (err) {
    logger.error('POST /trips', { err: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── GET /api/trips/:id ────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, c.name_ru AS country_name, c.flag_emoji, c.iso2,
              ci.name AS city_name,
              u.username, u.id AS author_id,
              p.first_name, p.last_name, p.avatar_url
       FROM trips t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN countries c ON c.id = t.country_id
       LEFT JOIN cities ci   ON ci.id = t.city_id
       WHERE t.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Путешествие не найдено' });

    const trip = rows[0];
    if (!trip.is_public && (!req.user || req.user.id !== trip.author_id)) {
      return res.status(403).json({ error: 'Доступ закрыт' });
    }

    // Increment views (async, non-blocking)
    pool.query('UPDATE trips SET views_count = views_count + 1 WHERE id = ?', [trip.id]);

    // Load days & photos
    const [days]   = await pool.query(
      'SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_number', [trip.id]
    );
    const [photos] = await pool.query(
      'SELECT * FROM trip_photos WHERE trip_id = ? ORDER BY sort_order, created_at', [trip.id]
    );
    const [expenses] = await pool.query(
      `SELECT category, SUM(amount_rub) AS total FROM expenses
       WHERE trip_id = ? GROUP BY category`, [trip.id]
    );

    let isLiked = false, isFavorited = false;
    if (req.user) {
      const [[l]] = await pool.query(
        "SELECT 1 FROM likes WHERE user_id=? AND entity='trip' AND entity_id=?",
        [req.user.id, trip.id]
      );
      const [[f]] = await pool.query(
        'SELECT 1 FROM favorites WHERE user_id=? AND trip_id=?', [req.user.id, trip.id]
      );
      isLiked = !!l; isFavorited = !!f;
    }

    res.json({ ...trip, days, photos, expenses, isLiked, isFavorited });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── PUT /api/trips/:id ────────────────────────────────────
router.put('/:id', authenticate, tripRules, validate, async (req, res) => {
  const { title, description, country_id, city_id, start_date, end_date,
          status, rating, mood, total_budget, currency, is_public, cover_url } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT id, user_id FROM trips WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Не найдено' });
    if (rows[0].user_id !== req.user.id && req.user.role === 'user')
      return res.status(403).json({ error: 'Нет прав' });

    await pool.query(
      `UPDATE trips SET title=?, description=?, country_id=?, city_id=?,
       start_date=?, end_date=?, status=?, rating=?, mood=?,
       total_budget=?, currency=?, is_public=?, cover_url=?
       WHERE id=?`,
      [title, description || null, country_id || null, city_id || null,
       start_date || null, end_date || null, status || 'planned',
       rating || null, mood || null, total_budget || null,
       currency || 'RUB', is_public ? 1 : 0, cover_url || null,
       req.params.id]
    );
    res.json({ message: 'Обновлено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── DELETE /api/trips/:id ─────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, user_id FROM trips WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Не найдено' });
    if (rows[0].user_id !== req.user.id && req.user.role === 'user')
      return res.status(403).json({ error: 'Нет прав' });

    await pool.query('DELETE FROM trips WHERE id = ?', [req.params.id]);
    await pool.query(
      'UPDATE profiles SET trips_count = GREATEST(0, trips_count - 1) WHERE user_id = ?',
      [req.user.id]
    );
    logger.info('Trip deleted', { tripId: req.params.id, userId: req.user.id });
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── POST /api/trips/:id/like ──────────────────────────────
router.post('/:id/like', authenticate, async (req, res) => {
  const tripId = parseInt(req.params.id);
  try {
    const [exist] = await pool.query(
      "SELECT id FROM likes WHERE user_id=? AND entity='trip' AND entity_id=?",
      [req.user.id, tripId]
    );
    if (exist.length) {
      await pool.query(
        "DELETE FROM likes WHERE user_id=? AND entity='trip' AND entity_id=?",
        [req.user.id, tripId]
      );
      await pool.query(
        'UPDATE trips SET likes_count = GREATEST(0, likes_count-1) WHERE id=?', [tripId]
      );
      return res.json({ liked: false });
    }
    await pool.query(
      "INSERT INTO likes (user_id, entity, entity_id) VALUES (?,'trip',?)",
      [req.user.id, tripId]
    );
    await pool.query('UPDATE trips SET likes_count = likes_count+1 WHERE id=?', [tripId]);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── POST /api/trips/:id/favorite ──────────────────────────
router.post('/:id/favorite', authenticate, async (req, res) => {
  const tripId = parseInt(req.params.id);
  try {
    const [exist] = await pool.query(
      'SELECT 1 FROM favorites WHERE user_id=? AND trip_id=?', [req.user.id, tripId]
    );
    if (exist.length) {
      await pool.query('DELETE FROM favorites WHERE user_id=? AND trip_id=?', [req.user.id, tripId]);
      return res.json({ favorited: false });
    }
    await pool.query('INSERT INTO favorites (user_id, trip_id) VALUES (?,?)', [req.user.id, tripId]);
    res.json({ favorited: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── GET /api/trips/:id/comments ───────────────────────────
router.get('/:id/comments', optionalAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.username, p.first_name, p.last_name, p.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE c.trip_id = ? AND c.is_deleted = 0 AND c.parent_id IS NULL
       ORDER BY c.created_at DESC`, [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── POST /api/trips/:id/comments ──────────────────────────
router.post('/:id/comments', authenticate, async (req, res) => {
  const { content, parent_id } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Текст комментария обязателен' });
  try {
    const [result] = await pool.query(
      'INSERT INTO comments (user_id, trip_id, parent_id, content) VALUES (?,?,?,?)',
      [req.user.id, req.params.id, parent_id || null, content.trim()]
    );
    await pool.query(
      'UPDATE trips SET comments_count = comments_count + 1 WHERE id = ?', [req.params.id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Trip Days CRUD ─────────────────────────────────────────
router.get('/:id/days', authenticate, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_number', [req.params.id]
  );
  res.json(rows);
});

router.post('/:id/days', authenticate, async (req, res) => {
  const { day_number, date, title, content, city_id, weather, mood } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO trip_days (trip_id, day_number, date, title, content, city_id, weather, mood)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.params.id, day_number, date || null, title || null,
       content || null, city_id || null, weather || null, mood || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id/days/:dayId', authenticate, async (req, res) => {
  const { title, content, weather, mood } = req.body;
  await pool.query(
    'UPDATE trip_days SET title=?, content=?, weather=?, mood=? WHERE id=? AND trip_id=?',
    [title, content, weather, mood, req.params.dayId, req.params.id]
  );
  res.json({ message: 'Обновлено' });
});

module.exports = router;
