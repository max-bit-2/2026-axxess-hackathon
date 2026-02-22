create extension if not exists "pgcrypto";

create type public.formula_source as enum ('patient', 'company', 'generated');
create type public.job_status as enum ('queued', 'in_progress', 'needs_review', 'verified', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'pharmacist',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  dob date,
  weight_kg numeric(6,2),
  bsa_m2 numeric(4,2),
  allergies text[] not null default '{}',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_name text not null,
  indication text,
  route text not null,
  dose_mg_per_kg numeric(10,4) not null check (dose_mg_per_kg > 0),
  frequency_per_day integer not null default 1 check (frequency_per_day > 0),
  strength_mg_per_ml numeric(10,4),
  dispense_volume_ml numeric(10,2),
  notes text,
  status text not null default 'queued',
  due_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.formulas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  medication_name text not null,
  name text not null,
  source public.formula_source not null,
  ingredient_profile jsonb not null default '[]'::jsonb,
  safety_profile jsonb not null default '{}'::jsonb,
  instructions text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ingredient_name text not null,
  ndc text,
  lot_number text not null,
  available_quantity numeric(12,4) not null check (available_quantity >= 0),
  unit text not null,
  expires_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.compounding_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  formula_id uuid references public.formulas(id) on delete set null,
  status public.job_status not null default 'queued',
  iteration_count integer not null default 0,
  priority smallint not null default 2,
  last_error text,
  pharmacist_feedback text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.calculation_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references public.compounding_jobs(id) on delete cascade,
  version integer not null check (version > 0),
  context jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  hard_checks jsonb not null default '{}'::jsonb,
  ai_review jsonb not null default '{}'::jsonb,
  overall_status text not null,
  is_final boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, version)
);

create table public.final_outputs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null unique references public.compounding_jobs(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  final_report jsonb not null default '{}'::jsonb,
  label_payload jsonb not null default '{}'::jsonb,
  approved_at timestamptz not null default timezone('utc', now())
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid references public.compounding_jobs(id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_patients_owner_id on public.patients(owner_id);
create index idx_prescriptions_owner_patient on public.prescriptions(owner_id, patient_id);
create index idx_formulas_owner_patient on public.formulas(owner_id, patient_id);
create index idx_inventory_owner_ingredient on public.inventory_lots(owner_id, ingredient_name);
create index idx_jobs_owner_status on public.compounding_jobs(owner_id, status);
create index idx_jobs_prescription on public.compounding_jobs(prescription_id);
create index idx_reports_job_version on public.calculation_reports(job_id, version desc);
create index idx_audit_owner_job on public.audit_events(owner_id, job_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

create trigger set_prescriptions_updated_at
before update on public.prescriptions
for each row execute function public.set_updated_at();

create trigger set_formulas_updated_at
before update on public.formulas
for each row execute function public.set_updated_at();

create trigger set_inventory_lots_updated_at
before update on public.inventory_lots
for each row execute function public.set_updated_at();

create trigger set_compounding_jobs_updated_at
before update on public.compounding_jobs
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.prescriptions enable row level security;
alter table public.formulas enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.compounding_jobs enable row level security;
alter table public.calculation_reports enable row level security;
alter table public.final_outputs enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "patients_owner_all"
on public.patients
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "prescriptions_owner_all"
on public.prescriptions
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "formulas_owner_all"
on public.formulas
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "inventory_owner_all"
on public.inventory_lots
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "jobs_owner_all"
on public.compounding_jobs
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "reports_owner_all"
on public.calculation_reports
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "final_outputs_owner_all"
on public.final_outputs
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "audit_owner_all"
on public.audit_events
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);
