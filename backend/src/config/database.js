const { Pool, types } = require('pg');
require('dotenv').config({ quiet: true });

// DATE zostaje tekstem RRRR-MM-DD (bez przesunięcia strefy czasowej),
// a NUMERIC liczbą, żeby API zwracało ilości jako number.
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Supabase wymaga szyfrowanego połączenia; lokalny PostgreSQL zwykle nie.
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_MAX) || 5
});

pool.on('error', (err) => {
    console.error('Nieoczekiwany błąd PostgreSQL:', err);
});

const withTransaction = async (work) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = pool;
module.exports.withTransaction = withTransaction;
