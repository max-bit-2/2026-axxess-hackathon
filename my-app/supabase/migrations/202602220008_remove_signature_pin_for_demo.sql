drop function if exists public.verify_signature_pin(text);
drop function if exists public.set_signature_pin(text);

alter table if exists public.profiles
  drop column if exists signature_pin_hash,
  drop column if exists signature_pin_set_at,
  drop column if exists signature_failed_attempts,
  drop column if exists signature_locked_until;
