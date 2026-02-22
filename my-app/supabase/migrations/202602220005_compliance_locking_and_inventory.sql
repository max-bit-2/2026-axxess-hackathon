do $$
begin
  create type public.signature_meaning as enum (
    'reviewed_and_approved',
    'compounded_by',
    'verified_by'
  );
exception
  when duplicate_object then null;
end;
$$;

alter table public.formulas
  add column if not exists equipment text[] not null default '{}',
  add column if not exists quality_control text[] not null default '{}',
  add column if not exists container_closure text,
  add column if not exists labeling_requirements text,
  add column if not exists bud_rationale text,
  add column if not exists reference_sources jsonb not null default '[]'::jsonb;

alter table public.final_outputs
  add column if not exists signer_name text,
  add column if not exists signer_email text,
  add column if not exists signature_meaning public.signature_meaning,
  add column if not exists signature_statement text,
  add column if not exists signature_hash text,
  add column if not exists locked_at timestamptz not null default timezone('utc', now());

update public.final_outputs
set
  signer_name = coalesce(signer_name, 'Unknown Signer'),
  signer_email = coalesce(signer_email, 'unknown@example.local'),
  signature_meaning = coalesce(signature_meaning, 'reviewed_and_approved'::public.signature_meaning),
  signature_statement = coalesce(signature_statement, 'Approved by pharmacist.'),
  signature_hash = coalesce(signature_hash, encode(digest(job_id::text || approved_at::text, 'sha256'), 'hex'));

alter table public.final_outputs
  alter column signer_name set not null,
  alter column signer_email set not null,
  alter column signature_meaning set not null,
  alter column signature_statement set not null,
  alter column signature_hash set not null;

create table if not exists public.inventory_consumptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null unique references public.compounding_jobs(id) on delete cascade,
  consumed_payload jsonb not null default '[]'::jsonb,
  consumed_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_inventory_consumptions_owner_job
  on public.inventory_consumptions(owner_id, job_id);

alter table public.inventory_consumptions enable row level security;

drop policy if exists "inventory_consumptions_owner_all" on public.inventory_consumptions;
drop policy if exists "inventory_consumptions_owner_select" on public.inventory_consumptions;
drop policy if exists "inventory_consumptions_owner_insert" on public.inventory_consumptions;

create policy "inventory_consumptions_owner_select"
on public.inventory_consumptions
for select
using (auth.uid() = owner_id);

create policy "inventory_consumptions_owner_insert"
on public.inventory_consumptions
for insert
with check (auth.uid() = owner_id);

create or replace function public.consume_inventory_for_job(
  p_owner_id uuid,
  p_job_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_existing jsonb;
  v_report jsonb;
  v_ingredient jsonb;
  v_name text;
  v_required numeric;
  v_remaining numeric;
  v_unit text;
  v_lot record;
  v_available numeric;
  v_take numeric;
  v_take_in_lot_unit numeric;
  v_summary jsonb := '[]'::jsonb;
begin
  select consumed_payload
  into v_existing
  from public.inventory_consumptions
  where owner_id = p_owner_id
    and job_id = p_job_id
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'status', 'already_consumed',
      'items', v_existing
    );
  end if;

  select cr.report
  into v_report
  from public.calculation_reports cr
  where cr.owner_id = p_owner_id
    and cr.job_id = p_job_id
  order by cr.version desc
  limit 1;

  if v_report is null then
    raise exception 'No calculation report found for job %.', p_job_id;
  end if;

  if jsonb_typeof(v_report -> 'ingredients') <> 'array' then
    raise exception 'Calculation report ingredients are missing for job %.', p_job_id;
  end if;

  for v_ingredient in
    select value
    from jsonb_array_elements(v_report -> 'ingredients')
  loop
    v_name := lower(trim(coalesce(v_ingredient ->> 'name', '')));
    v_required := coalesce((v_ingredient ->> 'requiredAmount')::numeric, 0);
    v_unit := coalesce(v_ingredient ->> 'unit', '');

    if v_name = '' or v_required <= 0 then
      continue;
    end if;

    if v_unit = 'g' then
      v_remaining := v_required * 1000;
    elsif v_unit = 'mg' then
      v_remaining := v_required;
    elsif v_unit = 'mL' then
      v_remaining := v_required;
    else
      raise exception 'Unsupported unit "%" for ingredient "%".', v_unit, v_name;
    end if;

    for v_lot in
      select id, lot_number, available_quantity, unit, expires_on
      from public.inventory_lots
      where owner_id = p_owner_id
        and lower(trim(ingredient_name)) = v_name
      order by expires_on asc, created_at asc
      for update
    loop
      if v_remaining <= 0 then
        exit;
      end if;

      if v_unit in ('g', 'mg') then
        if v_lot.unit = 'g' then
          v_available := v_lot.available_quantity * 1000;
        elsif v_lot.unit = 'mg' then
          v_available := v_lot.available_quantity;
        else
          continue;
        end if;

        v_take := least(v_available, v_remaining);
        if v_take <= 0 then
          continue;
        end if;

        if v_lot.unit = 'g' then
          v_take_in_lot_unit := v_take / 1000;
        else
          v_take_in_lot_unit := v_take;
        end if;
      elsif v_unit = 'mL' then
        if v_lot.unit <> 'mL' then
          continue;
        end if;

        v_available := v_lot.available_quantity;
        v_take := least(v_available, v_remaining);
        if v_take <= 0 then
          continue;
        end if;
        v_take_in_lot_unit := v_take;
      end if;

      update public.inventory_lots
      set
        available_quantity = greatest(0, available_quantity - v_take_in_lot_unit),
        updated_at = timezone('utc', now())
      where id = v_lot.id;

      v_remaining := v_remaining - v_take;

      v_summary := v_summary || jsonb_build_array(
        jsonb_build_object(
          'ingredientName', v_name,
          'lotNumber', v_lot.lot_number,
          'deducted', round(v_take_in_lot_unit, 4),
          'unit', v_lot.unit,
          'expiresOn', v_lot.expires_on
        )
      );
    end loop;

    if v_remaining > 0.0001 then
      raise exception
        'Insufficient inventory while consuming ingredient "%". Remaining: % %.',
        v_name, v_remaining, v_unit;
    end if;
  end loop;

  insert into public.inventory_consumptions (owner_id, job_id, consumed_payload)
  values (p_owner_id, p_job_id, v_summary)
  on conflict (job_id) do nothing;

  return jsonb_build_object(
    'status', 'consumed',
    'items', v_summary
  );
end;
$$;

create or replace function public.prevent_mutation_on_immutable_table()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Table "%" is immutable and does not allow updates or deletes.', tg_table_name;
end;
$$;

drop trigger if exists audit_events_immutable_guard on public.audit_events;
create trigger audit_events_immutable_guard
before update or delete on public.audit_events
for each row execute function public.prevent_mutation_on_immutable_table();

drop trigger if exists final_outputs_immutable_guard on public.final_outputs;
create trigger final_outputs_immutable_guard
before update or delete on public.final_outputs
for each row execute function public.prevent_mutation_on_immutable_table();

drop trigger if exists calculation_reports_immutable_guard on public.calculation_reports;
create trigger calculation_reports_immutable_guard
before update or delete on public.calculation_reports
for each row execute function public.prevent_mutation_on_immutable_table();

create or replace function public.prevent_approved_job_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'approved' and (
    new.status is distinct from old.status
    or new.formula_id is distinct from old.formula_id
    or new.iteration_count is distinct from old.iteration_count
    or coalesce(new.last_error, '') is distinct from coalesce(old.last_error, '')
    or coalesce(new.pharmacist_feedback, '') is distinct from coalesce(old.pharmacist_feedback, '')
    or new.completed_at is distinct from old.completed_at
  ) then
    raise exception 'Approved job % is immutable.', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists approved_job_mutation_guard on public.compounding_jobs;
create trigger approved_job_mutation_guard
before update on public.compounding_jobs
for each row execute function public.prevent_approved_job_mutation();

drop policy if exists "reports_owner_all" on public.calculation_reports;
drop policy if exists "final_outputs_owner_all" on public.final_outputs;
drop policy if exists "audit_owner_all" on public.audit_events;

create policy "reports_owner_select"
on public.calculation_reports
for select
using (auth.uid() = owner_id);

create policy "reports_owner_insert"
on public.calculation_reports
for insert
with check (auth.uid() = owner_id);

create policy "final_outputs_owner_select"
on public.final_outputs
for select
using (auth.uid() = owner_id);

create policy "final_outputs_owner_insert"
on public.final_outputs
for insert
with check (auth.uid() = owner_id);

create policy "audit_owner_select"
on public.audit_events
for select
using (auth.uid() = owner_id);

create policy "audit_owner_insert"
on public.audit_events
for insert
with check (auth.uid() = owner_id);
