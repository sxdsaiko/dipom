const { validationResult, body } = require('express-validator');

// ── Collect errors ─────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map(e => ({ field: e.path, msg: e.msg }));
    return res.status(422).json({ error: 'Ошибка валидации', fields: formatted });
  }
  next();
};

// ── Rule sets ──────────────────────────────────────────────
const registerRules = [
  body('email').isEmail().normalizeEmail().withMessage('Некорректный email'),
  body('username')
    .trim().isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username: 3-30 символов, только a-z, 0-9, _'),
  body('password')
    .isLength({ min: 8 }).withMessage('Пароль минимум 8 символов')
    .matches(/[A-Z]/).withMessage('Пароль должен содержать заглавную букву')
    .matches(/[0-9]/).withMessage('Пароль должен содержать цифру'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Некорректный email'),
  body('password').notEmpty().withMessage('Пароль обязателен'),
];

const tripRules = [
  body('title').trim().isLength({ min: 2, max: 255 }).withMessage('Название: 2-255 символов'),
  body('status').optional().isIn(['planned','ongoing','completed']),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('start_date').optional().isDate(),
  body('end_date').optional().isDate(),
];

const commentRules = [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Комментарий: 1-2000 символов'),
];

const expenseRules = [
  body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Название обязательно'),
  body('amount').isFloat({ gt: 0 }).withMessage('Сумма должна быть положительной'),
  body('category').isIn(['accommodation','food','transport','activities','shopping','health','visa','insurance','other']),
];

module.exports = { validate, registerRules, loginRules, tripRules, commentRules, expenseRules };
