alter table public.compounding_jobs
add constraint compounding_jobs_prescription_unique unique (prescription_id);

create or replace function public.enqueue_compounding_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compounding_jobs (owner_id, prescription_id, status, priority)
  values (new.owner_id, new.id, 'queued', 2)
  on conflict (prescription_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_prescription_created on public.prescriptions;
create trigger on_prescription_created
after insert on public.prescriptions
for each row execute function public.enqueue_compounding_job();
