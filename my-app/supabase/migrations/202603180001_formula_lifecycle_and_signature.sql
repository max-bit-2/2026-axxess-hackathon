create type if not exists public.formula_lifecycle_status as enum (
  'draft',
  'active',
  'rejected',
  'superseded'
);

alter table public.formulas
  add column if not exists formula_lifecycle_status public.formula_lifecycle_status not null default 'active',
  add column if not exists template_signature text,
  add column if not exists generation_metadata jsonb not null default '{}'::jsonb,
  add column if not exists generation_model text,
  add column if not exists formula_status_changed_at timestamptz,
  add column if not exists formula_status_changed_by uuid references auth.users(id) on delete set null;

update public.formulas
  set formula_lifecycle_status = case
    when is_active then 'active'::public.formula_lifecycle_status
    else 'rejected'::public.formula_lifecycle_status
  end
  where formula_lifecycle_status = 'active'
    and (is_active = false or is_active is null);

create index if not exists idx_formulas_reusable_active
  on public.formulas(owner_id, medication_name, source)
  where formula_lifecycle_status = 'active' and is_active = true;

create index if not exists idx_formulas_signature
  on public.formulas(owner_id, template_signature)
  where template_signature is not null;
