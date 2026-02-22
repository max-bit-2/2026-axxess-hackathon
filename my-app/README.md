# Medivance MVP

Next.js + Supabase MVP for pharmaceutical compounding workflow:

- Google OAuth sign-in only
- Compounding queue dashboard
- Formula resolution cascade:
  1. Patient-specific formula
  2. Company formula
  3. Generated formula
- Deterministic calculation engine (no LLM arithmetic)
- Hard safety checks + AI supplementary review
- AI review is hard-gated and only runs after deterministic hard checks pass
- External deterministic hard checks via openFDA labels:
  - Drug-drug interaction term matching against concurrent patient meds
  - Numeric dose-range extraction (mg/dose, mg/day, mg/kg/day)
  - Allergy cross-sensitivity matching using label contraindications/warnings
- 3-iteration verifier loop with pharmacist escalation
- Pharmacist approve/reject actions
- Part 11-style electronic signature attestation on approval
- Final label payload + immutable audit trail records
- Idempotent inventory consumption on approval
- Demo signing flow (signature meaning + attestation)

## Stack

- Next.js (App Router, TypeScript)
- Supabase Auth + Postgres + RLS
- Tailwind CSS v4 + custom liquid glass styling

## Local Setup

1. Install deps:

```bash
pnpm install
```

2. Fill environment variables:

```bash
cp .env.example .env.local
```

3. Update `.env.local` values.
   - `MEDIVANCE_QUEUE_TIMEZONE` controls what counts as "today" in the queue.
   - `MEDIVANCE_LOW_STOCK_WARNING_MULTIPLIER` controls low-stock warning sensitivity.

4. In Supabase Dashboard:
- `Auth` -> `Providers` -> enable `Google`
- Set redirect URL(s):
  - `http://localhost:3000/auth/callback`
  - `https://YOUR_PROD_DOMAIN/auth/callback`

5. Run:

```bash
pnpm dev
```

## Supabase Schema

Migrations are in `supabase/migrations`:

- `202602220001_medivance_mvp_schema.sql`
- `202602220002_queue_trigger.sql`
- `202602220003_feedback_table.sql`
- `202602220004_schema_hardening_indexes.sql`
- `202602220005_compliance_locking_and_inventory.sql`
- `202602220006_part11_signature_pin_and_intents.sql`
- `202602220007_remove_signing_intent_challenge.sql`
- `202602220008_remove_signature_pin_for_demo.sql`

Applied tables include:

- `profiles`
- `patients`
- `prescriptions`
- `formulas`
- `inventory_lots`
- `compounding_jobs`
- `calculation_reports`
- `pharmacist_feedback`
- `final_outputs`
- `audit_events`
- `inventory_consumptions`

All core tables use RLS scoped to `auth.uid()`.
Immutable tables (`calculation_reports`, `final_outputs`, `audit_events`) are insert/select only.

## Signing Flow

1. Approval requires:
   - Signature meaning
   - Attestation checkbox

## Key Routes

- `/` landing
- `/signin` Google sign-in
- `/dashboard` compounding queue
- `/dashboard/jobs/[jobId]` job details + actions

POST action routes:

- `/api/jobs/[jobId]/run`
- `/api/jobs/[jobId]/approve`
- `/api/jobs/[jobId]/reject`
