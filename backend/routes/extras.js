// ═══════════════════════════════════════════════
//  routes/photos.js
// ═══════════════════════════════════════════════
const photosRouter = require('express').Router();
const { pool }     = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { upload, uploadPhoto } = require('../middleware/upload');

// Upload photo to trip
photosRouter.post('/trips/:tripId/photos', authenticate,
  upload.array('photos', 20), async (req, res) => {
    const tripId = parseInt(req.params.tripId);
    try {
      const [trip] = await pool.query(
        'SELECT id, user_id FROM trips WHERE id = ?', [tripId]
      );
      if (!trip.length || trip[0].user_id !== req.user.id)
        return res.status(403).json({ error: 'Нет доступа' });

      const uploaded = [];
      for (const file of req.files) {
        const result = await uploadPhoto(file.buffer, tripId);
        const [ins] = await pool.query(
          `INSERT INTO trip_photos (trip_id, user_id, url, thumb_url, width, height, size_bytes, caption)
           VALUES (?,?,?,?,?,?,?,?)`,
          [tripId, req.user.id, result.url, result.thumb_url,
           result.width, result.height, file.size, req.body.caption || null]
        );
        uploaded.push({ id: ins.insertId, ...result });
      }

      await pool.query(
        'UPDATE profiles SET photos_count = photos_count + ? WHERE user_id = ?',
        [uploaded.length, req.user.id]
      );

      res.status(201).json(uploaded);
    } catch (err) {
      res.status(500).json({ error: 'Ошибка загрузки: ' + err.message });
    }
  }
);

// Get trip photos
photosRouter.get('/trips/:tripId/photos', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM trip_photos WHERE trip_id = ? ORDER BY sort_order, created_at',
    [req.params.tripId]
  );
  res.json(rows);
});

// Delete photo
photosRouter.delete('/photos/:id', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trip_photos WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Фото не найдено' });
  if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Нет прав' });
  await pool.query('DELETE FROM trip_photos WHERE id = ?', [req.params.id]);
  res.json({ message: 'Удалено' });
});

// ═══════════════════════════════════════════════
//  routes/expenses.js
// ═══════════════════════════════════════════════
const expensesRouter = require('express').Router();
const { validate, expenseRules } = require('../middleware/validate');

expensesRouter.get('/trips/:tripId/expenses', authenticate, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM expenses WHERE trip_id = ? ORDER BY paid_at DESC, created_at DESC',
    [req.params.tripId]
  );
  const [[stats]] = await pool.query(
    `SELECT SUM(amount_rub) AS total,
            COUNT(*) AS count,
            AVG(amount_rub) AS avg_per_item
     FROM expenses WHERE trip_id = ?`, [req.params.tripId]
  );
  const [byCategory] = await pool.query(
    `SELECT category, SUM(amount_rub) AS total, COUNT(*) AS count
     FROM expenses WHERE trip_id = ? GROUP BY category ORDER BY total DESC`,
    [req.params.tripId]
  );
  res.json({ items: rows, stats, byCategory });
});

expensesRouter.post('/trips/:tripId/expenses', authenticate, expenseRules, validate, async (req, res) => {
  const { category, title, amount, currency, paid_at, note, trip_day_id } = req.body;
  // Simple RUB conversion rates (in production, use a live API)
  const rates = { RUB:1, USD:90, EUR:97, GBP:114, TRY:3, THB:2.5 };
  const rate = rates[currency] || 1;
  const amountRub = parseFloat(amount) * rate;

  const [result] = await pool.query(
    `INSERT INTO expenses (trip_id, trip_day_id, category, title, amount, currency, amount_rub, paid_at, note)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [req.params.tripId, trip_day_id || null, category, title,
     parseFloat(amount), currency || 'RUB', amountRub,
     paid_at || null, note || null]
  );
  res.status(201).json({ id: result.insertId });
});

expensesRouter.put('/trips/:tripId/expenses/:id', authenticate, async (req, res) => {
  const { category, title, amount, currency, paid_at, note } = req.body;
  await pool.query(
    'UPDATE expenses SET category=?, title=?, amount=?, currency=?, paid_at=?, note=? WHERE id=? AND trip_id=?',
    [category, title, parseFloat(amount), currency, paid_at||null, note||null, req.params.id, req.params.tripId]
  );
  res.json({ message: 'Обновлено' });
});

expensesRouter.delete('/trips/:tripId/expenses/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id=? AND trip_id=?', [req.params.id, req.params.tripId]);
  res.json({ message: 'Удалено' });
});

// ═══════════════════════════════════════════════
//  routes/users.js
// ═══════════════════════════════════════════════
const usersRouter = require('express').Router();
const { authenticate: auth, optionalAuth } = require('../middleware/auth');
const { upload: upl, uploadAvatar } = require('../middleware/upload');

// Get user profile
usersRouter.get('/:username', optionalAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.created_at,
            p.first_name, p.last_name, p.bio, p.avatar_url, p.cover_url,
            p.location, p.website, p.gender, p.birth_date,
            p.countries_count, p.trips_count,
            p.photos_count, p.followers_count, p.following_count, p.is_public
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.username = ?`, [req.params.username]
  );
  if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });

  const user = rows[0];
  if (!user.is_public && (!req.user || req.user.id !== user.id))
    return res.status(403).json({ error: 'Профиль закрыт' });

  let isFollowing = false;
  if (req.user && req.user.id !== user.id) {
    const [[f]] = await pool.query(
      'SELECT 1 FROM subscriptions WHERE follower_id=? AND following_id=?',
      [req.user.id, user.id]
    );
    isFollowing = !!f;
  }

  const [trips] = await pool.query(
    `SELECT t.id, t.title, t.slug, t.cover_url, t.status,
            t.start_date, t.likes_count, t.views_count, c.flag_emoji, c.name_ru AS country
     FROM trips t LEFT JOIN countries c ON c.id = t.country_id
     WHERE t.user_id = ? AND t.is_public = 1
     ORDER BY t.created_at DESC LIMIT 6`, [user.id]
  );

  res.json({ ...user, trips, isFollowing });
});

// Update profile
usersRouter.put('/me/profile', auth, async (req, res) => {
  const { first_name, last_name, bio, location, website, is_public, gender, birth_date } = req.body;
  // Validate lengths to protect DB
  if (first_name && first_name.length > 60)  return res.status(422).json({ error: 'Имя: макс 60 символов' });
  if (last_name  && last_name.length  > 60)  return res.status(422).json({ error: 'Фамилия: макс 60 символов' });
  if (bio        && bio.length        > 500) return res.status(422).json({ error: 'Bio: макс 500 символов' });
  if (location   && location.length   > 100) return res.status(422).json({ error: 'Город: макс 100 символов' });
  if (website    && website.length    > 500) return res.status(422).json({ error: 'Сайт: макс 500 символов' });

  const validGenders = ['male','female','other','prefer_not'];
  const safeGender   = validGenders.includes(gender) ? gender : null;
  const safeBirth    = birth_date && /^\d{4}-\d{2}-\d{2}$/.test(birth_date) ? birth_date : null;

  try {
    await pool.query(
      `UPDATE profiles
       SET first_name=?, last_name=?, bio=?, location=?, website=?, is_public=?, gender=?, birth_date=?
       WHERE user_id=?`,
      [first_name||null, last_name||null, bio||null, location||null,
       website||null, is_public?1:0, safeGender, safeBirth, req.user.id]
    );
    res.json({ message: 'Профиль обновлён' });
  } catch(err) {
    res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
  }
});

// Upload avatar
usersRouter.post('/me/avatar', auth, upl.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const result = await uploadAvatar(req.file.buffer);
  await pool.query('UPDATE profiles SET avatar_url=? WHERE user_id=?', [result.secure_url, req.user.id]);
  res.json({ avatar_url: result.secure_url });
});

// Follow / unfollow
usersRouter.post('/:id/follow', auth, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Нельзя подписаться на себя' });

  const [exist] = await pool.query(
    'SELECT 1 FROM subscriptions WHERE follower_id=? AND following_id=?', [req.user.id, targetId]
  );
  if (exist.length) {
    await pool.query('DELETE FROM subscriptions WHERE follower_id=? AND following_id=?', [req.user.id, targetId]);
    await pool.query('UPDATE profiles SET following_count=GREATEST(0,following_count-1) WHERE user_id=?', [req.user.id]);
    await pool.query('UPDATE profiles SET followers_count=GREATEST(0,followers_count-1) WHERE user_id=?', [targetId]);
    return res.json({ following: false });
  }
  await pool.query('INSERT INTO subscriptions (follower_id, following_id) VALUES (?,?)', [req.user.id, targetId]);
  await pool.query('UPDATE profiles SET following_count=following_count+1 WHERE user_id=?', [req.user.id]);
  await pool.query('UPDATE profiles SET followers_count=followers_count+1 WHERE user_id=?', [targetId]);
  res.json({ following: true });
});

// Notifications
usersRouter.get('/me/notifications', auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.*, u.username, p.avatar_url FROM notifications n
     LEFT JOIN users u ON u.id = n.from_user
     LEFT JOIN profiles p ON p.user_id = n.from_user
     WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50`, [req.user.id]
  );
  const [[{ unread }]] = await pool.query(
    'SELECT COUNT(*) AS unread FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]
  );
  res.json({ items: rows, unread });
});

usersRouter.post('/me/notifications/read', auth, async (req, res) => {
  await pool.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
  res.json({ message: 'Прочитано' });
});

// Wishlist
usersRouter.get('/me/wishlist', auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT w.*, c.name_ru AS country_name, c.flag_emoji
     FROM wishlist w LEFT JOIN countries c ON c.id = w.country_id
     WHERE w.user_id = ? ORDER BY w.priority DESC, w.created_at DESC`, [req.user.id]
  );
  res.json(rows);
});

usersRouter.post('/me/wishlist', auth, async (req, res) => {
  const { title, description, country_id, city_id, priority, planned_at, budget_est, currency } = req.body;
  const [result] = await pool.query(
    `INSERT INTO wishlist (user_id, title, description, country_id, city_id, priority, planned_at, budget_est, currency)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [req.user.id, title, description||null, country_id||null, city_id||null,
     priority||'medium', planned_at||null, budget_est||null, currency||'RUB']
  );
  res.status(201).json({ id: result.insertId });
});

usersRouter.delete('/me/wishlist/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM wishlist WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ message: 'Удалено' });
});

// Statistics
usersRouter.get('/me/stats', auth, async (req, res) => {
  const [countries] = await pool.query(
    `SELECT DISTINCT c.iso2, c.name_ru, c.flag_emoji
     FROM trips t
     JOIN trip_countries tc ON tc.trip_id = t.id
     JOIN countries c ON c.id = tc.country_id
     WHERE t.user_id = ? AND t.status = 'completed'`, [req.user.id]
  );
  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS total_trips,
            SUM(status='completed') AS completed,
            SUM(status='planned') AS planned,
            SUM(status='ongoing') AS ongoing,
            COALESCE(AVG(rating),0) AS avg_rating
     FROM trips WHERE user_id=?`, [req.user.id]
  );
  const [[spending]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount_rub),0) AS total_spent
     FROM expenses e JOIN trips t ON t.id=e.trip_id WHERE t.user_id=?`, [req.user.id]
  );
  res.json({ countries, totals, ...spending });
});

// Achievements
usersRouter.get('/me/achievements', auth, async (req, res) => {
  const [all] = await pool.query('SELECT * FROM achievements ORDER BY category, points');
  const [earned] = await pool.query(
    'SELECT achievement_id, earned_at FROM user_achievements WHERE user_id=?', [req.user.id]
  );
  const earnedMap = Object.fromEntries(earned.map(e => [e.achievement_id, e.earned_at]));
  const result = all.map(a => ({ ...a, earned: !!earnedMap[a.id], earned_at: earnedMap[a.id] || null }));
  res.json(result);
});

module.exports = { photosRouter, expensesRouter, usersRouter };
