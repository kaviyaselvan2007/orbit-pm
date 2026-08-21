// backend/database/migration_add_profile_settings.js
const { pool } = require('../config/db');

async function run() {
  try {
    console.log('Running migration: Add settings columns to public.profiles...');
    await pool.query(`
      ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light',
      ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English (US)',
      ADD COLUMN IF NOT EXISTS deadline_reminders BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS high_risk_warnings BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS workload_alerts BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS weekly_report_ready BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS login_alerts BOOLEAN DEFAULT true;
    `);
    console.log('✅ Migration successful: settings columns added to profiles.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
