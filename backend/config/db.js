// config/db.js
// Central Postgres connection pool (Supabase) used by every controller.
require('dotenv').config();
const { Pool, types } = require('pg');

// Return DATE and TIMESTAMP columns as plain strings instead of JS Date
// objects, so the rest of the codebase (which does new Date(project.start_date)
// and plain string comparisons) behaves the same as it did with mysql2.
types.setTypeParser(1082, (val) => val); // DATE
types.setTypeParser(1114, (val) => val); // TIMESTAMP WITHOUT TIME ZONE
types.setTypeParser(1184, (val) => val); // TIMESTAMPTZ

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});
async function testConnection() {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅  Supabase/Postgres connected:', res.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌  Database connection failed:', err.message);
    console.error('    Check backend/.env — DATABASE_URL must be your Supabase connection string.');
    console.error('    Find it in Supabase: Project Settings → Database → Connection string (URI).');
  }
}

module.exports = { pool, testConnection };
