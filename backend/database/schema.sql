-- ============================================================
-- WanderLog — Travel Diary Application
-- Database Schema v1.0
-- PostgreSQL-compatible (also works with MySQL 8.0+)
-- ============================================================

CREATE DATABASE IF NOT EXISTS wanderlog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wanderlog;

-- ─────────────────────────────────────────────
-- USERS & AUTH
-- ─────────────────────────────────────────────

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  role          ENUM('user','moderator','admin') DEFAULT 'user',
  is_verified   BOOLEAN DEFAULT FALSE,
  verify_token  VARCHAR(255),
  reset_token   VARCHAR(255),
  reset_expires DATETIME,
  last_login    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username)
) ENGINE=InnoDB;

CREATE TABLE profiles (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL UNIQUE,
  first_name       VARCHAR(100),
  last_name        VARCHAR(100),
  bio              TEXT,
  avatar_url       VARCHAR(500),
  cover_url        VARCHAR(500),
  location         VARCHAR(255),
  website          VARCHAR(500),
  birth_date       DATE,
  gender           ENUM('male','female','other','prefer_not'),
  countries_count  INT UNSIGNED DEFAULT 0,
  trips_count      INT UNSIGNED DEFAULT 0,
  photos_count     INT UNSIGNED DEFAULT 0,
  followers_count  INT UNSIGNED DEFAULT 0,
  following_count  INT UNSIGNED DEFAULT 0,
  is_public        BOOLEAN DEFAULT TRUE,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- GEOGRAPHY
-- ─────────────────────────────────────────────

CREATE TABLE countries (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  name_ru     VARCHAR(100),
  iso2        CHAR(2) NOT NULL UNIQUE,
  iso3        CHAR(3) NOT NULL UNIQUE,
  continent   ENUM('AF','AN','AS','EU','NA','OC','SA'),
  flag_emoji  VARCHAR(10),
  capital     VARCHAR(100),
  lat         DECIMAL(9,6),
  lng         DECIMAL(9,6),
  INDEX idx_iso2 (iso2)
) ENGINE=InnoDB;

CREATE TABLE cities (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  country_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(100) NOT NULL,
  name_ru     VARCHAR(100),
  lat         DECIMAL(9,6),
  lng         DECIMAL(9,6),
  timezone    VARCHAR(80),
  population  BIGINT UNSIGNED,
  INDEX idx_country (country_id),
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- TRIPS
-- ─────────────────────────────────────────────

CREATE TABLE trips (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  title           VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL,
  description     TEXT,
  cover_url       VARCHAR(500),
  country_id      INT UNSIGNED,
  city_id         INT UNSIGNED,
  start_date      DATE,
  end_date        DATE,
  status          ENUM('planned','ongoing','completed') DEFAULT 'planned',
  rating          TINYINT UNSIGNED CHECK (rating BETWEEN 1 AND 5),
  mood            ENUM('amazing','good','okay','tough','terrible'),
  total_budget    DECIMAL(12,2),
  currency        CHAR(3) DEFAULT 'RUB',
  is_public       BOOLEAN DEFAULT FALSE,
  views_count     INT UNSIGNED DEFAULT 0,
  likes_count     INT UNSIGNED DEFAULT 0,
  comments_count  INT UNSIGNED DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_slug (user_id, slug),
  FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
  FOREIGN KEY (city_id)    REFERENCES cities(id)    ON DELETE SET NULL,
  INDEX idx_user_status (user_id, status),
  INDEX idx_public (is_public, status),
  INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB;

CREATE TABLE trip_countries (
  trip_id    INT UNSIGNED NOT NULL,
  country_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (trip_id, country_id),
  FOREIGN KEY (trip_id)    REFERENCES trips(id)     ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE trip_days (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT UNSIGNED NOT NULL,
  day_number  SMALLINT UNSIGNED NOT NULL,
  date        DATE,
  title       VARCHAR(255),
  content     LONGTEXT,
  city_id     INT UNSIGNED,
  weather     VARCHAR(100),
  mood        ENUM('amazing','good','okay','tough','terrible'),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id)  ON DELETE CASCADE,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
  UNIQUE KEY unique_day (trip_id, day_number)
) ENGINE=InnoDB;

CREATE TABLE trip_places (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT UNSIGNED NOT NULL,
  trip_day_id INT UNSIGNED,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  category    ENUM('attraction','restaurant','hotel','transport','nature','shopping','culture','other'),
  lat         DECIMAL(9,6),
  lng         DECIMAL(9,6),
  address     VARCHAR(500),
  rating      TINYINT UNSIGNED,
  visit_time  TIME,
  visit_date  DATE,
  sort_order  SMALLINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (trip_id)     REFERENCES trips(id)     ON DELETE CASCADE,
  FOREIGN KEY (trip_day_id) REFERENCES trip_days(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- PHOTOS
-- ─────────────────────────────────────────────

CREATE TABLE trip_photos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT UNSIGNED NOT NULL,
  trip_day_id INT UNSIGNED,
  user_id     INT UNSIGNED NOT NULL,
  url         VARCHAR(500) NOT NULL,
  thumb_url   VARCHAR(500),
  caption     VARCHAR(500),
  lat         DECIMAL(9,6),
  lng         DECIMAL(9,6),
  taken_at    DATETIME,
  width       SMALLINT UNSIGNED,
  height      SMALLINT UNSIGNED,
  size_bytes  INT UNSIGNED,
  likes_count INT UNSIGNED DEFAULT 0,
  sort_order  SMALLINT UNSIGNED DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id)     REFERENCES trips(id)     ON DELETE CASCADE,
  FOREIGN KEY (trip_day_id) REFERENCES trip_days(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  INDEX idx_trip (trip_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE photo_albums (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  trip_id     INT UNSIGNED,
  title       VARCHAR(255) NOT NULL,
  cover_url   VARCHAR(500),
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (trip_id) REFERENCES trips(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- ROUTES
-- ─────────────────────────────────────────────

CREATE TABLE routes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT UNSIGNED NOT NULL,
  title       VARCHAR(255),
  geojson     JSON,
  transport   ENUM('walking','car','bus','train','flight','boat','bike','mixed'),
  distance_km DECIMAL(10,2),
  duration_h  DECIMAL(8,2),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- EXPENSES
-- ─────────────────────────────────────────────

CREATE TABLE expenses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT UNSIGNED NOT NULL,
  trip_day_id INT UNSIGNED,
  category    ENUM('accommodation','food','transport','activities','shopping','health','visa','insurance','other'),
  title       VARCHAR(255) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  currency    CHAR(3) DEFAULT 'RUB',
  amount_rub  DECIMAL(12,2),
  paid_at     DATE,
  note        TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id)     REFERENCES trips(id)     ON DELETE CASCADE,
  FOREIGN KEY (trip_day_id) REFERENCES trip_days(id) ON DELETE SET NULL,
  INDEX idx_trip_cat (trip_id, category)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- WISHLIST / PLANNER
-- ─────────────────────────────────────────────

CREATE TABLE wishlist (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  country_id  INT UNSIGNED,
  city_id     INT UNSIGNED,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  image_url   VARCHAR(500),
  priority    ENUM('low','medium','high','dream') DEFAULT 'medium',
  planned_at  DATE,
  budget_est  DECIMAL(12,2),
  currency    CHAR(3) DEFAULT 'RUB',
  is_done     BOOLEAN DEFAULT FALSE,
  done_trip_id INT UNSIGNED,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
  FOREIGN KEY (city_id)    REFERENCES cities(id)   ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE checklists (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id     INT UNSIGNED,
  user_id     INT UNSIGNED NOT NULL,
  title       VARCHAR(255) NOT NULL,
  type        ENUM('packing','todo','shopping','documents','other') DEFAULT 'packing',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE checklist_items (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  checklist_id INT UNSIGNED NOT NULL,
  title        VARCHAR(255) NOT NULL,
  is_checked   BOOLEAN DEFAULT FALSE,
  sort_order   SMALLINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- SOCIAL
-- ─────────────────────────────────────────────

CREATE TABLE subscriptions (
  follower_id  INT UNSIGNED NOT NULL,
  following_id INT UNSIGNED NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE favorites (
  user_id    INT UNSIGNED NOT NULL,
  trip_id    INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, trip_id),
  FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (trip_id) REFERENCES trips(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE likes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  entity     ENUM('trip','photo','comment') NOT NULL,
  entity_id  INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_like (user_id, entity, entity_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_entity (entity, entity_id)
) ENGINE=InnoDB;

CREATE TABLE comments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  trip_id     INT UNSIGNED NOT NULL,
  parent_id   INT UNSIGNED,
  content     TEXT NOT NULL,
  likes_count INT UNSIGNED DEFAULT 0,
  is_deleted  BOOLEAN DEFAULT FALSE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (trip_id)  REFERENCES trips(id)    ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL,
  INDEX idx_trip (trip_id),
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- ACHIEVEMENTS
-- ─────────────────────────────────────────────

CREATE TABLE achievements (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(60) NOT NULL UNIQUE,
  title       VARCHAR(100) NOT NULL,
  description TEXT,
  icon        VARCHAR(10),
  category    ENUM('trips','countries','photos','social','special'),
  threshold   INT UNSIGNED,
  points      SMALLINT UNSIGNED DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE user_achievements (
  user_id        INT UNSIGNED NOT NULL,
  achievement_id INT UNSIGNED NOT NULL,
  earned_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────

CREATE TABLE notifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  from_user   INT UNSIGNED,
  type        ENUM('like','comment','follow','achievement','mention','system') NOT NULL,
  entity      ENUM('trip','photo','comment','user'),
  entity_id   INT UNSIGNED,
  text        VARCHAR(500),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_unread (user_id, is_read, created_at)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- ADMIN / MODERATION
-- ─────────────────────────────────────────────

CREATE TABLE reports (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT UNSIGNED NOT NULL,
  entity      ENUM('trip','photo','comment','user') NOT NULL,
  entity_id   INT UNSIGNED NOT NULL,
  reason      ENUM('spam','inappropriate','copyright','fake','other') NOT NULL,
  details     TEXT,
  status      ENUM('pending','reviewed','resolved','dismissed') DEFAULT 'pending',
  resolved_by INT UNSIGNED,
  resolved_at DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE activity_log (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED,
  action     VARCHAR(60) NOT NULL,
  entity     VARCHAR(60),
  entity_id  INT UNSIGNED,
  ip         VARCHAR(45),
  user_agent VARCHAR(500),
  meta       JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_date (created_at)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────

INSERT INTO achievements (code, title, description, icon, category, threshold, points) VALUES
('first_trip',       'Первопроходец',        'Создайте своё первое путешествие',     '🗺️',  'trips',     1,   10),
('trips_5',          'Путешественник',        'Совершите 5 путешествий',               '✈️',  'trips',     5,   25),
('trips_10',         'Исследователь',         'Совершите 10 путешествий',              '🧭',  'trips',     10,  50),
('trips_25',         'Авантюрист',            'Совершите 25 путешествий',              '🏔️',  'trips',     25,  100),
('countries_5',      'Мультикультурный',      'Посетите 5 стран',                      '🌍',  'countries', 5,   30),
('countries_10',     'Гражданин мира',        'Посетите 10 стран',                     '🌎',  'countries', 10,  60),
('countries_25',     'Глобальный странник',   'Посетите 25 стран',                     '🌏',  'countries', 25,  150),
('photos_50',        'Фотограф',              'Загрузите 50 фотографий',               '📸',  'photos',    50,  20),
('photos_500',       'Летописец',             'Загрузите 500 фотографий',              '🎞️',  'photos',    500, 75),
('first_follower',   'Любимец публики',       'Получите первого подписчика',           '❤️',  'social',    1,   15),
('followers_100',    'Инфлюенсер',            'Получите 100 подписчиков',              '⭐',  'social',    100, 100),
('long_trip',        'Дальний странник',      'Путешествие длительностью 30+ дней',   '🛤️',  'special',   30,  50),
('europe_explorer',  'Европейский бродяга',   'Посетите 5 европейских стран',          '🏰',  'special',   5,   40),
('budget_traveler',  'Бюджетный гуру',        'Занесите расходы 100+ записей',         '💰',  'special',   100, 30);

INSERT INTO countries (name, name_ru, iso2, iso3, continent, flag_emoji, capital, lat, lng) VALUES
('Russia',           'Россия',          'RU','RUS','EU','🇷🇺','Москва',       55.7558,  37.6173),
('France',           'Франция',         'FR','FRA','EU','🇫🇷','Париж',        48.8566,   2.3522),
('Italy',            'Италия',          'IT','ITA','EU','🇮🇹','Рим',          41.9028,  12.4964),
('Spain',            'Испания',         'ES','ESP','EU','🇪🇸','Мадрид',       40.4168,  -3.7038),
('Germany',          'Германия',        'DE','DEU','EU','🇩🇪','Берлин',       52.5200,  13.4050),
('Turkey',           'Турция',          'TR','TUR','AS','🇹🇷','Анкара',       39.9334,  32.8597),
('Thailand',         'Таиланд',         'TH','THA','AS','🇹🇭','Бангкок',      13.7563, 100.5018),
('Japan',            'Япония',          'JP','JPN','AS','🇯🇵','Токио',        35.6762, 139.6503),
('UAE',              'ОАЭ',             'AE','ARE','AS','🇦🇪','Абу-Даби',     23.4241,  53.8478),
('Greece',           'Греция',          'GR','GRC','EU','🇬🇷','Афины',        37.9838,  23.7275),
('Czech Republic',   'Чехия',           'CZ','CZE','EU','🇨🇿','Прага',        50.0755,  14.4378),
('Hungary',          'Венгрия',         'HU','HUN','EU','🇭🇺','Будапешт',     47.4979,  19.0402),
('Indonesia',        'Индонезия',       'ID','IDN','AS','🇮🇩','Джакарта',     -6.2088, 106.8456),
('Portugal',         'Португалия',      'PT','PRT','EU','🇵🇹','Лиссабон',     38.7223,  -9.1393),
('Egypt',            'Египет',          'EG','EGY','AF','🇪🇬','Каир',         30.0444,  31.2357),
('China',            'Китай',           'CN','CHN','AS','🇨🇳','Пекин',        39.9042, 116.4074),
('USA',              'США',             'US','USA','NA','🇺🇸','Вашингтон',    38.8951, -77.0364),
('Georgia',          'Грузия',          'GE','GEO','AS','🇬🇪','Тбилиси',      41.7151,  44.8271),
('Montenegro',       'Черногория',      'ME','MNE','EU','🇲🇪','Подгорица',    42.4304,  19.2594),
('Armenia',          'Армения',         'AM','ARM','AS','🇦🇲','Ереван',        40.1792,  44.4991);
