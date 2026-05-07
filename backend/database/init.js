const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function init() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('railway')
            ? { rejectUnauthorized: false }
            : false
    });

    await client.connect();

    const schema = fs.readFileSync(
        path.join(__dirname, 'schema.sql'),
        'utf8'
    );

    await client.query(schema);

    console.log('Database initialized');

    await client.end();
}

init().catch(err => {
    console.error(err);
    process.exit(1);
});