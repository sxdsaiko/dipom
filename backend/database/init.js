const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQLHOST,
            port: process.env.MYSQLPORT,
            user: process.env.MYSQLUSER,
            password: process.env.MYSQLPASSWORD,
            database: process.env.MYSQLDATABASE,
            multipleStatements: true
        });

        console.log('✅ Connected to MySQL');

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        await connection.query(schema);

        console.log('✅ Database initialized');

        await connection.end();
    } catch (err) {
        console.error('❌ DB init error:', err);
        process.exit(1);
    }
}

initDatabase();
