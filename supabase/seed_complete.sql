-- ===========================================================================
-- ORBITPM — Complete Consistent Seed Data
-- Run this in Supabase SQL Editor (New Query -> Run)
-- ===========================================================================

-- 1. Clean existing dummy data (preserves profiles so your logged-in user stays intact)
TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.work_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.outcome_activities RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.project_outcomes RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.projects RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.employees RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.clients RESTART IDENTITY CASCADE;

-- 2. Insert Realistic Clients
INSERT INTO public.clients (client_code, name, company, contact_person, email, phone, project_count, active_projects, completed_projects, risk_level)
VALUES
  ('CLI-001', 'TechSphere Global', 'TechSphere Corp', 'Elena Rostova', 'elena@techsphere.com', '+1 (555) 234-5678', 2, 2, 0, 'Medium'),
  ('CLI-002', 'FinEdge Capital', 'FinEdge Group', 'Robert Sterling', 'rsterling@finedge.com', '+1 (555) 345-6789', 2, 1, 1, 'High'),
  ('CLI-003', 'HealthPulse Innovations', 'HealthPulse Medical', 'Dr. Sarah Connor', 's.connor@healthpulse.org', '+1 (555) 456-7890', 1, 0, 1, 'Low'),
  ('CLI-004', 'Acme Cloud Dynamics', 'Acme Corp', 'Thomas Wayne', 'twayne@acmecloud.com', '+1 (555) 567-8901', 1, 1, 0, 'Low');

-- 3. Insert Realistic Employees across Departments
INSERT INTO public.employees (emp_code, name, email, phone, department, designation, assigned_projects, daily_hours, weekly_hours, productivity_score, workload)
VALUES
  ('EMP-001', 'Alex Morgan', 'alex.morgan@orbitpm.com', '+1 (555) 101-2001', 'Engineering', 'Lead Solutions Architect', 'Cloud Migration & Modernization, Internal DevOps Automation', 8.0, 40.0, 94, 'High'),
  ('EMP-002', 'Priya Sharma', 'priya.sharma@orbitpm.com', '+1 (555) 101-2002', 'Engineering', 'Senior Full Stack Developer', 'Cloud Migration & Modernization, AI Project Risk Engine', 8.5, 42.5, 91, 'High'),
  ('EMP-003', 'Marcus Vance', 'marcus.vance@orbitpm.com', '+1 (555) 101-2003', 'AI & Analytics', 'Lead AI/ML Engineer', 'AI Project Risk Engine', 7.5, 37.5, 88, 'Medium'),
  ('EMP-004', 'Sarah Jenkins', 'sarah.jenkins@orbitpm.com', '+1 (555) 101-2004', 'Quality Assurance', 'Lead QA Engineer', 'Mobile Banking Application, Healthcare Portal UI/UX', 9.0, 45.0, 82, 'Overloaded'),
  ('EMP-005', 'David Chen', 'david.chen@orbitpm.com', '+1 (555) 101-2005', 'DevOps & Infra', 'Senior DevOps Engineer', 'Mobile Banking Application, Internal DevOps Automation', 8.0, 40.0, 89, 'High'),
  ('EMP-006', 'Rachel Green', 'rachel.green@orbitpm.com', '+1 (555) 101-2006', 'Product & Design', 'Lead UI/UX Designer', 'Healthcare Portal UI/UX, Cloud Migration & Modernization', 6.5, 32.5, 95, 'Low');

-- 4. Auto-link any existing profiles to employees by email
UPDATE public.employees e
SET profile_id = p.id
FROM public.profiles p
WHERE LOWER(e.email) = LOWER(p.email) OR LOWER(e.name) = LOWER(p.name);

-- 5. Insert Projects linked to Clients
INSERT INTO public.projects (project_code, name, client_id, start_date, end_date, progress, priority, status, assigned_employees, remarks)
VALUES
  (
    'PRJ-001',
    'Cloud Migration & Modernization',
    (SELECT id FROM public.clients WHERE client_code = 'CLI-001' LIMIT 1),
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '45 days',
    68,
    'High',
    'Active',
    'Alex Morgan, Priya Sharma, Rachel Green',
    'Phase 2 microservices migration underway. On schedule with minor latency optimizations pending.'
  ),
  (
    'PRJ-002',
    'AI Project Risk Engine',
    (SELECT id FROM public.clients WHERE client_code = 'CLI-002' LIMIT 1),
    CURRENT_DATE - INTERVAL '20 days',
    CURRENT_DATE + INTERVAL '60 days',
    52,
    'High',
    'Active',
    'Priya Sharma, Marcus Vance',
    'Predictive risk modeling models trained. Integration with live telemetry APIs in progress.'
  ),
  (
    'PRJ-003',
    'Mobile Banking Application',
    (SELECT id FROM public.clients WHERE client_code = 'CLI-002' LIMIT 1),
    CURRENT_DATE - INTERVAL '50 days',
    CURRENT_DATE + INTERVAL '10 days',
    35,
    'High',
    'Delayed',
    'Sarah Jenkins, David Chen',
    'Payment gateway security compliance bottleneck causing milestone delay. Escalated to FinEdge security team.'
  ),
  (
    'PRJ-004',
    'Healthcare Portal UI/UX',
    (SELECT id FROM public.clients WHERE client_code = 'CLI-003' LIMIT 1),
    CURRENT_DATE - INTERVAL '90 days',
    CURRENT_DATE - INTERVAL '5 days',
    100,
    'Medium',
    'Completed',
    'Rachel Green, Sarah Jenkins',
    'Successfully delivered ahead of schedule. HIPAA compliance certification achieved.'
  ),
  (
    'PRJ-005',
    'Internal DevOps Automation',
    (SELECT id FROM public.clients WHERE client_code = 'CLI-004' LIMIT 1),
    CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE + INTERVAL '75 days',
    40,
    'Medium',
    'Active',
    'Alex Morgan, David Chen',
    'Kubernetes cluster autoscaling and Terraform CI pipelines fully operational.'
  );

-- 6. Insert Project Outcomes / Milestones
INSERT INTO public.project_outcomes (
  project_id, outcome_code, title, description, definition_of_done, 
  requested_date, due_date, tshirt_size, effort_version, approval_status, 
  approved_effort, actual_hours, deliverable_status, planned_start, forecast_end, 
  completion_date, schedule_status, remaining_hours, eac_hours, percent_complete,
  business_score, technical_score, integration_score, testing_score, data_score,
  bottom_up_hours, assignee
)
VALUES
  (
    (SELECT id FROM public.projects WHERE project_code = 'PRJ-001' LIMIT 1),
    'OUT-001',
    'Core Database Re-architecture',
    'Migrate legacy monolithic SQL database to distributed PostgreSQL cluster.',
    'All schema migrated, zero data loss, replication verified under load test.',
    CURRENT_DATE - INTERVAL '25 days',
    CURRENT_DATE + INTERVAL '10 days',
    'XL', 'Original', 'Approved',
    160.0, 110.0, 'In Progress',
    CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days',
    NULL, 'On Track', 50.0, 160.0, 70,
    8, 9, 8, 8, 9, 155.0, 'Alex Morgan'
  ),
  (
    (SELECT id FROM public.projects WHERE project_code = 'PRJ-002' LIMIT 1),
    'OUT-002',
    'Risk Prediction ML Pipeline',
    'Train and evaluate random forest and gradient boosted classification models.',
    'AUC-ROC > 0.90, inference latency < 200ms, deployed on cloud worker.',
    CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE + INTERVAL '20 days',
    'L', 'Original', 'Approved',
    120.0, 65.0, 'In Progress',
    CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '20 days',
    NULL, 'On Track', 55.0, 120.0, 55,
    9, 9, 7, 8, 9, 115.0, 'Marcus Vance'
  ),
  (
    (SELECT id FROM public.projects WHERE project_code = 'PRJ-003' LIMIT 1),
    'OUT-003',
    'Payment Gateway 3DS2 Integration',
    'Integrate secure PCI-DSS compliant credit card and bank transfer gateway.',
    'Sandbox tests passed, biometric authentication hooked, webhook handling resilient.',
    CURRENT_DATE - INTERVAL '40 days',
    CURRENT_DATE - INTERVAL '5 days',
    'XXL', 'Original', 'Approved',
    200.0, 180.0, 'Blocked',
    CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE + INTERVAL '15 days',
    NULL, 'Delayed', 60.0, 240.0, 40,
    9, 8, 9, 9, 8, 220.0, 'Sarah Jenkins'
  ),
  (
    (SELECT id FROM public.projects WHERE project_code = 'PRJ-004' LIMIT 1),
    'OUT-004',
    'Patient Dashboard Redesign',
    'Modernize patient appointment and medical records web interface with accessibility.',
    'WCAG 2.1 AA compliant, responsive across all tablet/mobile viewports.',
    CURRENT_DATE - INTERVAL '70 days',
    CURRENT_DATE - INTERVAL '10 days',
    'M', 'Original', 'Approved',
    90.0, 88.0, 'Done',
    CURRENT_DATE - INTERVAL '70 days', CURRENT_DATE - INTERVAL '10 days',
    CURRENT_DATE - INTERVAL '10 days', 'On Track', 0.0, 88.0, 100,
    7, 7, 6, 8, 6, 85.0, 'Rachel Green'
  ),
  (
    (SELECT id FROM public.projects WHERE project_code = 'PRJ-005' LIMIT 1),
    'OUT-005',
    'Terraform Infrastructure as Code',
    'Automate VPC, Kubernetes EKS, RDS, and CloudWatch provisioning via Terraform.',
    'Fully reproducible environment spun up in < 12 minutes through GitHub Actions.',
    CURRENT_DATE - INTERVAL '10 days',
    CURRENT_DATE + INTERVAL '30 days',
    'L', 'Original', 'Approved',
    100.0, 40.0, 'In Progress',
    CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '30 days',
    NULL, 'On Track', 60.0, 100.0, 40,
    8, 9, 8, 7, 7, 95.0, 'David Chen'
  );

-- 7. Insert Outcome Activities / Subtasks
INSERT INTO public.outcome_activities (
  outcome_id, effort_version, activity, application, assignee, workstream,
  estimated_effort_hours, actuals_hours, status, planned_start, work_days, forecast_end
)
VALUES
  (
    (SELECT id FROM public.project_outcomes WHERE outcome_code = 'OUT-001' LIMIT 1),
    'Original', 'Schema Conversion & Index Optimization', 'PostgreSQL DB', 'Alex Morgan', 'Backend Architecture',
    40.0, 40.0, 'Done', CURRENT_DATE - INTERVAL '20 days', 5, CURRENT_DATE - INTERVAL '15 days'
  ),
  (
    (SELECT id FROM public.project_outcomes WHERE outcome_code = 'OUT-001' LIMIT 1),
    'Original', 'Data Migration Scripts & Dry Runs', 'PostgreSQL DB', 'Priya Sharma', 'Database Engineering',
    60.0, 45.0, 'In Progress', CURRENT_DATE - INTERVAL '14 days', 8, CURRENT_DATE + INTERVAL '2 days'
  ),
  (
    (SELECT id FROM public.project_outcomes WHERE outcome_code = 'OUT-002' LIMIT 1),
    'Original', 'Feature Engineering on Timesheet & Risk Data', 'Python / Scikit', 'Marcus Vance', 'Data Science',
    50.0, 40.0, 'Done', CURRENT_DATE - INTERVAL '15 days', 6, CURRENT_DATE - INTERVAL '8 days'
  ),
  (
    (SELECT id FROM public.project_outcomes WHERE outcome_code = 'OUT-003' LIMIT 1),
    'Original', 'Third-Party Bank API Webhook Validation', 'Node.js Gateway', 'Sarah Jenkins', 'Security QA',
    80.0, 75.0, 'Blocked', CURRENT_DATE - INTERVAL '20 days', 10, CURRENT_DATE + INTERVAL '10 days'
  ),
  (
    (SELECT id FROM public.project_outcomes WHERE outcome_code = 'OUT-005' LIMIT 1),
    'Original', 'Terraform Modules for EKS Cluster & Ingress', 'Terraform / AWS', 'David Chen', 'Cloud Ops',
    50.0, 30.0, 'In Progress', CURRENT_DATE - INTERVAL '10 days', 7, CURRENT_DATE + INTERVAL '15 days'
  );

-- 8. Insert Work Logs (Timesheet Records)
INSERT INTO public.work_logs (employee_id, log_date, task, hours)
VALUES
  ((SELECT id FROM public.employees WHERE emp_code = 'EMP-001' LIMIT 1), CURRENT_DATE, 'Schema optimization & index tuning on distributed DB', 8.0),
  ((SELECT id FROM public.employees WHERE emp_code = 'EMP-001' LIMIT 1), CURRENT_DATE - INTERVAL '1 day', 'Migration dry run test on staging replica', 8.0),
  ((SELECT id FROM public.employees WHERE emp_code = 'EMP-002' LIMIT 1), CURRENT_DATE, 'Feature pipeline integration for real-time risk API', 8.5),
  ((SELECT id FROM public.employees WHERE emp_code = 'EMP-002' LIMIT 1), CURRENT_DATE - INTERVAL '1 day', 'Refactoring query middleware for Supabase RLS', 8.5),
  ((SELECT id FROM public.employees WHERE emp_code = 'EMP-003' LIMIT 1), CURRENT_DATE, 'Model retraining with historical sprint velocity data', 7.5),
  ((SELECT id FROM public.employees WHERE emp_code = 'EMP-004' LIMIT 1), CURRENT_DATE, 'Investigating 3DS2 webhook callback timeout issue', 9.0),
  ((SELECT id FROM public.employees WHERE emp_code = 'EMP-005' LIMIT 1), CURRENT_DATE, 'Terraform EKS autoscaling node group configuration', 8.0),
  ((SELECT id FROM public.employees WHERE emp_code = 'EMP-006' LIMIT 1), CURRENT_DATE, 'High-fidelity mockups review and asset export', 6.5);

-- 9. Insert Realistic Notifications & System Alerts
INSERT INTO public.notifications (type, title, message, is_read, created_at)
VALUES
  ('risk', 'High-Risk Alert: Mobile Banking Application', 'Project is 35% complete with 10 days remaining. Payment Gateway compliance bottleneck requires PM escalation.', false, NOW() - INTERVAL '1 hour'),
  ('warn', 'Workload Alert: Sarah Jenkins', 'Employee Sarah Jenkins workload is marked Overloaded (45.0 hrs/week across 2 active projects).', false, NOW() - INTERVAL '4 hours'),
  ('update', 'Milestone Completed: Patient Dashboard Redesign', 'Rachel Green marked Patient Dashboard Redesign milestone as 100% completed.', false, NOW() - INTERVAL '1 day'),
  ('update', 'Project On Track: Cloud Migration & Modernization', 'Phase 1 milestones completed on schedule. Database replication performance verified.', true, NOW() - INTERVAL '2 days');
