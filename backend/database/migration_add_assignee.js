// backend/database/migration_add_assignee.js
const { pool } = require('../config/db');

async function run() {
  try {
    console.log('Running migration: Add assignee to project_outcomes...');
    await pool.query(`
      ALTER TABLE project_outcomes 
      ADD COLUMN IF NOT EXISTS assignee TEXT;
    `);
    console.log('✅ Migration successful: assignee column added/exists.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
