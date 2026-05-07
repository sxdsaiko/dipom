const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
    });

    console.log("✅ MySQL WORKS");
    await conn.end();
  } catch (e) {
    console.error("❌ REAL ERROR:", e);
  }
})();
