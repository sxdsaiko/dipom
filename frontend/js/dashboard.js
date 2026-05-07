/* ═══════════════════════════════════════════════════
   WanderLog — Dashboard JS v3
   ═══════════════════════════════════════════════════ */

function guardAuth() {
  if (!Auth.getToken()) { window.location.href = 'login.html'; return false; }
  return true;
}

function logout() {
  localStorage.removeItem('wl_token');
  localStorage.removeItem('wl_user');
  window.location.href = '../index.html';
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = (text ?? '');
}

function showSkeletons() {
  ['stat-trips','stat-countries','stat-photos','stat-spent'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton" style="display:inline-block;width:52px;height:30px;border-radius:4px;vertical-align:middle"></span>';
  });
}

// ── Statistics ─────────────────────────────────────
async function loadStats() {
  try {
    const stats = await apiFetch('/users/me/stats');
    // Hide backend warning if request succeeded
    const warn = document.getElementById('backendWarn');
    if (warn) warn.style.display = 'none';
    setEl('stat-trips',     stats.totals?.total_trips ?? 0);
    setEl('stat-completed', (stats.totals?.completed ?? 0) + ' завершено');
    setEl('stat-countries', stats.countries?.length ?? 0);
    const spent = parseFloat(stats.total_spent || 0);
    setEl('stat-spent', spent > 0 ? Math.round(spent).toLocaleString('ru') : '0');
    if (stats.countries?.length) updateDashMap(stats.countries);
  } catch(err) {
    ['stat-trips','stat-countries','stat-photos','stat-spent'].forEach(id => setEl(id,'—'));
    setEl('stat-completed','');
    // Show backend warning if network error
    if (err.status === 0) {
      const warn = document.getElementById('backendWarn');
      if (warn) warn.style.display = 'flex';
    }
  }
}

// ── Recent trips ───────────────────────────────────
async function loadMyTrips() {
  const el = document.getElementById('recentTrips');
  if (!el) return;
  try {
    const trips = await apiFetch('/trips/my');
    if (!trips.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--mist)">
        <div style="font-size:2.5rem;margin-bottom:12px">🗺️</div>
        <p style="margin-bottom:16px">У вас ещё нет путешествий</p>
        <a href="trip-new.html" class="btn btn--primary" style="padding:10px 22px;font-size:0.85rem">Создать первое</a>
      </div>`;
      setEl('stat-photos','0');
      return;
    }
    setEl('stat-photos', trips.reduce((s,t) => s + (t.photo_count||0), 0));

    const statusMap = {completed:'Завершено',planned:'Планируется',ongoing:'В процессе'};
    const badgeMap  = {completed:'green',planned:'yellow',ongoing:'blue'};
    el.innerHTML = trips.slice(0,5).map(t => `
      <div class="trip-row" onclick="location.href='trip.html?id=${t.id}'">
        <img class="trip-row__thumb"
             src="${t.cover_url||'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=120&q=80'}"
             alt="" onerror="this.src='https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=120&q=80'">
        <div class="trip-row__info">
          <div class="trip-row__title">${t.flag_emoji||''} ${t.title}</div>
          <div class="trip-row__meta">
            ${t.country_name?t.country_name+' · ':''}${t.start_date?new Date(t.start_date).toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'}):'Дата не указана'}
          </div>
        </div>
        <div class="trip-row__status">
          <span class="badge badge--${badgeMap[t.status]||'blue'}">${statusMap[t.status]||t.status}</span>
        </div>
      </div>`).join('');
  } catch {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--mist)">
      <p>Ошибка загрузки</p>
      <button onclick="loadMyTrips()" class="btn btn--ghost" style="margin-top:10px;padding:7px 16px;font-size:0.82rem">↻ Повторить</button>
    </div>`;
  }
}

// ── Upcoming planned trips ─────────────────────────
async function loadUpcoming() {
  const el = document.getElementById('upcomingTrips');
  if (!el) return;
  try {
    const trips = await apiFetch('/trips/my');
    const planned = trips.filter(t => t.status === 'planned');
    if (!planned.length) {
      el.innerHTML = `<div style="text-align:center;padding:30px 0;color:var(--mist)">
        <div style="font-size:2rem;margin-bottom:10px">✈️</div>
        <p style="font-size:0.88rem">Нет запланированных поездок</p>
        <a href="trip-new.html" class="btn btn--primary" style="margin-top:14px;padding:10px 20px;font-size:0.82rem">Создать</a>
      </div>`;
      return;
    }
    el.innerHTML = planned.slice(0,3).map(t => {
      const days = t.start_date ? Math.max(0,Math.ceil((new Date(t.start_date)-new Date())/86400000)) : null;
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--sand);cursor:pointer"
                   onclick="location.href='trip.html?id=${t.id}'">
        <div style="text-align:center;min-width:44px">
          ${days!==null
            ?`<div style="font-family:var(--font-serif);font-size:1.6rem;color:var(--gold);line-height:1">${days}</div><div style="font-size:0.6rem;color:var(--mist);text-transform:uppercase;letter-spacing:0.08em">дней</div>`
            :`<div style="font-size:1.4rem">📅</div>`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.9rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.flag_emoji||''} ${t.title}</div>
          <div style="font-size:0.72rem;color:var(--mist);margin-top:2px;font-family:var(--font-mono)">${t.start_date?new Date(t.start_date).toLocaleDateString('ru',{day:'numeric',month:'short'}):'—'}</div>
        </div>
      </div>`;
    }).join('');
  } catch { el.innerHTML=''; }
}

// ── Achievements ───────────────────────────────────
async function loadAchievements() {
  const el = document.getElementById('dashAchievements');
  if (!el) return;
  try {
    const all = await apiFetch('/users/me/achievements');
    el.innerHTML = all.slice(0,8).map(a =>
      `<div class="dash-badge ${a.earned?'dash-badge--earned':'dash-badge--locked'}" title="${a.title}: ${a.description||''}">
        <div class="dash-badge__icon">${a.icon}</div>
        <div class="dash-badge__title">${a.title}</div>
      </div>`).join('');
  } catch {
    el.innerHTML = Array(8).fill(0).map(()=>
      `<div class="dash-badge dash-badge--locked"><div class="dash-badge__icon">🔒</div><div class="dash-badge__title">—</div></div>`
    ).join('');
  }
}

// ── Expense chart ──────────────────────────────────
async function loadExpenseChart() {
  const canvas = document.getElementById('expenseChart');
  if (!canvas || !window.Chart) return;
  const CAT={accommodation:'Жильё',food:'Еда',transport:'Транспорт',activities:'Активности',shopping:'Шопинг',health:'Здоровье',visa:'Виза',insurance:'Страховка',other:'Прочее'};
  const COLORS=['#c9a96e','#2c3a47','#4a6741','#9b4e2e','#8fa3b1','#5a7a8a','#b08050','#6a9060','#ddd5c4'];
  let labels=['Нет данных'], data=[1], colors=['#e8e2d8'];
  try {
    const trips = await apiFetch('/trips/my');
    const catMap={};
    await Promise.all(trips.slice(0,8).map(async t=>{
      try{const e=await apiFetch(`/trips/${t.id}/expenses`);(e.byCategory||[]).forEach(c=>{catMap[c.category]=(catMap[c.category]||0)+parseFloat(c.total||0);});}catch{}
    }));
    const entries=Object.entries(catMap).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    if(entries.length){labels=entries.map(([k])=>CAT[k]||k);data=entries.map(([,v])=>Math.round(v));colors=COLORS.slice(0,entries.length);}
  }catch{}
  new Chart(canvas,{
    type:'doughnut',
    data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0,hoverOffset:8}]},
    options:{responsive:true,plugins:{
      legend:{position:'bottom',labels:{font:{family:'DM Sans',size:11},padding:14,boxWidth:12,boxHeight:12}},
      tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${ctx.parsed.toLocaleString('ru')} ₽`}},
    },cutout:'68%'},
  });
}

// ── Notifications badge ────────────────────────────
async function loadNotifications() {
  try {
    const data=await apiFetch('/users/me/notifications');
    const badge=document.getElementById('notifCount');
    if(badge){badge.textContent=data.unread||0;badge.style.display=(data.unread>0)?'flex':'none';}
  }catch{}
}

// ── Dashboard map ──────────────────────────────────
const COUNTRY_COORDS={
  RU:[55.75,37.61],FR:[48.85,2.35],IT:[41.90,12.49],ES:[40.41,-3.70],DE:[52.52,13.40],
  TR:[39.93,32.85],TH:[13.75,100.50],JP:[35.67,139.65],AE:[23.42,53.84],GR:[37.98,23.72],
  CZ:[50.07,14.43],HU:[47.49,19.04],ID:[-6.20,106.84],PT:[38.72,-9.13],EG:[30.04,31.23],
  CN:[39.90,116.40],US:[38.89,-77.03],GE:[41.71,44.82],ME:[42.43,19.25],AM:[40.17,44.50],
  GB:[51.50,-0.12],PL:[52.23,21.01],NL:[52.37,4.89],SE:[59.33,18.06],NO:[59.91,10.74],
};
let dashMap=null;

function initDashMap() {
  const el=document.getElementById('dashMap');
  if(!el||!window.L||dashMap) return;
  dashMap=L.map('dashMap',{zoomControl:false,attributionControl:false,scrollWheelZoom:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png').addTo(dashMap);
  dashMap.setView([30,30],2);
}

function updateDashMap(countries) {
  if(!dashMap||!window.L) return;
  const icon=L.divIcon({
    html:'<div style="width:12px;height:12px;border-radius:50%;background:#c9a96e;border:2.5px solid white;box-shadow:0 0 8px rgba(201,169,110,0.6)"></div>',
    className:'',iconAnchor:[6,6],
  });
  countries.forEach(c=>{
    const coords=COUNTRY_COORDS[c.iso2];
    if(!coords) return;
    L.marker(coords,{icon}).bindPopup(`<strong>${c.flag_emoji||''} ${c.name_ru||c.iso2}</strong>`).addTo(dashMap);
  });
}

// ── MAIN INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Защита: если нет токена — редирект (sidebar.js тоже проверяет)
  if (!Auth.getToken()) { window.location.href = 'login.html'; return; }

  showSkeletons();
  initDashMap();

  // sidebar.js уже вызвал renderSidebar() и loadSidebarUser() автоматически.
  // Загружаем данные дашборда параллельно:
  await Promise.all([
    loadStats(),
    loadMyTrips(),
    loadUpcoming(),
    loadAchievements(),
    loadNotifications(),
    loadExpenseChart(),
  ]);
});
