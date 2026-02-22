create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create index if not exists idx_audit_events_job_id on public.audit_events(job_id);
create index if not exists idx_calculation_reports_owner_id on public.calculation_reports(owner_id);
create index if not exists idx_compounding_jobs_formula_id on public.compounding_jobs(formula_id);
create index if not exists idx_final_outputs_approved_by on public.final_outputs(approved_by);
create index if not exists idx_final_outputs_owner_id on public.final_outputs(owner_id);
create index if not exists idx_formulas_patient_id on public.formulas(patient_id);
create index if not exists idx_feedback_job_id on public.pharmacist_feedback(job_id);
create index if not exists idx_prescriptions_patient_id on public.prescriptions(patient_id);
