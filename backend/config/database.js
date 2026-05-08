const mysql = require('mysql2/promise');
require('dotenv').config();

const url = process.env.MYSQL_URL || process.env.DATABASE_URL;

const poolConfig = url
  ? { uri: url }
  : {
      host:     process.env.DB_HOST || process.env.MYSQLHOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
      user:     process.env.DB_USER || process.env.MYSQLUSER     || 'root',
      password: process.env.DB_PASS || process.env.MYSQLPASSWORD || '',
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'wanderlog',
    };

const pool = mysql.createPool({
  ...poolConfig,
  waitForConnections: true,
  connectionLimit:   20,
  queueLimit:        0,
  charset:           'utf8mb4',
  timezone:          '+00:00',
  dateStrings:       ['DATE'],
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    const [[row]] = await conn.query('SELECT DATABASE() AS db');
    console.log('✅  MySQL connected:', row.db);
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection error:',
      err.code || '(no code)',
      err.errno || '',
      err.message || '(no message)',
      '\nhost:', poolConfig.host || '(uri)',
      'port:', poolConfig.port || '(uri)',
      'user:', poolConfig.user || '(uri)',
      'db:',   poolConfig.database || '(uri)'
    );
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
