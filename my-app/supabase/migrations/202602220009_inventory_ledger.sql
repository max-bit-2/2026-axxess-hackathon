create table if not exists public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ingredient_name text not null,
  available_quantity numeric(14,4) not null check (available_quantity >= 0),
  unit text not null,
  low_stock_threshold numeric(14,4) not null default 0,
  last_restocked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_inventory_ledger_owner_ingredient
  on public.inventory_ledger(owner_id, ingredient_name);
create index if not exists idx_inventory_ledger_owner_low_stock
  on public.inventory_ledger(owner_id, low_stock_threshold, available_quantity);

alter table public.inventory_ledger enable row level security;

create policy "inventory_ledger_owner_all"
on public.inventory_ledger
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create trigger set_inventory_ledger_updated_at
before update on public.inventory_ledger
for each row execute function public.set_updated_at();

insert into public.inventory_ledger (
  owner_id,
  ingredient_name,
  available_quantity,
  unit,
  low_stock_threshold,
  updated_at,
  last_restocked_at
)
select
  l.owner_id,
  l.ingredient_name,
  sum(
    case
      when l.unit = 'mL' then l.available_quantity
      else l.available_quantity * case when l.unit = 'g' then 1000 else 1 end
    end
  ) as available_quantity,
  case
    when bool_or(l.unit = 'mL') then 'mL'
    else 'mg'
  end as unit,
  0 as low_stock_threshold,
  max(l.updated_at) as updated_at,
  max(l.updated_at) as last_restocked_at
from public.inventory_lots l
where not exists (
  select 1
  from public.inventory_ledger cl
  where cl.owner_id = l.owner_id
    and cl.ingredient_name = l.ingredient_name
)
group by l.owner_id, l.ingredient_name
on conflict (owner_id, ingredient_name) do nothing;

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
  v_required_in_ledger numeric;
  v_unit text;
  v_lot record;
  v_available numeric;
  v_take numeric;
  v_take_in_lot_unit numeric;
  v_summary jsonb := '[]'::jsonb;
  v_remaining numeric;
  v_ledger record;
  v_ledger_unit text;
  v_ledger_available numeric;
  v_required_in_working_unit numeric;
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

    if not (v_unit = 'g' or v_unit = 'mg' or v_unit = 'mL') then
      raise exception 'Unsupported unit "%" for ingredient "%".', v_unit, v_name;
    end if;

    select id, available_quantity, unit
    into v_ledger
    from public.inventory_ledger
    where owner_id = p_owner_id
      and lower(trim(ingredient_name)) = v_name
    for update;

    if not found then
      if v_unit = 'mL' then
        select
          coalesce(sum(l.available_quantity), 0),
          'mL'
        into v_ledger_available, v_ledger_unit
        from public.inventory_lots l
        where l.owner_id = p_owner_id
          and lower(trim(l.ingredient_name)) = v_name
          and l.unit = 'mL';
      else
        select
          coalesce(sum(
            case
              when l.unit = 'g' then l.available_quantity * 1000
              when l.unit = 'mg' then l.available_quantity
              else 0
            end
          ), 0),
          'mg'
        into v_ledger_available, v_ledger_unit
        from public.inventory_lots l
        where l.owner_id = p_owner_id
          and lower(trim(l.ingredient_name)) = v_name
          and l.unit in ('g', 'mg');
      end if;

      insert into public.inventory_ledger (owner_id, ingredient_name, available_quantity, unit, low_stock_threshold)
      values (p_owner_id, v_name, v_ledger_available, v_ledger_unit, 0)
      on conflict (owner_id, ingredient_name) do nothing;
    else
      v_ledger_available := v_ledger.available_quantity;
      v_ledger_unit := v_ledger.unit;
    end if;

    if v_unit = 'mL' then
      if v_ledger_unit <> 'mL' then
        raise exception 'Inventory ledger unit mismatch for ingredient "%": expected mL, found %.', v_name, v_ledger_unit;
      end if;
      v_required_in_ledger := v_required;
      v_required_in_working_unit := v_required;
    elsif v_ledger_unit = 'g' then
      v_required_in_ledger := case when v_unit = 'g' then v_required else v_required / 1000 end;
      v_required_in_working_unit := case when v_unit = 'g' then v_required * 1000 else v_required end;
    else
      v_required_in_ledger := case when v_unit = 'g' then v_required * 1000 else v_required end;
      v_required_in_working_unit := case when v_unit = 'g' then v_required * 1000 else v_required end;
    end if;

    if v_ledger_available < v_required_in_ledger then
      raise exception 'Insufficient inventory for ingredient "%". Available: % %, required: % %.',
        v_name, v_ledger_available, v_ledger_unit, v_required_in_ledger, v_unit;
    end if;

    v_remaining := v_required_in_working_unit;

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
        if v_lot.unit not in ('g', 'mg') then
          continue;
        end if;

        if v_lot.unit = 'g' then
          v_available := v_lot.available_quantity * 1000;
        else
          v_available := v_lot.available_quantity;
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
      else
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

    if v_unit in ('g', 'mg') then
      if v_remaining > 0.0001 then
        raise exception 'Insufficient inventory while consuming ingredient "%". Remaining: % %.', v_name, v_remaining, v_unit;
      end if;
    else
      if v_remaining > 0.0001 then
        raise exception 'Insufficient inventory while consuming ingredient "%". Remaining: % mL.', v_name, v_remaining;
      end if;
    end if;

    update public.inventory_ledger
    set
      available_quantity = greatest(0, available_quantity - v_required_in_ledger),
      last_restocked_at = timezone('utc', now())
    where owner_id = p_owner_id
      and lower(trim(ingredient_name)) = v_name;
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
