# ◈ WanderLog — Веб-приложение для ведения дневника путешествий

> **Дипломный проект** · Полноценное full-stack веб-приложение  
> Стек: Vanilla JS + Node.js/Express + MySQL 8 · Leaflet Maps · Chart.js · Cloudinary

---

## 📸 Скриншоты

| Главная страница | Дашборд | Интерактивная карта |
|---|---|---|
| Премиальный hero с частицами | Статистика + Leaflet карта | Маркеры стран + панель |

| Галерея | Создание поездки | Достижения |
|---|---|---|
| Masonry + Lightbox | Мульти-шаговая форма | Badges система |

---

## 🏗 Архитектура проекта

```
wanderlog/
├── frontend/                    # Vanilla JS SPA
│   ├── index.html               # Главная страница (лендинг)
│   ├── css/
│   │   ├── main.css             # Полная дизайн-система (2000+ строк)
│   │   └── dashboard.css        # Стили дашборда
│   ├── js/
│   │   ├── main.js              # Ядро: API, анимации, карты
│   │   └── dashboard.js         # Логика дашборда + Chart.js
│   └── pages/
│       ├── login.html           # Авторизация (split-screen)
│       ├── register.html        # Регистрация (3 шага)
│       ├── dashboard.html       # Личный кабинет
│       ├── trips.html           # Список поездок
│       ├── trip-new.html        # Создание поездки
│       ├── trip.html            # Детальная страница поездки
│       ├── map.html             # Интерактивная карта (Leaflet)
│       ├── gallery.html         # Фотогалерея (Masonry + Lightbox)
│       ├── planner.html         # Планировщик + Wishlist + Чек-листы
│       ├── achievements.html    # Достижения / Travel Badges
│       ├── explore.html         # Публичная лента сообщества
│       └── admin.html           # Панель администратора
│
├── backend/                     # Node.js + Express REST API
│   ├── server.js                # Точка входа: middleware, routes, cron
│   ├── config/
│   │   ├── database.js          # MySQL2 connection pool
│   │   └── logger.js            # Winston logger
│   ├── middleware/
│   │   ├── auth.js              # JWT: authenticate, optionalAuth, requireRole
│   │   ├── validate.js          # express-validator rule sets
│   │   └── upload.js            # Multer + Cloudinary uploader
│   ├── routes/
│   │   ├── auth.js              # /api/auth/* — register, login, refresh, reset
│   │   ├── trips.js             # /api/trips/* — CRUD + days + like + favorite
│   │   ├── extras.js            # photos, expenses, users, wishlist, achievements
│   │   └── admin.js             # /api/admin/* — users, reports, moderation
│   ├── database/
│   │   └── schema.sql           # Полная схема БД (20 таблиц + seed data)
│   ├── Dockerfile               # Production Docker image
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml           # MySQL + API + Nginx
├── nginx.conf                   # Reverse proxy + static files
└── README.md
```

---

## 🗄 База данных (20 таблиц)

```sql
users              -- Аккаунты пользователей
profiles           -- Профили (bio, avatar, статистика)
countries          -- Справочник стран (20 предзагружено)
cities             -- Города
trips              -- Путешествия (CRUD)
trip_countries     -- M2M: поездка ↔ страны
trip_days          -- Дни поездки (дневник)
trip_places        -- Места / достопримечательности
trip_photos        -- Фотографии
photo_albums       -- Альбомы
routes             -- GeoJSON маршруты
expenses           -- Расходы с категориями
wishlist           -- Вишлист стран и мест
checklists         -- Чек-листы для подготовки
checklist_items    -- Пункты чек-листов
subscriptions      -- Подписки (followers/following)
favorites          -- Избранные поездки
likes              -- Лайки (поездки, фото, комментарии)
comments           -- Комментарии с ветками
achievements       -- 14 достижений
user_achievements  -- Заработанные бейджи
notifications      -- Уведомления
reports            -- Жалобы на контент
activity_log       -- Лог действий для аудита
```

---

## 🚀 Быстрый старт

### Вариант 1 — Docker (рекомендуется)

```bash
# Клонировать репозиторий
git clone https://github.com/your/wanderlog.git
cd wanderlog

# Скопировать .env
cp backend/.env.example backend/.env
# Отредактировать: JWT_SECRET, CLOUDINARY_*, SMTP_*

# Запустить все сервисы
docker-compose up -d

# Приложение доступно:
# Frontend: http://localhost
# API:      http://localhost:5000/api
# БД:       localhost:3306
```

### Вариант 2 — Локальная разработка

```bash
# 1. MySQL — создать БД и выполнить schema.sql
mysql -u root -p < backend/database/schema.sql

# 2. Backend
cd backend
cp .env.example .env    # заполнить переменные
npm install
npm run dev             # nodemon, порт 5000

# 3. Frontend
# Открыть frontend/index.html в браузере
# Или использовать Live Server (VS Code)
# Или: npx serve frontend -p 3000
```

---

## 🔑 API Endpoints

### Auth
| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/refresh` | Обновить токен |
| POST | `/api/auth/forgot-password` | Сброс пароля |
| GET  | `/api/auth/me` | Текущий пользователь |

### Trips
| Метод | Путь | Описание |
|-------|------|---------|
| GET  | `/api/trips` | Публичная лента |
| GET  | `/api/trips/my` | Мои поездки |
| POST | `/api/trips` | Создать поездку |
| GET  | `/api/trips/:id` | Детали поездки |
| PUT  | `/api/trips/:id` | Обновить |
| DELETE | `/api/trips/:id` | Удалить |
| POST | `/api/trips/:id/like` | Лайк/анлайк |
| POST | `/api/trips/:id/favorite` | Избранное |
| GET/POST | `/api/trips/:id/comments` | Комментарии |
| GET/POST/PUT | `/api/trips/:id/days` | Дни дневника |

### Photos & Expenses
| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/trips/:id/photos` | Загрузить фото (multipart) |
| GET  | `/api/trips/:id/photos` | Фото поездки |
| DELETE | `/api/photos/:id` | Удалить фото |
| GET/POST | `/api/trips/:id/expenses` | Расходы |
| PUT/DELETE | `/api/trips/:id/expenses/:id` | CRUD расходов |

### Users & Social
| Метод | Путь | Описание |
|-------|------|---------|
| GET  | `/api/users/:username` | Профиль пользователя |
| PUT  | `/api/users/me/profile` | Обновить профиль |
| POST | `/api/users/me/avatar` | Загрузить аватар |
| POST | `/api/users/:id/follow` | Подписаться/отписаться |
| GET  | `/api/users/me/notifications` | Уведомления |
| GET  | `/api/users/me/wishlist` | Вишлист |
| GET  | `/api/users/me/stats` | Статистика |
| GET  | `/api/users/me/achievements` | Достижения |

### Admin (role: admin/moderator)
| Метод | Путь | Описание |
|-------|------|---------|
| GET  | `/api/admin/stats` | Статистика системы |
| GET  | `/api/admin/users` | Все пользователи |
| PUT  | `/api/admin/users/:id/role` | Сменить роль |
| DELETE | `/api/admin/users/:id` | Удалить пользователя |
| GET  | `/api/admin/reports` | Жалобы |
| PUT  | `/api/admin/reports/:id` | Обработать жалобу |
| GET  | `/api/admin/activity` | Лог активности |

---

## 🎨 Дизайн-система

**Философия:** Luxury Expedition Journal — минимализм премиум-уровня с атмосферой приключений.

```css
/* Основная палитра */
--ink:   #0d0d0d    /* Основной текст */
--paper: #faf8f4    /* Фон (тёплый белый) */
--gold:  #c9a96e    /* Акцентный цвет */
--slate: #2c3a47    /* Тёмно-синий */
--sage:  #4a6741    /* Зелёный (статусы) */
--rust:  #9b4e2e    /* Тревожный (ошибки) */

/* Шрифты */
--font-serif: 'Cormorant Garamond'  /* Заголовки */
--font-sans:  'DM Sans'             /* Тело */
--font-mono:  'Space Mono'          /* Метаданные, теги */
```

**UI компоненты:**
- 🎯 Кастомный курсор с lag-эффектом
- ✨ Particle canvas с соединяющимися линиями
- 🎠 Marquee-лента с возможностями
- 🗺️ Leaflet карты (тёмная и светлая тема)
- 📊 Chart.js: doughnut расходов, line регистраций, bar бюджета
- 🖼️ Masonry галерея + Lightbox с клавиатурной навигацией
- 🏆 Система достижений с progress bar
- 📋 Drag-and-drop чек-листы
- 🔢 Анимированные счётчики (IntersectionObserver)
- 🌓 Reveal-анимации при скролле

---

## 🔒 Безопасность

- **JWT** — access (7d) + refresh (30d) токены
- **bcryptjs** — хэширование паролей (12 rounds)
- **helmet** — HTTP security headers
- **Rate limiting** — 300 req/15min глобально, 15 req/15min для /auth
- **express-validator** — серверная валидация всех входных данных
- **CORS** — whitelist origin
- **trust proxy** — корректные IP за Nginx
- **Role guard** — user / moderator / admin
- **Activity log** — аудит всех мутирующих запросов

---

## 🏆 Технологический стек

| Слой | Технология | Версия |
|------|-----------|--------|
| Frontend | Vanilla JS / HTML5 / CSS3 | ES2022 |
| Backend | Node.js + Express | 18+ / 4.18 |
| База данных | MySQL | 8.0 |
| Драйвер БД | mysql2 | ^3.6 |
| Авторизация | JWT (jsonwebtoken) | ^9.0 |
| Хэширование | bcryptjs | ^2.4 |
| Загрузка файлов | Multer + Cloudinary | — |
| Карты | Leaflet | 1.9.4 |
| Графики | Chart.js | latest |
| Шрифты | Google Fonts | — |
| Логирование | Winston | ^3.11 |
| Планировщик | node-cron | ^3.0 |
| Валидация | express-validator | ^7.0 |
| Безопасность | helmet + rate-limit | — |
| Контейнеризация | Docker + Compose | — |
| Веб-сервер | Nginx | alpine |

---

## 📋 Функциональность

### Пользователи
- ✅ Регистрация (3 шага) + Вход + Refresh токен
- ✅ Восстановление пароля через email
- ✅ Редактирование профиля + загрузка аватара
- ✅ Публичный / приватный профиль
- ✅ Система подписок (followers/following)
- ✅ Уведомления

### Путешествия (CRUD)
- ✅ Создание с обложкой, статусом, рейтингом, настроением
- ✅ Дневник по дням (заметки, погода, места)
- ✅ Учёт расходов по категориям с аналитикой
- ✅ Фотоальбомы (Cloudinary)
- ✅ Маршруты на карте (GeoJSON)
- ✅ Лайки, избранное, комментарии
- ✅ Публичные/приватные поездки

### Карта
- ✅ Посещённые страны (зелёные маркеры)
- ✅ Запланированные (золотые маркеры)
- ✅ Вишлист (серые маркеры)
- ✅ Маршруты (пунктирные линии)
- ✅ Тёмная/светлая тема
- ✅ Поиск стран + всплывающие карточки

### Галерея
- ✅ Masonry layout
- ✅ Drag-and-drop загрузка
- ✅ Lightbox с клавиатурной навигацией
- ✅ Фильтрация по странам
- ✅ Лайки фотографий

### Планировщик
- ✅ Вишлист мест с приоритетами и бюджетами
- ✅ Чек-листы (пакинг, todo, документы)
- ✅ Предстоящие поездки с обратным отсчётом
- ✅ Сравнение бюджетов (Chart.js)

### Достижения (14 бейджей)
- ✅ По поездкам, странам, фото, социальному, особые
- ✅ Progress bar + очки
- ✅ Фильтрация по категориям

### Сообщество
- ✅ Публичная лента историй
- ✅ Поиск + фильтры + сортировка
- ✅ Топ путешественников
- ✅ Фильтр по странам (пилюли)

### Администратор
- ✅ Статистика системы + графики
- ✅ Управление пользователями + смена ролей
- ✅ Модерация поездок
- ✅ Обработка жалоб
- ✅ Лог активности в реальном времени

---

## 👨‍💻 Разработка

```bash
# Запуск только БД через Docker
docker-compose up db -d

# Backend в dev-режиме (hot-reload)
cd backend && npm run dev

# Проверка API
curl http://localhost:5000/api/health

# Логи
tail -f backend/logs/app.log
```

---

*WanderLog — Дипломный проект. Full-stack веб-приложение для ведения дневника путешествий.*  
*Разработано с ❤️ и страстью к путешествиям.*
