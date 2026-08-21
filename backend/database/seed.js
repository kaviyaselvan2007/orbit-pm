// database/seed.js
// Populates the Supabase database with realistic demo data.
// Usage: npm run seed   (from the backend/ folder)
require('dotenv').config();
const { pool } = require('../config/db');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding ORBITPM database...');

    // Clear existing business data
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM work_logs');
    await client.query('DELETE FROM outcome_activities');
    await client.query('DELETE FROM project_outcomes');
    await client.query('DELETE FROM projects');
    await client.query('DELETE FROM employees');
    await client.query('DELETE FROM clients');

    console.log('Cleared existing business tables.');

    // ---- Clients ----
    const clients = [
      ['CLI-001', 'Acma Corp', 'Acma Corporation', 'Alice Johnson', 'alice@acmacorp.com', '+1 415 555 1001', 2, 1, 1, 'Low'],
      ['CLI-002', 'Beta Retailers', 'Beta Retailers LLC', 'Bob Smith', 'bob@betaretailers.com', '+1 415 555 1002', 2, 1, 0, 'Medium'],
      ['CLI-003', 'Delta Logistics', 'Delta Global Logistics', 'Charlie Davis', 'charlie@deltalog.com', '+1 415 555 1003', 1, 0, 0, 'High'],
      ['CLI-004', 'Globex Corp', 'Globex International', 'Diana Prince', 'diana@globex.com', '+1 415 555 1004', 0, 0, 0, 'Low'],
      ['CLI-005', 'Nexus FinTech', 'Nexus FinTech Group', 'Edward Stark', 'edward@nexusfin.com', '+1 415 555 1005', 1, 1, 0, 'High']
    ];

    const clientIds = {};
    for (const c of clients) {
      const r = await client.query(
        `INSERT INTO clients (client_code, name, company, contact_person, email, phone, project_count, active_projects, completed_projects, risk_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`, c);
      clientIds[c[0]] = r.rows[0].id;
    }
    console.log('Seeded Clients.');

    // ---- Employees ----
    // Set join dates for profiles
    await client.query("UPDATE public.profiles SET join_date = '2021-03-15' WHERE email = 'admin@axiocloudsolutions.com'");
    await client.query("UPDATE public.profiles SET join_date = '2022-01-10' WHERE email = 'pm@orbitpm.com'");
    await client.query("UPDATE public.profiles SET join_date = '2023-06-01' WHERE email = 'employee@orbitpm.com'");

    // Fetch profiles first to link profile_id to employee records
    const profilesRes = await client.query("SELECT id, email FROM public.profiles");
    const profileMap = {};
    profilesRes.rows.forEach(p => {
      profileMap[p.email.toLowerCase()] = p.id;
    });

    const employees = [
      ['EMP-001', 'Amara James', 'admin@axiocloudsolutions.com', '+1 415 555 0110', 'Executive', 'Platform Administrator', 'PRJ-001', 2.0, 10.0, 95, 'Low', profileMap['admin@axiocloudsolutions.com'] || null],
      ['EMP-002', 'Derek Okafor', 'pm@orbitpm.com', '+1 415 555 0121', 'Delivery', 'Senior Project Manager', 'PRJ-002', 4.0, 20.0, 90, 'Low', profileMap['pm@orbitpm.com'] || null],
      ['EMP-003', 'Priya Nandan', 'employee@orbitpm.com', '+1 415 555 0134', 'Engineering', 'Software Engineer', 'PRJ-001,PRJ-002,PRJ-003,PRJ-005', 8.0, 40.0, 88, 'Medium', profileMap['employee@orbitpm.com'] || null],
      ['EMP-004', 'John Smith', 'john.smith@orbitpm.com', '+1 415 555 0199', 'QA', 'QA Lead', 'PRJ-003,PRJ-005', 10.0, 50.0, 92, 'Overloaded', null],
      ['EMP-005', 'Sarah Connor', 'sarah.c@orbitpm.com', '+1 415 555 0100', 'DevOps', 'DevOps Specialist', 'PRJ-003,PRJ-004', 2.0, 10.0, 85, 'Low', null],
      ['EMP-006', 'Bruce Wayne', 'bruce@wayne.co', '+1 415 555 0107', 'Security', 'Security Engineer', 'PRJ-005', 8.0, 40.0, 98, 'Medium', null],
      ['EMP-007', 'Clark Kent', 'clark@dailyplanet.com', '+1 415 555 0182', 'Engineering', 'Technical Writer', 'PRJ-004', 4.0, 20.0, 80, 'Low', null]
    ];

    const empIds = {};
    for (const e of employees) {
      const r = await client.query(
        `INSERT INTO employees (emp_code, name, email, phone, department, designation, assigned_projects, daily_hours, weekly_hours, productivity_score, workload, profile_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`, e);
      empIds[e[0]] = r.rows[0].id;
    }
    console.log('Seeded Employees.');

    // ---- Projects ----
    const projects = [
      ['PRJ-001', 'OrbitPM Core Development', clientIds['CLI-001'], '2026-06-01', '2026-12-31', 65, 'High', 'Active', 'Amara James, Priya Nandan', 'Core AI engine optimization and timesheet modules'],
      ['PRJ-002', 'Acma Portal Enhancement', clientIds['CLI-001'], '2026-01-10', '2026-05-30', 100, 'Medium', 'Completed', 'Derek Okafor, Priya Nandan', 'Upgraded client portal for invoice generation'],
      ['PRJ-003', 'Beta Checkout Redesign', clientIds['CLI-002'], '2026-05-01', '2026-08-31', 30, 'High', 'Delayed', 'Priya Nandan, John Smith, Sarah Connor', 'Redesign cart and payment flow with Stripe integrations'],
      ['PRJ-004', 'Delta Supply Chain Sync', clientIds['CLI-003'], '2026-04-15', '2026-10-15', 45, 'Low', 'On Hold', 'Sarah Connor, Clark Kent', 'Synchronize inventory endpoints with third-party logistics'],
      ['PRJ-005', 'Nexus Payment Gateway', clientIds['CLI-005'], '2026-07-01', '2026-11-30', 10, 'High', 'Active', 'Priya Nandan, Bruce Wayne, John Smith', 'Secure 3DS 2.0 gateway implementation for financial services']
    ];

    const projectIds = {};
    for (const p of projects) {
      const r = await client.query(
        `INSERT INTO projects (project_code, name, client_id, start_date, end_date, progress, priority, status, assigned_employees, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`, p);
      projectIds[p[0]] = r.rows[0].id;
    }
    console.log('Seeded Projects.');

    // ---- Project Outcomes (Timesheet Sizing) ----
    const outcomes = [
      [projectIds['PRJ-001'], 'SLG-POSENH-1', 'Auth Refactoring', '{"business_score":1,"technical_score":1,"integration_score":0,"testing_score":0,"data_score":0,"bottom_up_hours":4}', 'Original', 'Approved', 4, 3, 'In Progress', '2026-06-01', '2026-07-31', 'Priya Nandan'],
      [projectIds['PRJ-001'], 'SLG-POSENH-2', 'Auto-Cancel Short-Picked Lines', '{"business_score":2,"technical_score":3,"integration_score":1,"testing_score":1,"data_score":1,"bottom_up_hours":30}', 'Original', 'Approved', 32, 28, 'Done', '2026-06-10', '2026-07-10', 'Priya Nandan'],
      [projectIds['PRJ-003'], 'BETA-CHECK-1', 'Stripe Integration', '{"business_score":3,"technical_score":3,"integration_score":3,"testing_score":2,"data_score":2,"bottom_up_hours":75}', 'Original', 'Pending', 72, 5, 'Blocked', '2026-05-15', '2026-08-30', 'John Smith'],
      [projectIds['PRJ-003'], 'BETA-CHECK-2', 'Cart Revamp', '{"business_score":1,"technical_score":2,"integration_score":1,"testing_score":1,"data_score":0,"bottom_up_hours":16}', 'Original', 'Approved', 16, 12, 'In Progress', '2026-05-01', '2026-08-15', 'Priya Nandan'],
      [projectIds['PRJ-005'], 'NEX-GW-1', '3DS 2.0 Auth', '{"business_score":3,"technical_score":4,"integration_score":3,"testing_score":3,"data_score":3,"bottom_up_hours":140}', 'Original', 'Approved', 140, 0, 'Not Started', '2026-07-01', '2026-11-30', 'Bruce Wayne']
    ];

    for (const o of outcomes) {
      await client.query(
        `INSERT INTO project_outcomes (project_id, outcome_code, title, description, effort_version, approval_status, approved_effort, actual_hours, deliverable_status, planned_start, forecast_end, assignee)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, o);
    }
    console.log('Seeded Project Outcomes.');

    // ---- Work Logs (Effort Tracking) ----
    const workLogs = [
      [empIds['EMP-003'], '2026-07-13', 'Refactored backend JWT validation middleware', 8.0],
      [empIds['EMP-003'], '2026-07-14', 'Implemented checkbox grid UI for project assignments', 8.0],
      [empIds['EMP-003'], '2026-07-15', 'Synced employee.assigned_projects on save', 8.0],
      [empIds['EMP-003'], '2026-07-16', 'Tested database trigger and manual seed scripts', 8.0],
      
      [empIds['EMP-004'], '2026-07-13', 'Writing end-to-end integration tests for payment portal', 10.0],
      [empIds['EMP-004'], '2026-07-14', 'Writing unit tests for authentication endpoints', 10.0],
      [empIds['EMP-004'], '2026-07-15', 'Debugging session token expiration issues', 10.0],
      [empIds['EMP-004'], '2026-07-16', 'Simulating high concurrency loads on checkout page', 10.0],
      [empIds['EMP-004'], '2026-07-17', 'Testing 3DS redirect flows under slow connections', 10.0],

      [empIds['EMP-005'], '2026-07-15', 'Configure Github Actions CI workflow', 5.0],
      [empIds['EMP-005'], '2026-07-16', 'Provision staging database replica', 5.0]
    ];

    for (const wl of workLogs) {
      await client.query(
        `INSERT INTO work_logs (employee_id, log_date, task, hours)
         VALUES ($1, $2, $3, $4)`, wl);
    }
    console.log('Seeded Work Logs.');

    // ---- Notifications ----
    const notifications = [
      ['warn', 'Workload Alert: John Smith', 'John Smith is overloaded with 50 hours/week.', false, '2026-07-17T08:30:00Z'],
      ['risk', 'High-Risk Alert: Beta Checkout Redesign', 'Beta Checkout Redesign is classified as High Risk: Progress is 25 pts behind expected schedule pace; Assigned team is overloaded.', false, '2026-07-16T14:45:00Z'],
      ['update', 'Deadline Reminder: OrbitPM Core Development', 'OrbitPM Core Development is approaching its deadline on 2026-12-31.', false, '2026-07-17T09:00:00Z'],
      ['update', 'Project Outcome Approved: SLG-POSENH-2', 'SLG-POSENH-2 has been approved for delivery.', true, '2026-07-15T11:00:00Z']
    ];

    for (const n of notifications) {
      await client.query(
        `INSERT INTO notifications (type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5)`, n);
    }
    console.log('Seeded Notifications.');

    console.log('✅  Seed complete.');
  } catch (err) {
    console.error('❌  Seed failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
