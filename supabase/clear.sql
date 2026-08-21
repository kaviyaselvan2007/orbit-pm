-- supabase/clear.sql
-- Run this script in the Supabase SQL Editor (Project > SQL Editor > New query)
-- to clear all dummy data from the database, leaving only the seed profiles intact.

-- Clear business tracking and logs
TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.work_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.outcome_activities RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.project_outcomes RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.projects RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.clients RESTART IDENTITY CASCADE;
DELETE FROM public.employees;

-- Delete profiles not matching primary seed users
DELETE FROM public.profiles 
WHERE email NOT IN ('admin@axiocloudsolutions.com', 'pm@orbitpm.com', 'employee@orbitpm.com');

-- Recreate base employee records for remaining seed profiles
INSERT INTO public.employees (emp_code, name, email, phone, department, designation, assigned_projects, daily_hours, weekly_hours, productivity_score, workload, profile_id)
SELECT emp_code, name, email, phone, department, designation, '', 0, 0, 0, 'Low', id
FROM public.profiles;
