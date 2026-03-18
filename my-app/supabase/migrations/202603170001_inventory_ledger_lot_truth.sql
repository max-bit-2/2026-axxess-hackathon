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
  v_required_in_working_unit numeric;
  v_unit text;
  v_lot record;
  v_available numeric;
  v_take numeric;
  v_take_in_lot_unit numeric;
  v_summary jsonb := '[]'::jsonb;
  v_remaining numeric;
  v_reference_date date := current_date;
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

    if v_unit = 'mL' then
      select coalesce(sum(available_quantity), 0)
      into v_available
      from public.inventory_lots l
      where l.owner_id = p_owner_id
        and lower(trim(l.ingredient_name)) = v_name
        and l.unit = 'mL'
        and (l.expires_on is null or l.expires_on::date >= v_reference_date);

      if not exists(
        select 1
        from public.inventory_ledger il
        where il.owner_id = p_owner_id
          and lower(trim(il.ingredient_name)) = v_name
      ) then
        insert into public.inventory_ledger (owner_id, ingredient_name, available_quantity, unit, low_stock_threshold)
        values (p_owner_id, v_name, 0, 'mL', 0)
        on conflict (owner_id, ingredient_name) do nothing;
      end if;

      v_required_in_working_unit := v_required;
      if v_available < v_required_in_working_unit then
        raise exception
          'Insufficient inventory for ingredient "%". Available: % mL, required: % mL.',
          v_name, v_available, v_required_in_working_unit;
      end if;

      v_remaining := v_required_in_working_unit;
      for v_lot in
        select id, lot_number, available_quantity, unit, expires_on
        from public.inventory_lots
        where owner_id = p_owner_id
          and lower(trim(ingredient_name)) = v_name
          and unit = 'mL'
          and (expires_on is null or expires_on::date >= v_reference_date)
        order by coalesce(expires_on::date, '9999-12-31'::date) asc, created_at asc
        for update
      loop
        if v_remaining <= 0 then
          exit;
        end if;

        if v_lot.unit <> 'mL' then
          continue;
        end if;

        v_available := v_lot.available_quantity;
        v_take := least(v_available, v_remaining);
        if v_take <= 0 then
          continue;
        end if;

        v_take_in_lot_unit := v_take;

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
          'Insufficient inventory while consuming ingredient "%". Remaining: % mL.',
          v_name,
          v_remaining;
      end if;

      continue;
    end if;

    select coalesce(
      sum(
        case
          when l.unit = 'g' then l.available_quantity * 1000
          when l.unit = 'mg' then l.available_quantity
          else 0
        end
      ), 0
    )
    into v_available
    from public.inventory_lots l
    where l.owner_id = p_owner_id
      and lower(trim(l.ingredient_name)) = v_name
      and l.unit in ('g', 'mg')
      and (l.expires_on is null or l.expires_on::date >= v_reference_date);

    if not exists(
      select 1
      from public.inventory_ledger il
      where il.owner_id = p_owner_id
        and lower(trim(il.ingredient_name)) = v_name
    ) then
      insert into public.inventory_ledger (owner_id, ingredient_name, available_quantity, unit, low_stock_threshold)
      values (p_owner_id, v_name, 0, coalesce(v_unit, 'mg'), 0)
      on conflict (owner_id, ingredient_name) do nothing;
    end if;

    v_required_in_working_unit := case when v_unit = 'g' then v_required * 1000 else v_required end;
    if v_available < v_required_in_working_unit then
      raise exception
        'Insufficient inventory for ingredient "%". Available: % mg, required: % mg.',
        v_name, v_available, v_required_in_working_unit;
    end if;

    v_remaining := v_required_in_working_unit;
    for v_lot in
      select id, lot_number, available_quantity, unit, expires_on
      from public.inventory_lots
      where owner_id = p_owner_id
        and lower(trim(ingredient_name)) = v_name
        and unit in ('g', 'mg')
        and (expires_on is null or expires_on::date >= v_reference_date)
      order by coalesce(expires_on::date, '9999-12-31'::date) asc, created_at asc
      for update
    loop
      if v_remaining <= 0 then
        exit;
      end if;

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
        v_name, v_remaining, 'mg';
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

update public.inventory_ledger
set available_quantity = 0;
