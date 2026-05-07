/* ═══════════════════════════════════════════════════
   WanderLog — Sidebar (авто-инициализация)
   Просто подключи этот файл ПОСЛЕ main.js — всё остальное автоматически
   ═══════════════════════════════════════════════════ */

const SIDEBAR_NAV = [
  { id:'dashboard',    href:'dashboard.html',   icon:'◉',  label:'Обзор' },
  { id:'trips',        href:'trips.html',        icon:'🗺️', label:'Путешествия' },
  { id:'trip-new',     href:'trip-new.html',     icon:'＋', label:'Добавить поездку' },
  { id:'map',          href:'map.html',          icon:'🌍', label:'Моя карта' },
  { id:'gallery',      href:'gallery.html',      icon:'📸', label:'Галерея' },
  { id:'planner',      href:'planner.html',      icon:'✈️', label:'Планировщик' },
  { id:'achievements', href:'achievements.html', icon:'🏆', label:'Достижения' },
  { id:'explore',      href:'explore.html',      icon:'◎',  label:'Сообщество' },
  { id:'settings',     href:'settings.html',     icon:'⚙',  label:'Настройки' },
];

// ── Определяем активную страницу из URL ────────────
function detectActivePage() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  const name = file.replace('.html','');
  // trip.html → trips активна
  if (name === 'trip') return 'trips';
  return name;
}

// ── Рисуем сайдбар ─────────────────────────────────
function renderSidebar(activePage) {
  const el = document.getElementById('sidebar');
  if (!el) return;

  const active = activePage || detectActivePage();
  el.innerHTML = `
    <div class="sidebar__logo" onclick="location.href='dashboard.html'" style="cursor:pointer">
      <span style="color:var(--gold)">◈</span> WanderLog
    </div>
    <nav class="sidebar__nav" style="flex:1">
      <ul>
        ${SIDEBAR_NAV.map(item => `
          <li>
            <a href="${item.href}" class="${active === item.id ? 'active' : ''}">
              <span class="nav-icon">${item.icon}</span> ${item.label}
            </a>
          </li>`).join('')}
        <li id="adminNavLink" style="display:none">
          <a href="admin.html">
            <span class="nav-icon" style="color:var(--rust)">⬡</span> Администратор
          </a>
        </li>
      </ul>
    </nav>
    <div class="sidebar__bottom">
      <div class="sidebar__user" onclick="location.href='settings.html'" style="cursor:pointer" title="Настройки профиля">
        <img id="sidebarAvatar" src="" alt="" style="background:var(--slate)">
        <div>
          <div class="sidebar__user-name" id="sidebarUserName">Загрузка...</div>
          <div class="sidebar__user-role" id="sidebarUserRole">Explorer</div>
        </div>
      </div>
      <button onclick="sidebarLogout()" class="sidebar__logout-btn">
        Выйти
      </button>
    </div>
  `;
  addSidebarStyles();

  // Set initials placeholder from cached user (instant, no flash)
  const cached = Auth.getUser();
  if (cached && typeof makeAvatarSVG === 'function' && typeof getInitials === 'function') {
    const av = document.getElementById('sidebarAvatar');
    if (av && !cached.avatar_url) {
      av.src = makeAvatarSVG(getInitials(cached.first_name, cached.last_name, cached.username), 80);
    } else if (av && cached.avatar_url) {
      av.src = cached.avatar_url;
    }
    const nameEl = document.getElementById('sidebarUserName');
    if (nameEl && cached.username) {
      nameEl.textContent = cached.first_name
        ? `${cached.first_name} ${cached.last_name||''}`.trim()
        : cached.username;
    }
  }
}

// ── Стили кнопки выхода (добавляем 1 раз) ──────────
function addSidebarStyles() {
  if (document.getElementById('sidebarExtraStyles')) return;
  const style = document.createElement('style');
  style.id = 'sidebarExtraStyles';
  style.textContent = `
    .sidebar__logout-btn {
      width:100%; margin-top:8px; padding:9px;
      background:transparent; color:rgba(255,255,255,0.4);
      border:1px solid rgba(255,255,255,0.1); border-radius:8px;
      font-family:var(--font-sans); font-size:0.82rem;
      cursor:pointer; transition:all .2s;
    }
    .sidebar__logout-btn:hover {
      background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.7);
    }
    @media(max-width:768px){
      .sidebar { transform:translateX(-100%); }
      .sidebar.open { transform:translateX(0); }
    }
  `;
  document.head.appendChild(style);
}

function sidebarLogout() {
  localStorage.removeItem('wl_token');
  localStorage.removeItem('wl_user');
  // Определяем глубину вложенности
  const inPages = window.location.pathname.includes('/pages/');
  window.location.href = inPages ? '../index.html' : 'index.html';
}

// ── Загружаем данные пользователя в сайдбар ────────
async function loadSidebarUser() {
  const token = localStorage.getItem('wl_token');
  if (!token) return null;

  try {
    const u = await apiFetch('/auth/me');
    if (!u) return null;
    Auth.setUser(u);

    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    const avEl   = document.getElementById('sidebarAvatar');

    if (nameEl) {
      nameEl.textContent = u.first_name
        ? `${u.first_name} ${u.last_name || ''}`.trim()
        : u.username;
    }
    if (roleEl) {
      roleEl.textContent = u.role === 'admin' ? 'Admin'
        : u.role === 'moderator' ? 'Moderator' : 'Explorer';
    }
    if (avEl) {
      if (u.avatar_url) {
        avEl.src = u.avatar_url;
        avEl.onerror = () => {
          const i = typeof getInitials === 'function'
            ? getInitials(u.first_name, u.last_name, u.username)
            : (u.username||'WL').slice(0,2).toUpperCase();
          avEl.src = typeof makeAvatarSVG === 'function' ? makeAvatarSVG(i, 80) : '';
        };
      } else {
        if (typeof makeAvatarSVG === 'function' && typeof getInitials === 'function') {
          const i = getInitials(u.first_name, u.last_name, u.username);
          avEl.src = makeAvatarSVG(i, 80);
        }
      }
    }

    // Показываем ссылку на админку
    if (u.role === 'admin' || u.role === 'moderator') {
      const adminLink = document.getElementById('adminNavLink');
      if (adminLink) adminLink.style.display = 'block';
    }
    return u;
  } catch (e) {
    if (e && e.status === 401) sidebarLogout();
    return null;
  }
}

// ── Мобильный бургер ───────────────────────────────
function initMobileSidebar() {
  const topBar = document.querySelector('.top-bar');
  if (!topBar || document.getElementById('mobileBurger')) return;

  const burger = document.createElement('button');
  burger.id = 'mobileBurger';
  burger.innerHTML = '☰';
  burger.style.cssText = [
    'display:none','background:var(--cream)','border:1px solid var(--sand)',
    'padding:7px 12px','border-radius:8px','font-size:1.1rem','cursor:pointer',
    'order:-1','margin-right:8px',
  ].join(';');
  burger.onclick = () => {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (sb && sb.classList.contains('open')) {
      sb.classList.remove('open');
      if (ov) ov.remove();
    } else {
      sb && sb.classList.add('open');
      if (!document.getElementById('sidebarOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;backdrop-filter:blur(2px)';
        overlay.onclick = () => { sb && sb.classList.remove('open'); overlay.remove(); };
        document.body.appendChild(overlay);
      }
    }
  };
  topBar.style.display = 'flex';
  topBar.insertBefore(burger, topBar.firstChild);

  const mq = window.matchMedia('(max-width:768px)');
  const check = (e) => { burger.style.display = e.matches ? 'inline-flex' : 'none'; };
  mq.addEventListener('change', check);
  check(mq);
}

// ── АВТО-ИНИЦИАЛИЗАЦИЯ при загрузке страницы ───────
// Не нужно ничего вызывать вручную — sidebar.js сам всё делает
document.addEventListener('DOMContentLoaded', async () => {
  // Рендерим сайдбар
  renderSidebar();

  // Загружаем пользователя (если есть токен)
  if (localStorage.getItem('wl_token')) {
    await loadSidebarUser();
  }

  // Инициализируем мобильный бургер
  initMobileSidebar();
});

// ── Экспортируем для ручного использования ─────────
// initPage() оставляем для обратной совместимости
async function initPage(activePage) {
  renderSidebar(activePage);
  return await loadSidebarUser();
}
