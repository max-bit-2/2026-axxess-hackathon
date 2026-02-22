drop function if exists public.consume_signing_intent(
  uuid,
  uuid,
  text,
  text,
  public.signature_meaning
);

drop function if exists public.issue_signing_intent(
  uuid,
  public.signature_meaning
);

drop table if exists public.signing_intents;
