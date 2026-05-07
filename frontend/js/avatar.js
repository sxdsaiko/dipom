/* ═══════════════════════════════════════════════════
   WanderLog — Avatar Initials Generator
   Генерирует SVG-аватар по имени/username
   ═══════════════════════════════════════════════════ */

const AVATAR_COLORS = [
  ['#2c3a47','#c9a96e'], // slate + gold
  ['#4a6741','#ffffff'], // sage + white
  ['#9b4e2e','#ffffff'], // rust + white
  ['#1a2535','#c9a96e'], // dark + gold
  ['#5a3e8a','#e8d5b0'], // purple + cream
  ['#2a5f7a','#c9a96e'], // teal + gold
  ['#7a3e2a','#f0d9c8'], // brown + peach
  ['#3a5a3a','#c9a96e'], // forest + gold
];

function getAvatarColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName, lastName, username) {
  if (firstName && lastName) {
    return (firstName[0] + lastName[0]).toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (username) {
    // Take first 2 chars, skip non-letters
    const letters = username.replace(/[^a-zA-Zа-яА-Я]/g, '');
    return letters.slice(0, 2).toUpperCase() || username.slice(0, 2).toUpperCase();
  }
  return 'WL';
}

function makeAvatarSVG(initials, size = 80) {
  const [bg, fg] = getAvatarColor(initials);
  const fontSize = size * 0.38;
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'%3E%3Crect width='${size}' height='${size}' fill='${encodeURIComponent(bg)}'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-family='Cormorant Garamond,Georgia,serif' font-size='${fontSize}' font-weight='600' fill='${encodeURIComponent(fg)}'%3E${encodeURIComponent(initials)}%3C/text%3E%3C/svg%3E`;
}

// ── Применить аватар к элементу ────────────────────
function applyAvatar(imgEl, user) {
  if (!imgEl) return;
  if (user && user.avatar_url) {
    imgEl.src = user.avatar_url;
    imgEl.onerror = () => {
      imgEl.src = makeAvatarSVG(
        getInitials(user.first_name, user.last_name, user.username)
      );
    };
  } else {
    const initials = getInitials(
      user?.first_name, user?.last_name, user?.username || 'WL'
    );
    imgEl.src = makeAvatarSVG(initials);
  }
}

// ── Применить ко всем img с data-avatar ────────────
function applyAllAvatars(user) {
  document.querySelectorAll('[data-avatar]').forEach(img => {
    applyAvatar(img, user);
  });
}

// ── Глобальная функция для карточек трипов ─────────
function userAvatarSrc(user) {
  if (user?.avatar_url) return user.avatar_url;
  const i = getInitials(user?.first_name, user?.last_name, user?.username || '?');
  return makeAvatarSVG(i, 40);
}

// ── Строковый аватар по имени (для карточек) ───────
function avatarByName(name, size = 40) {
  const parts = (name || 'WL').trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0] || 'WL').slice(0, 2).toUpperCase();
  return makeAvatarSVG(initials, size);
}
