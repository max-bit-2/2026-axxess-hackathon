alter table public.profiles
  add column if not exists signature_pin_hash text,
  add column if not exists signature_pin_set_at timestamptz,
  add column if not exists signature_failed_attempts integer not null default 0,
  add column if not exists signature_locked_until timestamptz;

create table if not exists public.signing_intents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references public.compounding_jobs(id) on delete cascade,
  signature_meaning public.signature_meaning not null,
  challenge_hash text not null,
  issued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  verified_at timestamptz,
  used_at timestamptz
);

create index if not exists idx_signing_intents_owner_job
  on public.signing_intents(owner_id, job_id, issued_at desc);

alter table public.signing_intents enable row level security;

drop policy if exists "signing_intents_owner_select" on public.signing_intents;
drop policy if exists "signing_intents_owner_insert" on public.signing_intents;
drop policy if exists "signing_intents_owner_update" on public.signing_intents;

create policy "signing_intents_owner_select"
on public.signing_intents
for select
using (auth.uid() = owner_id);

create policy "signing_intents_owner_insert"
on public.signing_intents
for insert
with check (auth.uid() = owner_id);

create policy "signing_intents_owner_update"
on public.signing_intents
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create or replace function public.set_signature_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trimmed_pin text := trim(coalesce(p_pin, ''));
  v_now timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Unauthorized.';
  end if;

  if char_length(v_trimmed_pin) < 8 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'pin_too_short'
    );
  end if;

  update public.profiles
  set
    signature_pin_hash = crypt(v_trimmed_pin, gen_salt('bf', 10)),
    signature_pin_set_at = v_now,
    signature_failed_attempts = 0,
    signature_locked_until = null
  where id = v_uid;

  if not found then
    insert into public.profiles (
      id,
      full_name,
      signature_pin_hash,
      signature_pin_set_at,
      signature_failed_attempts,
      signature_locked_until
    )
    values (
      v_uid,
      null,
      crypt(v_trimmed_pin, gen_salt('bf', 10)),
      v_now,
      0,
      null
    )
    on conflict (id) do update set
      signature_pin_hash = excluded.signature_pin_hash,
      signature_pin_set_at = excluded.signature_pin_set_at,
      signature_failed_attempts = 0,
      signature_locked_until = null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'setAt', v_now
  );
end;
$$;

create or replace function public.verify_signature_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_failed_attempts integer;
  v_locked_until timestamptz;
  v_now timestamptz := timezone('utc', now());
  v_trimmed_pin text := trim(coalesce(p_pin, ''));
  v_next_failed integer;
begin
  if v_uid is null then
    raise exception 'Unauthorized.';
  end if;

  select
    signature_pin_hash,
    signature_failed_attempts,
    signature_locked_until
  into
    v_hash,
    v_failed_attempts,
    v_locked_until
  from public.profiles
  where id = v_uid
  for update;

  if v_hash is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'pin_not_set'
    );
  end if;

  if v_locked_until is not null and v_locked_until > v_now then
    return jsonb_build_object(
      'ok', false,
      'reason', 'locked',
      'lockedUntil', v_locked_until
    );
  end if;

  if crypt(v_trimmed_pin, v_hash) = v_hash then
    update public.profiles
    set
      signature_failed_attempts = 0,
      signature_locked_until = null
    where id = v_uid;

    return jsonb_build_object(
      'ok', true
    );
  end if;

  v_next_failed := coalesce(v_failed_attempts, 0) + 1;

  if v_next_failed >= 5 then
    update public.profiles
    set
      signature_failed_attempts = v_next_failed,
      signature_locked_until = v_now + interval '15 minutes'
    where id = v_uid;

    return jsonb_build_object(
      'ok', false,
      'reason', 'locked',
      'lockedUntil', (v_now + interval '15 minutes')
    );
  end if;

  update public.profiles
  set signature_failed_attempts = v_next_failed
  where id = v_uid;

  return jsonb_build_object(
    'ok', false,
    'reason', 'invalid_pin',
    'attemptsRemaining', 5 - v_next_failed
  );
end;
$$;

create or replace function public.issue_signing_intent(
  p_job_id uuid,
  p_signature_meaning public.signature_meaning
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job_status public.job_status;
  v_code text;
  v_intent_id uuid;
  v_now timestamptz := timezone('utc', now());
  v_expires_at timestamptz := timezone('utc', now()) + interval '10 minutes';
begin
  if v_uid is null then
    raise exception 'Unauthorized.';
  end if;

  select status
  into v_job_status
  from public.compounding_jobs
  where id = p_job_id
    and owner_id = v_uid
  limit 1;

  if v_job_status is null then
    raise exception 'Job not found for current user.';
  end if;

  if v_job_status <> 'verified' then
    raise exception 'Job must be verified before issuing signature intent.';
  end if;

  update public.signing_intents
  set used_at = v_now
  where owner_id = v_uid
    and job_id = p_job_id
    and used_at is null;

  v_code := lpad(((random() * 999999)::int)::text, 6, '0');

  insert into public.signing_intents (
    owner_id,
    job_id,
    signature_meaning,
    challenge_hash,
    issued_at,
    expires_at
  )
  values (
    v_uid,
    p_job_id,
    p_signature_meaning,
    crypt(v_code, gen_salt('bf', 8)),
    v_now,
    v_expires_at
  )
  returning id into v_intent_id;

  return jsonb_build_object(
    'ok', true,
    'intentId', v_intent_id,
    'challengeCode', v_code,
    'signatureMeaning', p_signature_meaning::text,
    'issuedAt', v_now,
    'expiresAt', v_expires_at
  );
end;
$$;

create or replace function public.consume_signing_intent(
  p_intent_id uuid,
  p_job_id uuid,
  p_challenge_code text,
  p_pin text,
  p_signature_meaning public.signature_meaning
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_intent record;
  v_pin_check jsonb;
  v_now timestamptz := timezone('utc', now());
  v_job_status public.job_status;
begin
  if v_uid is null then
    raise exception 'Unauthorized.';
  end if;

  select status
  into v_job_status
  from public.compounding_jobs
  where id = p_job_id
    and owner_id = v_uid
  limit 1;

  if v_job_status is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'job_not_found'
    );
  end if;

  if v_job_status <> 'verified' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'job_not_verified'
    );
  end if;

  v_pin_check := public.verify_signature_pin(p_pin);
  if coalesce((v_pin_check ->> 'ok')::boolean, false) = false then
    return jsonb_build_object(
      'ok', false,
      'reason', 'pin_failed',
      'pinResult', v_pin_check
    );
  end if;

  select *
  into v_intent
  from public.signing_intents
  where id = p_intent_id
    and owner_id = v_uid
    and job_id = p_job_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'intent_not_found'
    );
  end if;

  if v_intent.used_at is not null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'intent_already_used'
    );
  end if;

  if v_intent.expires_at < v_now then
    return jsonb_build_object(
      'ok', false,
      'reason', 'intent_expired'
    );
  end if;

  if v_intent.signature_meaning <> p_signature_meaning then
    return jsonb_build_object(
      'ok', false,
      'reason', 'meaning_mismatch'
    );
  end if;

  if crypt(trim(coalesce(p_challenge_code, '')), v_intent.challenge_hash) <> v_intent.challenge_hash then
    return jsonb_build_object(
      'ok', false,
      'reason', 'challenge_mismatch'
    );
  end if;

  update public.signing_intents
  set
    verified_at = v_now,
    used_at = v_now
  where id = p_intent_id;

  return jsonb_build_object(
    'ok', true,
    'intentId', p_intent_id,
    'usedAt', v_now
  );
end;
$$;
