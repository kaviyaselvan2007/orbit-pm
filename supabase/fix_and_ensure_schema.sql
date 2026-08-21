-- ===========================================================================
-- ORBITPM — Full Schema Fix & Ensure Script
-- Run this ONCE in Supabase SQL Editor → New Query → Run
-- It is safe to re-run: uses IF NOT EXISTS / DO blocks / ALTER IF NOT EXISTS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES — ensure all columns the app reads/writes exist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  emp_code      text UNIQUE,
  name          text NOT NULL,
  email         text NOT NULL,
  role          text NOT NULL DEFAULT 'Employee' CHECK (role IN ('Admin','Project Manager','Employee')),
  department    text,
  designation   text,
  phone         text,
  join_date     date DEFAULT current_date,
  avatar_url    text,
  two_factor    boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- Settings columns used by Settings.jsx / AuthContext.jsx
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme               text    DEFAULT 'light';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language            text    DEFAULT 'English (US)';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deadline_reminders  boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_risk_warnings  boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workload_alerts     boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_report_ready boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_alerts        boolean DEFAULT true;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles are viewable by any authenticated user') THEN
    CREATE POLICY "profiles are viewable by any authenticated user"
      ON public.profiles FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='users can update their own profile') THEN
    CREATE POLICY "users can update their own profile"
      ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

-- Allow authenticated users to INSERT their own profile row
-- (needed when handle_new_user trigger missed them, e.g. signed up before trigger existed)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='users can insert their own profile') THEN
    CREATE POLICY "users can insert their own profile"
      ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- BACKFILL: Create profile rows for any auth.users that have no profiles row
-- (covers users who signed up before the handle_new_user trigger was created)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  u RECORD;
  next_val integer;
  next_code text;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
  LOOP
    SELECT COALESCE(MAX(SUBSTRING(emp_code FROM '\d+')::integer), 0) + 1 INTO next_val FROM public.profiles;
    next_code := 'EMP-' || LPAD(next_val::text, 3, '0');
    INSERT INTO public.profiles (id, emp_code, name, email, role)
    VALUES (
      u.id,
      next_code,
      COALESCE(u.raw_user_meta_data->>'name', SPLIT_PART(u.email, '@', 1)),
      u.email,
      COALESCE(u.raw_user_meta_data->>'role', 'Employee')
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. AUTO-CREATE PROFILE trigger (fires on every new auth.users row)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_val bigint;
  next_code text;
BEGIN
  -- Safely find the next numeric employee code
  BEGIN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(emp_code, '\D', '', 'g'), '')::bigint), 0) + 1
    INTO next_val
    FROM public.profiles
    WHERE emp_code ~ '^EMP-\d+$';
  EXCEPTION WHEN OTHERS THEN
    next_val := NULL;
  END;

  IF next_val IS NULL OR next_val <= 0 THEN
    next_code := 'EMP-' || LPAD(FLOOR(RANDOM() * 900 + 100)::text, 3, '0');
  ELSE
    next_code := 'EMP-' || LPAD(next_val::text, 3, '0');
  END IF;

  -- Ensure code uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE emp_code = next_code) LOOP
    next_code := 'EMP-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0');
  END LOOP;

  INSERT INTO public.profiles (id, emp_code, name, email, role)
  VALUES (
    NEW.id,
    next_code,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Employee')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = COALESCE(public.profiles.role, EXCLUDED.role);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Prevent trigger failures from crashing the auth.users signup transaction
  RAISE WARNING 'handle_new_user trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. EMPLOYEES table — must exist before we create the trigger that writes to it
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  emp_code            text UNIQUE,
  name                text NOT NULL,
  email               text,
  phone               text,
  department          text,
  designation         text,
  assigned_projects   text,
  daily_hours         numeric(4,1) DEFAULT 0,
  weekly_hours        numeric(5,1) DEFAULT 0,
  productivity_score  int DEFAULT 0,
  workload            text DEFAULT 'Low' CHECK (workload IN ('Low','Medium','High','Overloaded')),
  profile_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='authenticated read employees') THEN
    CREATE POLICY "authenticated read employees" ON public.employees FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='authenticated write employees') THEN
    CREATE POLICY "authenticated write employees" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. AUTO-CREATE EMPLOYEE trigger (fires after each profile insert)
--    Ensures EVERY new signup automatically gets an employees row.
--    This permanently prevents "No employee record found" for any user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_profile_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_emp_code text;
BEGIN
  -- Already linked by profile_id? Skip.
  IF EXISTS (SELECT 1 FROM public.employees WHERE profile_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Employee row exists with same email? Just link it.
  IF NEW.email IS NOT NULL AND EXISTS (SELECT 1 FROM public.employees WHERE email = NEW.email) THEN
    UPDATE public.employees SET profile_id = NEW.id WHERE email = NEW.email AND (profile_id IS NULL OR profile_id != NEW.id);
    RETURN NEW;
  END IF;

  -- Pick code from profile or generate unique
  new_emp_code := COALESCE(NEW.emp_code, 'EMP-' || LPAD(FLOOR(RANDOM() * 900 + 100)::text, 3, '0'));
  WHILE EXISTS (SELECT 1 FROM public.employees WHERE emp_code = new_emp_code) LOOP
    new_emp_code := 'EMP-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0');
  END LOOP;

  INSERT INTO public.employees (
    emp_code, name, email, department, designation, profile_id,
    workload, productivity_score, weekly_hours, daily_hours
  ) VALUES (
    new_emp_code, NEW.name, NEW.email,
    NEW.department, NEW.designation, NEW.id,
    'Low', 0, 0, 0
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_profile_employee trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_make_employee ON public.profiles;
CREATE TRIGGER on_profile_created_make_employee
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_profile_employee();

-- ---------------------------------------------------------------------------
-- 5. BACKFILL — fix existing data so current users can log hours right now
-- ---------------------------------------------------------------------------
-- Link employees to profiles by matching email (where profile_id is missing)
UPDATE public.employees e
SET profile_id = p.id
FROM public.profiles p
WHERE e.email = p.email
  AND e.profile_id IS NULL;

-- Create employee rows for profiles that still have no employee record at all
DO $$
DECLARE
  p RECORD;
  emp_count integer;
  new_code text;
BEGIN
  FOR p IN
    SELECT pr.* FROM public.profiles pr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.profile_id = pr.id OR (e.email IS NOT NULL AND e.email = pr.email)
    )
  LOOP
    SELECT COUNT(*) INTO emp_count FROM public.employees;
    new_code := 'EMP-' || LPAD((emp_count + 1)::text, 3, '0');
    INSERT INTO public.employees (
      emp_code, name, email, department, designation, profile_id,
      workload, productivity_score, weekly_hours, daily_hours
    ) VALUES (
      new_code, p.name, p.email, p.department, p.designation, p.id,
      'Low', 0, 0, 0
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. CLIENTS table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_code         text UNIQUE,
  name                text NOT NULL,
  company             text,
  contact_person      text,
  email               text,
  phone               text,
  project_count       int DEFAULT 0,
  active_projects     int DEFAULT 0,
  completed_projects  int DEFAULT 0,
  risk_level          text DEFAULT 'Low' CHECK (risk_level IN ('Low','Medium','High')),
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='authenticated read clients') THEN
    CREATE POLICY "authenticated read clients" ON public.clients FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='authenticated write clients') THEN
    CREATE POLICY "authenticated write clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. PROJECTS table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_code        text UNIQUE,
  name                text NOT NULL,
  client_id           bigint REFERENCES public.clients(id) ON DELETE SET NULL,
  start_date          date,
  end_date            date,
  progress            int DEFAULT 0,
  priority            text DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
  status              text DEFAULT 'Active' CHECK (status IN ('Active','Completed','Delayed','On Hold')),
  assigned_employees  text,
  remarks             text,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='authenticated read projects') THEN
    CREATE POLICY "authenticated read projects" ON public.projects FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='authenticated write projects') THEN
    CREATE POLICY "authenticated write projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. PROJECT_OUTCOMES — ensure all columns used by Timesheet.jsx
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_outcomes (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id          bigint NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  outcome_code        text UNIQUE NOT NULL,
  title               text NOT NULL,
  description         text,
  definition_of_done  text,
  requested_date      date,
  tshirt_size         text CHECK (tshirt_size IN ('XS','S','M','L','XL','XXL','3XL')),
  due_date            date,
  effort_version      text DEFAULT 'Original',
  approval_status     text DEFAULT 'Pending' CHECK (approval_status IN ('Pending','Approved','Rejected')),
  approved_effort     numeric(6,1) DEFAULT 0,
  actual_hours        numeric(6,1) DEFAULT 0,
  deliverable_status  text DEFAULT 'Not Started' CHECK (deliverable_status IN ('Not Started','In Progress','Done','Blocked')),
  planned_start       date,
  forecast_end        date,
  completion_date     date,
  is_active           boolean DEFAULT true,
  approval_date       date,
  schedule_status     text DEFAULT 'On Track' CHECK (schedule_status IN ('On Track','At Risk','Delayed')),
  remaining_hours     numeric(6,1) DEFAULT 0,
  eac_hours           numeric(6,1) DEFAULT 0,
  percent_complete    int DEFAULT 0,
  business_score      integer DEFAULT 0,
  technical_score     integer DEFAULT 0,
  integration_score   integer DEFAULT 0,
  testing_score       integer DEFAULT 0,
  data_score          integer DEFAULT 0,
  bottom_up_hours     numeric(6,1) DEFAULT 0,
  assignee            text,
  created_at          timestamptz DEFAULT now()
);

-- For older deployments that predate these columns:
ALTER TABLE public.project_outcomes ADD COLUMN IF NOT EXISTS business_score    integer DEFAULT 0;
ALTER TABLE public.project_outcomes ADD COLUMN IF NOT EXISTS technical_score   integer DEFAULT 0;
ALTER TABLE public.project_outcomes ADD COLUMN IF NOT EXISTS integration_score integer DEFAULT 0;
ALTER TABLE public.project_outcomes ADD COLUMN IF NOT EXISTS testing_score     integer DEFAULT 0;
ALTER TABLE public.project_outcomes ADD COLUMN IF NOT EXISTS data_score        integer DEFAULT 0;
ALTER TABLE public.project_outcomes ADD COLUMN IF NOT EXISTS bottom_up_hours   numeric(6,1) DEFAULT 0;
ALTER TABLE public.project_outcomes ADD COLUMN IF NOT EXISTS assignee          text;

ALTER TABLE public.project_outcomes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_outcomes' AND policyname='authenticated read outcomes') THEN
    CREATE POLICY "authenticated read outcomes" ON public.project_outcomes FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_outcomes' AND policyname='authenticated write outcomes') THEN
    CREATE POLICY "authenticated write outcomes" ON public.project_outcomes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. OUTCOME_ACTIVITIES table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outcome_activities (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outcome_id             bigint NOT NULL REFERENCES public.project_outcomes(id) ON DELETE CASCADE,
  effort_version         text DEFAULT 'Original',
  activity               text NOT NULL,
  application            text,
  assignee               text,
  workstream             text,
  estimated_effort_hours numeric(6,1) DEFAULT 0,
  actuals_hours          numeric(6,1) DEFAULT 0,
  status                 text DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Done','Blocked')),
  planned_start          date,
  work_days              int DEFAULT 0,
  forecast_end           date,
  completion_date        date,
  proj_start             date,
  cum_hours              numeric(6,1) DEFAULT 0,
  created_at             timestamptz DEFAULT now()
);
ALTER TABLE public.outcome_activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outcome_activities' AND policyname='authenticated read outcome activities') THEN
    CREATE POLICY "authenticated read outcome activities" ON public.outcome_activities FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outcome_activities' AND policyname='authenticated write outcome activities') THEN
    CREATE POLICY "authenticated write outcome activities" ON public.outcome_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10. WORK_LOGS table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id   bigint NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  log_date      date NOT NULL,
  task          text,
  hours         numeric(4,1) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_logs' AND policyname='authenticated read worklogs') THEN
    CREATE POLICY "authenticated read worklogs" ON public.work_logs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_logs' AND policyname='authenticated write worklogs') THEN
    CREATE POLICY "authenticated write worklogs" ON public.work_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11. NOTIFICATIONS table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        text DEFAULT 'update' CHECK (type IN ('update','warn','risk')),
  title       text,
  message     text,
  is_read     boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='authenticated read notifications') THEN
    CREATE POLICY "authenticated read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='authenticated write notifications') THEN
    CREATE POLICY "authenticated write notifications" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ===========================================================================
-- Done. All tables, columns, triggers, backfill, and RLS policies are set.
-- ===========================================================================
