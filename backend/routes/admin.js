const router = require('express').Router();
const { pool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

// All admin routes require admin role
router.use(authenticate, requireRole('admin', 'moderator'));

// ── Dashboard stats ────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const [[users]]    = await pool.query('SELECT COUNT(*) AS total FROM users');
  const [[trips]]    = await pool.query('SELECT COUNT(*) AS total FROM trips');
  const [[photos]]   = await pool.query('SELECT COUNT(*) AS total FROM trip_photos');
  const [[comments]] = await pool.query('SELECT COUNT(*) AS total FROM comments');
  const [[reports]]  = await pool.query("SELECT COUNT(*) AS total FROM reports WHERE status='pending'");

  const [newUsers] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at) ORDER BY date`
  );
  const [topTrips] = await pool.query(
    `SELECT t.id, t.title, t.views_count, t.likes_count, u.username
     FROM trips t JOIN users u ON u.id=t.user_id
     ORDER BY t.views_count DESC LIMIT 10`
  );
  res.json({
    counts: { users: users.total, trips: trips.total, photos: photos.total,
               comments: comments.total, pending_reports: reports.total },
    newUsers, topTrips
  });
});

// ── Users management ──────────────────────────────────────
router.get('/users', async (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;
  const offset = (parseInt(page)-1) * parseInt(limit);
  let where = 'WHERE 1=1';
  const params = [];
  if (search) { where += ' AND (u.email LIKE ? OR u.username LIKE ?)'; params.push(`%${search}%`,`%${search}%`); }
  if (role)   { where += ' AND u.role = ?'; params.push(role); }

  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.username, u.role, u.is_verified, u.last_login, u.created_at,
            p.first_name, p.last_name, p.trips_count, p.photos_count
     FROM users u LEFT JOIN profiles p ON p.user_id=u.id
     ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );
  const [[{total}]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u ${where}`, params
  );
  res.json({ data: rows, total, page: parseInt(page) });
});

router.put('/users/:id/role', requireRole('admin'), async (req, res) => {
  const { role } = req.body;
  if (!['user','moderator','admin'].includes(role))
    return res.status(400).json({ error: 'Неверная роль' });
  await pool.query('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
  res.json({ message: 'Роль обновлена' });
});

router.delete('/users/:id', requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ message: 'Пользователь удалён' });
});

// ── Reports management ────────────────────────────────────
router.get('/reports', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.*, u.username AS reporter, u2.username AS resolver
     FROM reports r
     JOIN users u ON u.id=r.reporter_id
     LEFT JOIN users u2 ON u2.id=r.resolved_by
     ORDER BY r.created_at DESC LIMIT 100`
  );
  res.json(rows);
});

router.put('/reports/:id', async (req, res) => {
  const { status } = req.body;
  await pool.query(
    'UPDATE reports SET status=?, resolved_by=?, resolved_at=NOW() WHERE id=?',
    [status, req.user.id, req.params.id]
  );
  res.json({ message: 'Обновлено' });
});

// ── Content moderation ────────────────────────────────────
router.get('/trips', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.title, t.is_public, t.status, t.views_count, t.created_at,
            u.username, u.email
     FROM trips t JOIN users u ON u.id=t.user_id
     ORDER BY t.created_at DESC LIMIT 100`
  );
  res.json(rows);
});

router.delete('/trips/:id', async (req, res) => {
  await pool.query('DELETE FROM trips WHERE id=?', [req.params.id]);
  res.json({ message: 'Путешествие удалено' });
});

router.delete('/comments/:id', async (req, res) => {
  await pool.query('UPDATE comments SET is_deleted=1 WHERE id=?', [req.params.id]);
  res.json({ message: 'Комментарий скрыт' });
});

// ── Activity log ──────────────────────────────────────────
router.get('/activity', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*, u.username FROM activity_log a
     LEFT JOIN users u ON u.id=a.user_id
     ORDER BY a.created_at DESC LIMIT 200`
  );
  res.json(rows);
});

module.exports = router;
