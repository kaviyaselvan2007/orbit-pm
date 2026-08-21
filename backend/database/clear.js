// database/clear.js
// Clears all business data and dummy logs, keeping only active user profiles.
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function clear() {
  const client = await pool.connect();
  try {
    console.log('Clearing all dummy data from database...');
    
    await client.query('TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE public.work_logs RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE public.outcome_activities RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE public.project_outcomes RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE public.projects RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE public.clients RESTART IDENTITY CASCADE');
    await client.query('DELETE FROM public.employees');
    
    // Clear all profiles that are not the initial seed logins
    await client.query(`
      DELETE FROM public.profiles 
      WHERE email NOT IN ('admin@axiocloudsolutions.com', 'pm@orbitpm.com', 'employee@orbitpm.com')
    `);

    console.log('Re-creating default employee records...');
    
    // Find profiles for seeded users
    const profilesRes = await client.query("SELECT id, name, email, phone, department, designation, emp_code FROM public.profiles");
    for (const p of profilesRes.rows) {
      await client.query(`
        INSERT INTO public.employees (emp_code, name, email, phone, department, designation, assigned_projects, daily_hours, weekly_hours, productivity_score, workload, profile_id)
        VALUES ($1, $2, $3, $4, $5, $6, '', 0, 0, 0, 'Low', $7)
      `, [p.emp_code, p.name, p.email, p.phone, p.department, p.designation, p.id]);
    }

    console.log('✅ Clear complete. Database is clean of dummy entries.');
  } catch (err) {
    console.error('❌ Clear failed:', err);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

clear();
