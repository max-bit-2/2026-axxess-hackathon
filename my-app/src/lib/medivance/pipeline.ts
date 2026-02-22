import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyDeterministicCorrections,
  calculateCompoundingReport,
} from "@/lib/medivance/calculations";
import { runAiReview } from "@/lib/medivance/ai-review";
import {
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
import { runHardChecks } from "@/lib/medivance/safety";
import type { JobStatus } from "@/lib/medivance/types";

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

export async function runCompoundingPipeline(
  supabase: SupabaseClient,
  params: {
    userId: string;
    jobId: string;
    pharmacistFeedback?: string;
  },
) {
  const context = await getJobContext(supabase, params.userId, params.jobId);
  const formula = await resolveFormulaForPrescription(supabase, params.userId, context);

  await updateJobState(supabase, {
    jobId: params.jobId,
    status: "in_progress",
    formulaId: formula.id,
    lastError: null,
    pharmacistFeedback: params.pharmacistFeedback ?? context.job.pharmacistFeedback,
  });

  await writeAuditEvent(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    eventType: "pipeline.started",
    eventPayload: {
      startedAt: nowIso(),
      formulaId: formula.id,
      formulaSource: formula.source,
      pharmacistFeedback: params.pharmacistFeedback ?? null,
    },
  });

  if (params.pharmacistFeedback) {
    await insertPharmacistFeedback(supabase, {
      ownerId: params.userId,
      jobId: params.jobId,
      decision: "request_changes",
      feedback: params.pharmacistFeedback,
    });
  }

  const ingredientNames = formula.ingredients.map((ingredient) => ingredient.name);
  const inventoryLots = await getInventoryForIngredients(
    supabase,
    params.userId,
    ingredientNames,
  );
  const latestVersion = await getLatestReportVersion(supabase, params.jobId);
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
  let finalWarnings: string[] = [];
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ITERATIONS; attempt += 1) {
    attempts = attempt;

    const calculatedReport = calculateCompoundingReport({
      prescription: workingPrescription,
      patientWeightKg: context.patient.weightKg,
      budRule: formula.budRule,
      ingredients: formula.ingredients,
      pharmacistFeedback: params.pharmacistFeedback,
    });

    const hardSummary = runHardChecks({
      result: calculatedReport,
      allergies: context.patient.allergies,
      formulaSafety: formula.safetyProfile,
      ingredients: ingredientNames,
      inventoryLots,
    });

    const aiReview = await runAiReview({
      medicationName: context.prescription.medicationName,
      route: context.prescription.route,
      report: calculatedReport,
      hardSummary,
    });

    const blockingIssues = [...hardSummary.blockingIssues];
    if (aiReview.overall === "FAIL") {
      blockingIssues.push(
        `AI review failed: ${aiReview.clinicalReasonableness.detail}`,
      );
    }

    const warnings = [...hardSummary.warnings];
    if (aiReview.overall === "NEEDS_REVIEW") {
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
    note?: string;
  },
) {
  const context = await getJobContext(supabase, params.userId, params.jobId);
  if (context.job.status !== "verified") {
    throw new Error("Only verified jobs can be approved.");
  }

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

  const report = toRecord(latestReportData.report);
  const budDate = String(report.budDateIso ?? "");
  const concentration = Number(report.finalConcentrationMgPerMl ?? 0);
  const volume = Number(report.finalVolumeMl ?? 0);

  const labelPayload = {
    patient: context.patient.fullName,
    medication: context.prescription.medicationName,
    route: context.prescription.route,
    concentrationMgPerMl: concentration,
    quantityMl: volume,
    beyondUseDate: budDate,
    storage: "Refrigerate. Shake well.",
    approvedAt: nowIso(),
  };

  const finalReport = {
    approvedBy: params.approverId,
    approvedAt: nowIso(),
    context,
    report,
    pharmacistNote: params.note ?? null,
  };

  await saveFinalOutput(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    approvedBy: params.approverId,
    finalReport,
    labelPayload,
  });

  await supabase
    .from("calculation_reports")
    .update({ is_final: true })
    .eq("id", latestReportData.id);

  await updateJobState(supabase, {
    jobId: params.jobId,
    status: "approved",
    completed: true,
    lastError: null,
  });

  await insertPharmacistFeedback(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    decision: "approve",
    feedback: params.note?.trim() ? params.note : "Approved by pharmacist.",
  });

  await writeAuditEvent(supabase, {
    ownerId: params.userId,
    jobId: params.jobId,
    eventType: "job.approved",
    eventPayload: {
      approvedBy: params.approverId,
      note: params.note ?? null,
      timestamp: nowIso(),
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
