# Feature/Requirement Audit (2026-02-22)

Source of truth audited: "Pharmaceutical Compounding AI System — Architectural Deep-Dive & Recommendations" (Feb 21, 2026).

Status legend:
- `Implemented`
- `Partial`
- `Missing`

## Workflow + Architecture Coverage

| Requirement | Status | Evidence in code | Gap / Risk | Priority |
|---|---|---|---|---|
| Queue shows today's jobs by patient/prescription | Implemented | `src/lib/medivance/db.ts` (`getQueueItems`), `/dashboard` UI | None | P1 |
| Formula resolution hierarchy (patient -> company -> generate) | Implemented | `src/lib/medivance/db.ts` (`resolveFormulaForPrescription`) | Generated path is templated fallback, not literature-driven | P1 |
| External drug registry lookup (NDC, labeling) | Implemented | `src/lib/medivance/references.ts` + openFDA calls | No FDA 503B facility integration yet | P1 |
| Deterministic calculation engine (no LLM arithmetic) | Implemented | `src/lib/medivance/calculations.ts` | Advanced compounding math set not complete | P1 |
| Correction loop with cap + escalation | Implemented | `src/lib/medivance/pipeline.ts` (`MAX_ITERATIONS=3`) | None | P0 |
| Hard rules run before AI review | Implemented | `src/lib/medivance/pipeline.ts` (AI skip when hard-blocked) | None | P0 |
| AI verifier supplementary role | Implemented | `src/lib/medivance/ai-review.ts` | Prompt/checklist depth can be expanded | P1 |
| Pharmacist reject/feedback loop | Implemented | `/api/jobs/[jobId]/reject`, pipeline re-run support | None | P1 |
| Approval finalization (final report + label + audit) | Implemented | `approveCompoundingJob` + `saveFinalOutput` + `writeAuditEvent` | Depends on migration-backed strict guards | P0 |

## Safety Engine Coverage

| Requirement | Status | Evidence in code | Gap / Risk | Priority |
|---|---|---|---|---|
| Deterministic dose range check | Implemented | `src/lib/medivance/safety.ts` + external label constraints in `external-safety.ts` | External constraints are extracted heuristically from labels | P0 |
| Deterministic DDI check | Implemented | `src/lib/medivance/external-safety.ts` (`evaluateDrugInteractionCheck`) | Label-text matching is less deep than dedicated commercial DDI engines | P0 |
| Deterministic allergy cross-sensitivity | Implemented | `src/lib/medivance/external-safety.ts` (`evaluateAllergyCrossSensitivityCheck`) | Rule map should expand over time | P0 |
| Unit consistency | Implemented | `src/lib/medivance/safety.ts` | Not a full dimensional-analysis unit system yet | P1 |
| BUD validation | Implemented | `src/lib/medivance/calculations.ts` + `src/lib/medivance/safety.ts` | USP table depth not yet comprehensive | P1 |
| Lot expiry validation | Implemented | `src/lib/medivance/safety.ts` | None | P0 |
| Incompatibility check | Implemented | `src/lib/medivance/safety.ts` (formula safety profile pairs) | No external compatibility dataset wired yet | P1 |
| Inventory availability pre-check + low-stock warning | Implemented | `src/lib/medivance/safety.ts` + `db.ts` inventory fetch | Configurable reorder thresholds are not modeled yet | P1 |
| Fail-closed external check mode | Implemented | `src/lib/env.ts`, `pipeline.ts`, `external-safety.ts` | Must validate in production with real API failure drills | P0 |

## Records, Compliance, and Data Model Coverage

| Requirement | Status | Evidence in code | Gap / Risk | Priority |
|---|---|---|---|---|
| MFR/CR separation | Implemented | `approveCompoundingJob` final report includes both `masterFormulationRecord` and `compoundingRecord` | None | P1 |
| MFR-required metadata fields | Implemented | `formulas` fields + migration `202602220005...` | Validation depth for every USP-required field can be tightened | P1 |
| Immutable audit/report/final tables | Implemented (migration-defined) | `202602220005_compliance_locking_and_inventory.sql` triggers | Not enforced until migration applied | P0 |
| Part 11 strict signing flow (PIN + challenge + meaning + attestation) | Implemented (app + migration-defined RPCs) | `src/lib/medivance/signing.ts`, `db.ts`, routes, migration `202602220006...` | Not enforceable until migration applied | P0 |
| Inventory consumption deduction on approval | Implemented | RPC `consume_inventory_for_job` + `inventory_consumptions` | Depends on migration apply | P1 |
| RBAC and tenant isolation | Implemented baseline | Supabase RLS policies | Fine-grained role model beyond owner/pharmacist not yet present | P1 |
| HIPAA program controls (BAA workflow, PHI minimization policy, full access logging program) | Partial | RLS + app audit events present | Formal HIPAA/SOC control program remains open | P1 |

## Explicit Missing/Deferred Items

- FDA 503B facility list integration.
- Dedicated commercial clinical safety datasets (if replacing label-heuristic path).
- Configurable reorder thresholds + replenishment workflow.
- Full USP <795>/<797> deterministic rule-table depth for all categories.
- Formal compliance program implementation (HIPAA/SOC controls, policy workflows, evidence automation, vendor BAAs tracking).
- Pen test / disaster recovery / validation docs from roadmap phase 4.
