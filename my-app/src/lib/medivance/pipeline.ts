import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

import { env } from "@/lib/env";
import {
  applyDeterministicCorrections,
  calculateCompoundingReport,
} from "@/lib/medivance/calculations";
import {
  runIntakePreflight,
  runPreCompoundingPreflight,
  type PreflightSummary,
} from "@/lib/medivance/preflight";
import { runAiReview } from "@/lib/medivance/ai-review";
import { fetchExternalClinicalSafetySnapshot } from "@/lib/medivance/external-safety";
import {
  consumeInventoryForJob,
  getInventoryForIngredients,
  getJobContext,
  getLatestReportVersion,
  insertCalculationReport,
  insertPharmacistFeedback,
  resolveFormulaForPrescription,
  saveFinalOutput,
  updateJobState,
  writeAuditEvent,
} from "@/lib/medivance/db";
import { fetchMedicationReferenceSnapshot } from "@/lib/medivance/references";
import { normalizeSignatureMeaning } from "@/lib/medivance/signing";
import { runHardChecks } from "@/lib/medivance/safety";
import type {
  AiReviewResult,
  JobStatus,
  MedicationReferenceSnapshot,
  SignatureMeaning,
} from "@/lib/medivance/types";

const MAX_ITERATIONS = 3;

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function nowIso() {
  return new Date().toISOString();
}

async function handlePreflightFailure(
  supabase: SupabaseClient,
  params: {
    userId: string;
    jobId: string;
    stage: "intake" | "pre_compounding";
    summary: PreflightSummary;
  },
) {
  await updateJobState(supabase, {
    jobId: params.jobId,
    status: "needs_review",
    iterationCount: 0,
    lastError: params.summary.blockingIssues[0] ?? "Preflight validation failed.",
  });

  await writeAuditEvent(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    eventType: "pipeline.preflight_failed",
    eventPayload: {
      stage: params.stage,
      blockingIssues: params.summary.blockingIssues,
      warnings: params.summary.warnings,
      checks: params.summary.checks,
      timestamp: nowIso(),
    },
  });

  return {
    status: "needs_review" as const,
    attempts: 0,
    blockingIssues: params.summary.blockingIssues,
    warnings: params.summary.warnings,
  };
}

function buildExternalBlockingIssues(params: {
  medicationName: string;
  snapshot: MedicationReferenceSnapshot;
}) {
  const { medicationName, snapshot } = params;
  const issues: string[] = [];

  if (!env.failClosedExternalChecks) {
    return issues;
  }

  if (snapshot.rxNormStatus === "error") {
    issues.push(`RxNorm lookup failed for ${medicationName}.`);
  } else if (snapshot.rxNormStatus === "missing") {
    issues.push(`RxNorm lookup returned no medication match for ${medicationName}.`);
  }
  if (snapshot.openFdaStatus === "error") {
    issues.push(`openFDA interaction lookup failed for ${medicationName}.`);
  } else if (snapshot.openFdaStatus === "missing") {
    issues.push(`openFDA interaction lookup returned no interaction labels for ${medicationName}.`);
  }
  if (snapshot.openFdaNdcStatus === "error") {
    issues.push(`openFDA NDC lookup failed for ${medicationName}.`);
  } else if (snapshot.openFdaNdcStatus === "missing") {
    issues.push(`openFDA NDC lookup returned no NDC match for ${medicationName}.`);
  }
  if (snapshot.dailyMedStatus === "error") {
    issues.push(`DailyMed lookup failed for ${medicationName}.`);
  } else if (snapshot.dailyMedStatus === "missing") {
    issues.push(`DailyMed lookup returned no SPL match for ${medicationName}.`);
  }

  return issues;
}

function makeSignatureHash(input: {
  jobId: string;
  approverId: string;
  signerName: string;
  signerEmail: string;
  signatureMeaning: SignatureMeaning;
  signedAt: string;
}) {
  const payload = [
    input.jobId,
    input.approverId,
    input.signerName,
    input.signerEmail,
    input.signatureMeaning,
    input.signedAt,
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

export async function runCompoundingPipeline(
  supabase: SupabaseClient,
  params: {
    userId: string;
    jobId: string;
    pharmacistFeedback?: string | null;
  },
) {
  const context = await getJobContext(supabase, params.userId, params.jobId);
  const hasSubmittedFeedback = params.pharmacistFeedback !== undefined;
  const persistedPharmacistFeedback = hasSubmittedFeedback
    ? params.pharmacistFeedback ?? null
    : context.job.pharmacistFeedback;
  const effectivePharmacistFeedback =
    typeof persistedPharmacistFeedback === "string" ? persistedPharmacistFeedback : undefined;

  if (context.job.status === "approved") {
    throw new Error("Approved jobs are immutable and cannot be reprocessed.");
  }
  if (context.job.status === "in_progress") {
    throw new Error("Job is already in progress.");
  }

  const intakeSummary = runIntakePreflight(context);
  if (intakeSummary.blockingIssues.length > 0) {
    return handlePreflightFailure(supabase, {
      userId: params.userId,
      jobId: params.jobId,
      stage: "intake",
      summary: intakeSummary,
    });
  }
  const formula = await resolveFormulaForPrescription(supabase, params.userId, context);
  const preCompoundingSummary = runPreCompoundingPreflight({
    context,
    formula,
    pharmacistFeedback: effectivePharmacistFeedback,
  });
  if (preCompoundingSummary.blockingIssues.length > 0) {
    return handlePreflightFailure(supabase, {
      userId: params.userId,
      jobId: params.jobId,
      stage: "pre_compounding",
      summary: preCompoundingSummary,
    });
  }

  await updateJobState(supabase, {
    jobId: params.jobId,
    status: "in_progress",
    formulaId: formula.id,
    lastError: null,
    pharmacistFeedback: persistedPharmacistFeedback,
  });

  await writeAuditEvent(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    eventType: "pipeline.started",
    eventPayload: {
      startedAt: nowIso(),
      formulaId: formula.id,
      formulaSource: formula.source,
      pharmacistFeedback: effectivePharmacistFeedback ?? null,
    },
  });

  if (
    effectivePharmacistFeedback &&
    effectivePharmacistFeedback !== context.job.pharmacistFeedback
  ) {
    await insertPharmacistFeedback(supabase, {
      ownerId: params.userId,
      jobId: params.jobId,
      decision: "request_changes",
      feedback: effectivePharmacistFeedback,
    });
  }

  const ingredientNames = formula.ingredients.map((ingredient) => ingredient.name);
  const inventoryLots = await getInventoryForIngredients(
    supabase,
    params.userId,
    ingredientNames,
  );
  const latestVersion = await getLatestReportVersion(supabase, params.jobId);
  const referenceSnapshot = await fetchMedicationReferenceSnapshot(
    context.prescription.medicationName,
  );
  const externalSafetySnapshot = await fetchExternalClinicalSafetySnapshot(
    context.prescription.medicationName,
  );
  const externalBlockingIssues = buildExternalBlockingIssues({
    medicationName: context.prescription.medicationName,
    snapshot: referenceSnapshot,
  });
  let workingPrescription = {
    medicationName: context.prescription.medicationName,
    route: context.prescription.route,
    doseMgPerKg: context.prescription.doseMgPerKg,
    frequencyPerDay: context.prescription.frequencyPerDay,
    strengthMgPerMl: context.prescription.strengthMgPerMl,
    dispenseVolumeMl: context.prescription.dispenseVolumeMl,
  };

  let finalStatus: JobStatus = "needs_review";
  let finalIssues: string[] = [];
  let finalWarnings: string[] = [...intakeSummary.warnings, ...preCompoundingSummary.warnings];
  let attempts = 0;
  const maxIterations = externalBlockingIssues.length > 0 ? 1 : MAX_ITERATIONS;

  for (let attempt = 1; attempt <= maxIterations; attempt += 1) {
    attempts = attempt;

    const calculatedReport = calculateCompoundingReport({
      prescription: workingPrescription,
      patientWeightKg: context.patient.weightKg,
      budRule: formula.budRule,
      ingredients: formula.ingredients,
      pharmacistFeedback: effectivePharmacistFeedback,
    });

    const hardSummary = runHardChecks({
      medicationName: context.prescription.medicationName,
      result: calculatedReport,
      allergies: context.patient.allergies,
      formulaSafety: formula.safetyProfile,
      ingredients: ingredientNames,
      inventoryLots,
      patientWeightKg: context.patient.weightKg,
      currentMedications: context.patient.currentMedications,
      externalSafetySnapshot,
      failClosedExternalChecks: env.failClosedExternalChecks,
    });

    const canRunAiReview =
      hardSummary.blockingIssues.length === 0 && externalBlockingIssues.length === 0;
    const aiReview: AiReviewResult = canRunAiReview
      ? await runAiReview({
          medicationName: context.prescription.medicationName,
          route: context.prescription.route,
          report: calculatedReport,
          hardSummary,
          referenceSnapshot,
        })
      : {
          clinicalReasonableness: {
            status: "WARN",
            detail:
              "AI review skipped because deterministic hard checks returned blocking issues.",
          },
          preparationCompleteness: {
            status: "WARN",
            detail:
              "AI review skipped because deterministic hard checks returned blocking issues.",
          },
          citationQuality: {
            status: "WARN",
            detail:
              "AI review skipped because deterministic hard checks returned blocking issues.",
          },
          overall: "FAIL",
          citations: referenceSnapshot.citations,
          externalWarnings: referenceSnapshot.warnings,
        };

    const blockingIssues = [...hardSummary.blockingIssues, ...externalBlockingIssues];
    if (canRunAiReview && aiReview.overall === "FAIL") {
      blockingIssues.push(
        `AI review failed: ${aiReview.clinicalReasonableness.detail}`,
      );
    }

    const warnings = [
      ...hardSummary.warnings,
      ...intakeSummary.warnings,
      ...preCompoundingSummary.warnings,
    ];
    if (canRunAiReview && aiReview.overall === "NEEDS_REVIEW") {
      warnings.push(
        `AI review requires attention: ${aiReview.preparationCompleteness.detail}`,
      );
    }

    const overallStatus =
      blockingIssues.length > 0 ? "fail" : aiReview.overall === "NEEDS_REVIEW" ? "needs_review" : "pass";

    await insertCalculationReport(supabase, {
      ownerId: params.userId,
      jobId: params.jobId,
      version: latestVersion + attempt,
      context: {
        jobId: params.jobId,
        attempt,
        formulaId: formula.id,
        formulaSource: formula.source,
        medicationName: context.prescription.medicationName,
        patientId: context.patient.id,
      },
      report: calculatedReport as unknown as Record<string, unknown>,
      hardChecks: hardSummary as unknown as Record<string, unknown>,
      aiReview: aiReview as unknown as Record<string, unknown>,
      overallStatus,
      isFinal: overallStatus === "pass",
    });

    await writeAuditEvent(supabase, {
      ownerId: params.userId,
      jobId: params.jobId,
      eventType: "pipeline.iteration_completed",
      eventPayload: {
        attempt,
        overallStatus,
        blockingIssueCount: blockingIssues.length,
        warningCount: warnings.length,
      },
    });

    finalIssues = blockingIssues;
    finalWarnings = warnings;

    if (overallStatus === "pass") {
      finalStatus = "verified";
      break;
    }

    workingPrescription = applyDeterministicCorrections(
      workingPrescription,
      blockingIssues.length > 0 ? blockingIssues : warnings,
    );
  }

  if (finalStatus !== "verified") {
    finalStatus = "needs_review";
  }

  await updateJobState(supabase, {
    jobId: params.jobId,
    status: finalStatus,
    iterationCount: attempts,
    formulaId: formula.id,
    lastError: finalIssues[0] ?? (finalWarnings[0] ?? null),
  });

  await writeAuditEvent(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    eventType:
      finalStatus === "verified" ? "pipeline.verified" : "pipeline.escalated_to_pharmacist",
    eventPayload: {
      completedAt: nowIso(),
      attempts,
      blockingIssues: finalIssues,
      warnings: finalWarnings,
    },
  });

  return {
    status: finalStatus,
    attempts,
    blockingIssues: finalIssues,
    warnings: finalWarnings,
  };
}

export async function approveCompoundingJob(
  supabase: SupabaseClient,
  params: {
    userId: string;
    jobId: string;
    approverId: string;
    note: string;
    signerName: string;
    signerEmail: string;
    signatureMeaning: string;
    signatureAttestation: boolean;
  },
) {
  const note = params.note.trim();

  const context = await getJobContext(supabase, params.userId, params.jobId);
  if (context.job.status !== "verified") {
    throw new Error("Only verified jobs can be approved.");
  }
  if (!params.signatureAttestation) {
    throw new Error("Electronic signature attestation is required.");
  }

  const signerName = params.signerName.trim();
  const signerEmail = params.signerEmail.trim().toLowerCase();
  if (signerName.length < 2) {
    throw new Error("Signer name is required for electronic signature.");
  }
  if (!signerEmail.includes("@")) {
    throw new Error("Signer email is required for electronic signature.");
  }
  const signatureMeaning = normalizeSignatureMeaning(params.signatureMeaning);

  const { data: latestReportData, error: reportError } = await supabase
    .from("calculation_reports")
    .select("id, report")
    .eq("owner_id", params.userId)
    .eq("job_id", params.jobId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (reportError || !latestReportData) {
    throw reportError ?? new Error("No report found for approval.");
  }

  const { data: formulaData, error: formulaError } = context.job.formulaId
    ? await supabase
        .from("formulas")
        .select(
          "id, name, source, instructions, ingredient_profile, safety_profile, equipment, quality_control, container_closure, labeling_requirements, bud_rationale, reference_sources",
        )
        .eq("owner_id", params.userId)
        .eq("id", context.job.formulaId)
        .maybeSingle()
    : { data: null, error: null };

  if (formulaError) {
    throw formulaError;
  }

  const report = toRecord(latestReportData.report);
  const budDate = String(report.budDateIso ?? "");
  const concentration = Number(report.finalConcentrationMgPerMl ?? 0);
  const volume = Number(report.finalVolumeMl ?? 0);
  const signedAt = nowIso();
  const signatureStatement = `${signerName} (${signerEmail}) electronically signed this record as ${signatureMeaning.replaceAll("_", " ")} on ${signedAt}.`;
  const signatureHash = makeSignatureHash({
    jobId: params.jobId,
    approverId: params.approverId,
    signerName,
    signerEmail,
    signatureMeaning,
    signedAt,
  });

  const inventoryConsumption = await consumeInventoryForJob(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
  });
  const consumptionItems = Array.isArray(inventoryConsumption.items)
    ? inventoryConsumption.items
    : [];

  const labelPayload = {
    patient: context.patient.fullName,
    medication: context.prescription.medicationName,
    route: context.prescription.route,
    concentrationMgPerMl: concentration,
    quantityMl: volume,
    beyondUseDate: budDate,
    storage: "Refrigerate. Shake well.",
    approvedAt: signedAt,
    signatureMeaning,
    signatureHash,
    lotConsumption: consumptionItems,
  };

  const finalReport = {
    approvedBy: params.approverId,
    approvedAt: signedAt,
    signature: {
      signerName,
      signerEmail,
      signatureMeaning,
      signatureStatement,
      signatureHash,
    },
    context,
    masterFormulationRecord: formulaData
      ? {
          id: formulaData.id,
          name: formulaData.name,
          source: formulaData.source,
          instructions: formulaData.instructions,
          ingredientProfile: formulaData.ingredient_profile,
          safetyProfile: formulaData.safety_profile,
          equipment: formulaData.equipment ?? [],
          qualityControl: formulaData.quality_control ?? [],
          containerClosure: formulaData.container_closure ?? null,
          labelingRequirements: formulaData.labeling_requirements ?? null,
          budRationale: formulaData.bud_rationale ?? null,
          references: formulaData.reference_sources ?? [],
        }
      : null,
    compoundingRecord: {
      jobId: params.jobId,
      reportVersionId: latestReportData.id,
      report,
      inventoryConsumption,
    },
    report,
    pharmacistNote: note || null,
  };

  await saveFinalOutput(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    approvedBy: params.approverId,
    signerName,
    signerEmail,
    signatureMeaning,
    signatureStatement,
    signatureHash,
    finalReport,
    labelPayload,
  });

  await updateJobState(supabase, {
    jobId: params.jobId,
    status: "approved",
    completed: true,
    lastError: null,
  });

  if (note) {
    await insertPharmacistFeedback(supabase, {
      ownerId: params.userId,
      jobId: params.jobId,
      decision: "approve",
      feedback: note,
    });
  }

  await writeAuditEvent(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    eventType: "job.approved",
    eventPayload: {
      approvedBy: params.approverId,
      signerName,
      signerEmail,
      signatureMeaning,
      signatureHash,
      note: note || null,
      timestamp: signedAt,
      inventoryConsumptionCount: consumptionItems.length,
    },
  });
}

export async function rejectCompoundingJob(
  supabase: SupabaseClient,
  params: {
    userId: string;
    jobId: string;
    feedback: string;
  },
) {
  const context = await getJobContext(supabase, params.userId, params.jobId);
  if (context.job.status === "approved") {
    throw new Error("Approved jobs are immutable and cannot be rejected.");
  }

  const feedback = params.feedback.trim();
  if (!feedback) {
    throw new Error("Rejection feedback is required.");
  }

  await updateJobState(supabase, {
    jobId: params.jobId,
    status: "rejected",
    lastError: feedback,
    pharmacistFeedback: feedback,
  });

  await insertPharmacistFeedback(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    decision: "reject",
    feedback,
  });

  await writeAuditEvent(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    eventType: "job.rejected",
    eventPayload: {
      feedback,
      timestamp: nowIso(),
    },
  });
}
