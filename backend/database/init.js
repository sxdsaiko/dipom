const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDatabase() {
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL);

        console.log('Connected to MySQL');

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        const queries = schema
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length);

        for (const query of queries) {
            await connection.query(query);
        }

        console.log('Database initialized successfully');

        await connection.end();
    } catch (error) {
        console.error('DB init error:', error);
        process.exit(1);
    }
}

initDatabase();
