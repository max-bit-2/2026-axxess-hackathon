# Medivance Close-the-Gap Checklist (P0/P1 Only)

Date: 2026-02-22
Scope: Pharmaceutical Compounding AI System requirements from the architecture deep-dive.

## P0 (Patient Safety / Legal Blocking)

- [x] External deterministic hard checks implemented:
  - Deterministic DDI term matching from external clinical label interaction sections.
  - Deterministic external dose-range checks from numeric constraints in label text.
  - Deterministic allergy cross-sensitivity matching against ingredient + contraindication/warning corpus.
  - Code: `src/lib/medivance/external-safety.ts`, `src/lib/medivance/safety.ts`, `src/lib/medivance/pipeline.ts`.
- [x] Hard-check-first gate enforced:
  - AI review now runs only if deterministic hard checks pass.
  - Code: `src/lib/medivance/pipeline.ts`.
- [x] Fail-closed external safety behavior tightened:
  - Missing/failed external reference lookups now block when `FAIL_CLOSED_EXTERNAL_CHECKS=true`.
  - Non-blocking warning mode is preserved when fail-closed is disabled.
  - Code: `src/lib/medivance/pipeline.ts`, `src/lib/medivance/external-safety.ts`.
- [x] Safety regression tests added:
  - Added extraction warning fail-closed/non-fail-closed coverage.
  - Code: `src/lib/medivance/external-safety.test.ts`.
- [x] Iteration cap + pharmacist escalation enforced:
  - Max 3 loop iterations; escalates to pharmacist when unresolved.
  - Code: `src/lib/medivance/pipeline.ts`.
- [x] Part 11 strict signing flow coded:
  - Signature PIN, one-time signing intent/challenge, signature meaning, attestation, immutable final records.
  - Code: `src/lib/medivance/signing.ts`, `src/lib/medivance/db.ts`, `src/lib/medivance/pipeline.ts`, API routes.
- [ ] Apply required Supabase migrations in target project (still pending by request):
  - `supabase/migrations/202602220005_compliance_locking_and_inventory.sql`
  - `supabase/migrations/202602220006_part11_signature_pin_and_intents.sql`
- [ ] Execute live end-to-end sign/approve test on real Supabase project after migration apply.

## P1 (High Value / Operational Risk Reduction)

- [x] Queue "today" filtering aligned to configurable operational timezone.
  - Uses `MEDIVANCE_QUEUE_TIMEZONE` for day-boundary filtering in queue retrieval.
  - Code: `src/lib/env.ts`, `src/lib/medivance/db.ts`.
- [x] MFR/CR distinction represented in output model:
  - Final output includes `masterFormulationRecord` and `compoundingRecord`.
  - Code: `src/lib/medivance/pipeline.ts`.
- [x] Inventory deduction integrated and idempotent per job:
  - Uses `consume_inventory_for_job` RPC + `inventory_consumptions` uniqueness.
  - Code: `src/lib/medivance/db.ts`, migration `202602220005...`.
- [x] Add low-stock warning alerting in inventory hard checks (near-shortage detection).
  - Warning sensitivity is now configurable globally and by formula safety profile ingredient map.
  - Code: `src/lib/env.ts`, `src/lib/medivance/types.ts`, `src/lib/medivance/db.ts`, `src/lib/medivance/safety.ts`.
- [ ] Add configurable reorder thresholds per ingredient/lot in schema and UI.
- [ ] Expand deterministic clinical reference depth (structured external interaction/dose datasets beyond label-text heuristics).
- [ ] Add structured safety reference tables (concentration limits by route, incompatibility matrix catalog, vehicle/base compatibility).

## Verification Status

- [x] `pnpm test` passing
- [x] `pnpm lint` passing
- [x] `pnpm build` passing
