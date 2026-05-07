/* ═══════════════════════════════════════════════════
   WanderLog — Main JS
   ═══════════════════════════════════════════════════ */

// Auto-detect API URL: если frontend открыт через Live Server (5500) или :3000,
// backend всё равно на :5000 того же хоста
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : 'https://dipom-production.up.railway.app/api';

// ── Auth helper ────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('wl_token'),
  setToken: (t) => localStorage.setItem('wl_token', t),
  getUser:  () => JSON.parse(localStorage.getItem('wl_user') || 'null'),
  setUser:  (u) => localStorage.setItem('wl_user', JSON.stringify(u)),
  logout:   () => { localStorage.removeItem('wl_token'); localStorage.removeItem('wl_user'); window.location = '/index.html'; },
  headers:  () => ({ 'Content-Type': 'application/json', ...(localStorage.getItem('wl_token') ? { Authorization: `Bearer ${localStorage.getItem('wl_token')}` } : {}) }),
};

// ── API fetch ──────────────────────────────────────
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      headers: Auth.headers(),
      ...options,
    });
    // Handle non-JSON responses
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await res.json().catch(() => ({}))
      : {};
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch(e) {
    if (e.status) throw e; // re-throw API errors
    // Network error
    const netErr = new Error('Нет соединения с сервером. Убедитесь, что backend запущен.');
    netErr.status = 0;
    throw netErr;
  }
}

// ── Toast ──────────────────────────────────────────
function toast(msg, type = 'default') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span>${type==='success'?'✓':type==='error'?'✕':'ℹ'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.animation = 'none'; el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = 'all 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ── Custom cursor ──────────────────────────────────
const cursor    = document.getElementById('cursor');
const cursorDot = document.getElementById('cursorDot');
if (cursor) {
  let mx = 0, my = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  function animCursor() {
    cx += (mx - cx) * 0.12;
    cy += (my - cy) * 0.12;
    cursor.style.left = cx + 'px';
    cursor.style.top  = cy + 'px';
    if (cursorDot) { cursorDot.style.left = mx + 'px'; cursorDot.style.top = my + 'px'; }
    requestAnimationFrame(animCursor);
  }
  animCursor();
}

// ── Nav scroll ─────────────────────────────────────
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ── Particle canvas hero ───────────────────────────
const canvas = document.getElementById('particleCanvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 1.5 + 0.5;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.a  = Math.random() * 0.6 + 0.1;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201,169,110,${this.a})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 120; i++) particles.push(new Particle());

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });

    // Connect nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(201,169,110,${0.15 * (1 - dist/100)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(drawParticles);
  }
  drawParticles();
}

// ── Counter animation ──────────────────────────────
function animateCounter(el, target, duration = 2000) {
  const start = performance.now();
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.floor(ease * target).toLocaleString('ru');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Intersection Observer ──────────────────────────
const io = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      // Counter
      const num = entry.target.querySelector('[data-target]') || (entry.target.dataset.target ? entry.target : null);
      if (num && num.dataset.target) {
        animateCounter(num, parseInt(num.dataset.target));
      }
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
document.querySelectorAll('.hero__stat-num').forEach(el => {
  const target = parseInt(el.dataset.target);
  // Trigger after short delay
  setTimeout(() => animateCounter(el, target, 2500), 800);
});

// ── Mini Leaflet maps ──────────────────────────────
function initMiniMap() {
  const el = document.getElementById('miniMap');
  if (!el || !window.L) return;
  const map = L.map('miniMap', { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {}).addTo(map);
  map.setView([48, 20], 3);

  // Sample visited countries markers
  const points = [[48.8566,2.3522,'🇫🇷 Париж'],[41.9028,12.4964,'🇮🇹 Рим'],[35.6762,139.6503,'🇯🇵 Токио'],[13.7563,100.5018,'🇹🇭 Бангкок']];
  points.forEach(([lat,lng,title]) => {
    L.circleMarker([lat,lng], { radius: 6, fillColor: '#c9a96e', color: '#fff', weight: 2, fillOpacity: 0.9 })
     .bindPopup(title).addTo(map);
  });
}

function initWorldMap() {
  const el = document.getElementById('worldMap');
  if (!el || !window.L) return;
  const map = L.map('worldMap', { zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {}).addTo(map);
  map.setView([30, 20], 2);
}

if (window.L) {
  initMiniMap();
  initWorldMap();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    initMiniMap();
    initWorldMap();
  });
}

// ── Trips feed ─────────────────────────────────────
const MOCK_TRIPS = []; // данные загружаются из API

function renderStars(r) {
  if (!r) return '';
  return '★'.repeat(r) + '☆'.repeat(5-r);
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru', { day:'numeric', month:'short', year:'numeric' });
}
function statusLabel(s) {
  const m = { completed:'Завершено', planned:'Запланировано', ongoing:'В процессе' };
  return m[s] || s;
}

function renderTrips(trips) {
  const grid = document.getElementById('tripsGrid');
  if (!grid) return;
  grid.innerHTML = trips.map(t => {
    // Support both API format and explore format
    const id        = t.id;
    const title     = t.title;
    const cover     = t.cover_url || t.cover || '';
    const status    = t.status;
    const rating    = t.rating;
    const country   = t.country_name || t.country || '';
    const flag      = t.flag_emoji || '';
    const start     = t.start_date || t.start || '';
    const end       = t.end_date   || t.end   || '';
    const authorName = t.first_name
      ? `${t.first_name} ${t.last_name||''}`.trim()
      : (t.username || t.author || '—');
    const initials  = typeof getInitials === 'function'
      ? getInitials(t.first_name, t.last_name, t.username || t.author)
      : (authorName||'WL').slice(0,2).toUpperCase();
    const avatarSrc = t.avatar_url
      ? t.avatar_url
      : (typeof makeAvatarSVG === 'function' ? makeAvatarSVG(initials, 40) : '');
    const likes  = t.likes_count ?? t.likes ?? 0;
    const views  = t.views_count ?? t.views ?? 0;
    return `
      <div class="trip-card" onclick="location.href='pages/trip.html?id=${id}'">
        <div class="trip-card__img" style="${!cover?'background:linear-gradient(135deg,var(--slate),var(--ink))':''};height:200px">
          ${cover
            ? `<img src="${cover}" alt="${title}" loading="lazy" onerror="this.style.display='none'">`
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem">${flag||'🌍'}</div>`}
          <span class="trip-card__status trip-card__status--${status}">${statusLabel(status)}</span>
        </div>
        <div class="trip-card__body">
          <div class="trip-card__meta">
            <span class="trip-card__country">${flag} ${country}</span>
            <span class="trip-card__rating">${renderStars(rating)}</span>
          </div>
          <h3 class="trip-card__title">${title}</h3>
          <div class="trip-card__dates">${fmtDate(start)}${end ? ' → ' + fmtDate(end) : ''}</div>
          <div class="trip-card__footer">
            <div class="trip-card__author">
              <img src="${avatarSrc}" alt="${authorName}" style="width:28px;height:28px;border-radius:50%;object-fit:cover"
                   onerror="this.src='${avatarSrc}'">
              <span>${authorName}</span>
            </div>
            <div class="trip-card__stats">
              <span>♥ ${likes}</span>
              <span>◎ ${views}</span>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  // Observe cards
  grid.querySelectorAll('.trip-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 0.08}s`;
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.6s var(--ease-expo), transform 0.6s var(--ease-expo)`;
    setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, i * 80 + 200);
  });
}

// Try to fetch from API, fallback to mock
async function loadTrips() {
  const grid = document.getElementById('tripsGrid');
  if (!grid) return;
  try {
    const data = await apiFetch('/trips?limit=6');
    const trips = data.data || [];
    if (!trips.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--mist)">
        <div style="font-size:3rem;margin-bottom:16px">🌍</div>
        <p style="font-size:1.05rem;margin-bottom:20px">Пока нет публичных путешествий</p>
        <a href="pages/register.html" class="btn btn--primary">Начать своё путешествие</a>
      </div>`;
    } else {
      renderTrips(trips);
    }
  } catch {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--mist)">
      <p>Не удалось загрузить путешествия. Проверьте, запущен ли сервер.</p>
      <button onclick="loadTrips()" class="btn btn--ghost" style="margin-top:12px;padding:9px 20px;font-size:0.85rem">↻ Повторить</button>
    </div>`;
  }
}

// Filter buttons on homepage - reload from API
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    const grid = document.getElementById('tripsGrid');
    if (!grid) return;
    try {
      const qs = filter && filter !== 'all' ? `&status=${filter}` : '';
      const data = await apiFetch(`/trips?limit=6${qs}`);
      const trips = data.data || [];
      if (!trips.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--mist)">
          <p>Нет поездок в этой категории</p>
        </div>`;
      } else {
        renderTrips(trips);
      }
    } catch {
      loadTrips();
    }
  });
});

// ── Mobile nav burger ──────────────────────────────
const burger = document.getElementById('navBurger');
if (burger) {
  burger.addEventListener('click', () => {
    const links = document.querySelector('.nav__links');
    const actions = document.querySelector('.nav__actions');
    if (links) links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
    if (actions) actions.style.display = actions.style.display === 'flex' ? 'none' : 'flex';
  });
}

// ── Sidebar toggle (dashboard) ─────────────────────
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.querySelector('.sidebar');
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}

// ── Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadTrips();

  // Update nav if logged in
  const user = Auth.getUser();
  if (user) {
    const navActions = document.querySelector('.nav__actions');
    if (navActions && navActions.querySelector('[href*="login"]')) {
      // Determine correct path based on current location
      const inPages = window.location.pathname.includes('/pages/');
      const dashHref = inPages ? 'dashboard.html' : 'pages/dashboard.html';
      navActions.innerHTML = `
        <a href="${dashHref}" class="btn btn--ghost">Мой дневник</a>
        <button class="btn btn--primary" onclick="Auth.logout()">Выйти</button>
      `;
    }
  }
});
