/* ═══════════════════════════════════════════════════
   WanderLog — Client-side validation & limits
   Подключается на все страницы с формами
   ═══════════════════════════════════════════════════ */

// ── Глобальные лимиты (совпадают с БД) ────────────
const LIMITS = {
  title:       255,
  short_text:  100,
  name:        60,
  username:    30,
  bio:         500,
  description: 5000,
  note:        1000,
  comment:     2000,
  url:         500,
  address:     500,
  caption:     500,
  email:       255,
  password_max:255,
  city:        100,
  weather:     100,
  currency:    3,
  year_min:    1900,
  year_max:    new Date().getFullYear() + 10,
};

// ── Attach limits to all inputs on page load ────────
document.addEventListener('DOMContentLoaded', () => {
  applyAllLimits();
  applyYearInputs();
  applyNumberSanitize();
});

// ── Apply maxlength where not already set ───────────
function applyAllLimits() {
  // title inputs
  document.querySelectorAll('input[id*="title"], input[id*="name"]').forEach(el => {
    if (!el.maxLength || el.maxLength < 0 || el.maxLength > LIMITS.title)
      el.maxLength = LIMITS.title;
  });
  // description / content textareas
  document.querySelectorAll('textarea[id*="desc"], textarea[id*="content"], textarea[id*="about"]').forEach(el => {
    if (!el.maxLength || el.maxLength > LIMITS.description)
      el.maxLength = LIMITS.description;
  });
  // bio
  document.querySelectorAll('textarea[id*="bio"], input[id*="bio"]').forEach(el => {
    el.maxLength = LIMITS.bio;
  });
  // comment
  document.querySelectorAll('textarea[id*="comment"], #commentText').forEach(el => {
    el.maxLength = LIMITS.comment;
  });
  // note
  document.querySelectorAll('input[id*="note"], textarea[id*="note"]').forEach(el => {
    el.maxLength = LIMITS.note;
  });
  // URL / website
  document.querySelectorAll('input[type="url"], input[id*="website"], input[id*="url"]').forEach(el => {
    el.maxLength = LIMITS.url;
  });
  // email
  document.querySelectorAll('input[type="email"]').forEach(el => {
    el.maxLength = LIMITS.email;
  });
  // caption
  document.querySelectorAll('input[id*="caption"]').forEach(el => {
    el.maxLength = LIMITS.caption;
  });
  // address
  document.querySelectorAll('input[id*="address"]').forEach(el => {
    el.maxLength = LIMITS.address;
  });
}

// ── Year inputs: max 4 digits, valid range ──────────
function applyYearInputs() {
  // Ищем все number-инпуты с id/placeholder содержащим "year"
  document.querySelectorAll('input[type="number"][id*="year"], input[type="number"][placeholder*="год"], input[type="number"][placeholder*="Год"]').forEach(el => {
    enforceYear(el);
  });

  // Глобальный обработчик для любых year-полей добавленных динамически
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.tagName !== 'INPUT') return;
    const isYear = t.id?.includes('year') || t.placeholder?.toLowerCase().includes('год') || t.placeholder?.toLowerCase().includes('year');
    if (isYear && t.type === 'number') enforceYear(t);
  }, { passive: true });
}

function enforceYear(input) {
  input.min  = String(LIMITS.year_min);
  input.max  = String(LIMITS.year_max);

  input.addEventListener('input', () => {
    // Обрезать до 4 цифр
    let val = input.value.replace(/\D/g, '').slice(0, 4);
    if (val && parseInt(val) > LIMITS.year_max) val = String(LIMITS.year_max);
    if (val.length === 4 && parseInt(val) < LIMITS.year_min) val = String(LIMITS.year_min);
    input.value = val;
  });

  input.addEventListener('keydown', e => {
    // Запретить ввод больше 4 символов
    const cur = input.value.replace(/\D/g, '');
    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'];
    if (cur.length >= 4 && /^\d$/.test(e.key) && !allowed.includes(e.key)) {
      e.preventDefault();
    }
  });
}

// ── Sanitize number inputs: prevent crazy values ────
function applyNumberSanitize() {
  document.querySelectorAll('input[type="number"]').forEach(el => {
    // Budget/amount: не может быть отрицательным или > 999 999 999
    if (el.id?.includes('budget') || el.id?.includes('amount') || el.id?.includes('price')) {
      el.min = '0';
      el.addEventListener('input', () => {
        let val = parseFloat(el.value);
        if (isNaN(val) || val < 0) el.value = '';
        else if (val > 999999999) el.value = '999999999';
      });
    }
  });
}

// ── Live char counter helper ─────────────────────────
// Usage: <input oninput="liveCount(this, 'myCounterId', 255)">
function liveCount(input, counterId, max) {
  const el = document.getElementById(counterId);
  if (!el) return;
  const len = input.value.length;
  el.textContent = `${len}/${max}`;
  el.style.color = len > max * 0.9 ? 'var(--rust)' : len > max * 0.75 ? '#c9a96e' : 'var(--mist)';
}

// ── Form field validation helpers ───────────────────
const V = {
  required(val, fieldName) {
    if (!val?.trim()) throw `Поле «${fieldName}» обязательно`;
  },
  maxLen(val, max, fieldName) {
    if (val && val.length > max) throw `«${fieldName}»: максимум ${max} символов`;
  },
  minLen(val, min, fieldName) {
    if (val && val.length < min) throw `«${fieldName}»: минимум ${min} символов`;
  },
  year(val, fieldName = 'Год') {
    if (!val) return;
    const n = parseInt(val);
    if (isNaN(n) || String(val).length > 4) throw `«${fieldName}»: введите корректный год`;
    if (n < LIMITS.year_min || n > LIMITS.year_max) throw `«${fieldName}»: год от ${LIMITS.year_min} до ${LIMITS.year_max}`;
  },
  email(val) {
    if (!val) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) throw 'Введите корректный email';
  },
  url(val) {
    if (!val) return;
    if (!val.startsWith('http://') && !val.startsWith('https://')) throw 'URL должен начинаться с http:// или https://';
  },
  number(val, { min, max, fieldName = 'Число' } = {}) {
    if (!val && val !== 0) return;
    const n = parseFloat(val);
    if (isNaN(n)) throw `«${fieldName}»: введите число`;
    if (min !== undefined && n < min) throw `«${fieldName}»: минимум ${min}`;
    if (max !== undefined && n > max) throw `«${fieldName}»: максимум ${max}`;
  },
};

// ── Global error display for forms ──────────────────
function showFormError(msg, alertId = 'formAlert') {
  const el = document.getElementById(alertId);
  if (!el) { toast(msg, 'error'); return; }
  el.textContent = msg;
  el.className = 'form-alert form-alert--error';
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideFormError(alertId = 'formAlert') {
  const el = document.getElementById(alertId);
  if (el) el.style.display = 'none';
}

// ── Trim all inputs on submit ────────────────────────
function trimFormInputs(formEl) {
  if (!formEl) return;
  formEl.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(el => {
    el.value = el.value.trim();
  });
}

// ── Date validation ──────────────────────────────────
function validateDateRange(startId, endId) {
  const s = document.getElementById(startId)?.value;
  const e = document.getElementById(endId)?.value;
  if (s && e && new Date(s) > new Date(e)) {
    throw 'Дата окончания не может быть раньше даты начала';
  }
}
