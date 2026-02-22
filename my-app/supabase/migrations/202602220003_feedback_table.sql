create table public.pharmacist_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references public.compounding_jobs(id) on delete cascade,
  decision text not null check (decision in ('request_changes', 'reject', 'approve', 'note')),
  feedback text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_feedback_owner_job on public.pharmacist_feedback(owner_id, job_id, created_at desc);

alter table public.pharmacist_feedback enable row level security;

create policy "feedback_owner_all"
on public.pharmacist_feedback
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);
