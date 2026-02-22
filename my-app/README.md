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
- 3-iteration verifier loop with pharmacist escalation
- Pharmacist approve/reject actions
- Final label payload + immutable audit trail records

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

All core tables use RLS scoped to `auth.uid()`.

## Key Routes

- `/` landing
- `/signin` Google sign-in
- `/dashboard` compounding queue
- `/dashboard/jobs/[jobId]` job details + actions

POST action routes:

- `/api/jobs/[jobId]/run`
- `/api/jobs/[jobId]/approve`
- `/api/jobs/[jobId]/reject`
