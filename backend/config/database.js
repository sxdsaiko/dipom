const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              parseInt(process.env.DB_PORT) || 3306,
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASS     || '',
  database:          process.env.DB_NAME     || 'wanderlog',
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
    console.log('✅  MySQL connected:', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
