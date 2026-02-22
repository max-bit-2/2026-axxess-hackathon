import { env } from "@/lib/env";
import type {
  AiReviewResult,
  CalculationResult,
  CheckStatus,
  HardCheckSummary,
  MedicationReferenceSnapshot,
} from "@/lib/medivance/types";

interface ReviewInput {
  medicationName: string;
  route: string;
  report: CalculationResult;
  hardSummary: HardCheckSummary;
  referenceSnapshot: MedicationReferenceSnapshot;
}

function normalizeStatus(status: string): CheckStatus {
  const value = status.toUpperCase();
  if (value === "FAIL") return "FAIL";
  if (value === "WARN" || value === "NEEDS_REVIEW") return "WARN";
  return "PASS";
}

function buildCitationQuality(snapshot: MedicationReferenceSnapshot) {
  const hasRxNorm = snapshot.rxNormStatus === "ok" && Boolean(snapshot.rxNormId);
  const hasOpenFda = snapshot.openFdaStatus === "ok" && snapshot.openFdaInteractionLabelCount > 0;
  const hasOpenFdaNdc = snapshot.openFdaNdcStatus === "ok" && snapshot.openFdaNdcCount > 0;
  const hasDailyMed = snapshot.dailyMedStatus === "ok" && Boolean(snapshot.dailyMedSetId);
  const status: CheckStatus =
    hasRxNorm && hasOpenFda && hasOpenFdaNdc && hasDailyMed ? "PASS" : "WARN";

  const summary = [
    hasRxNorm
      ? `RxNav normalized to ${snapshot.rxNormName ?? snapshot.medicationName} (RxCUI ${snapshot.rxNormId}).`
      : "RxNav did not return an RxCUI match.",
    hasOpenFda
      ? `openFDA returned ${snapshot.openFdaInteractionLabelCount} label(s) with drug interaction sections.`
      : snapshot.openFdaStatus === "error"
        ? "openFDA interaction lookup failed."
        : "openFDA returned no matching interaction label records.",
    hasOpenFdaNdc
      ? `openFDA NDC directory returned ${snapshot.openFdaNdcCount} result(s).`
      : snapshot.openFdaNdcStatus === "error"
        ? "openFDA NDC directory lookup failed."
        : "openFDA NDC directory returned no matching records.",
    hasDailyMed
      ? `DailyMed resolved SPL ${snapshot.dailyMedSetId}.`
      : snapshot.dailyMedStatus === "error"
        ? "DailyMed lookup failed."
        : "DailyMed returned no SPL match.",
  ];

  if (snapshot.warnings.length) {
    summary.push(`Notes: ${snapshot.warnings.join(" ")}`);
  }

  return {
    status,
    detail: summary.join(" "),
  };
}

function fallbackReview(input: ReviewInput): AiReviewResult {
  const blocked = input.hardSummary.blockingIssues.length > 0;
  const sparseSteps = input.report.steps.length < 5;
  const citationQuality = buildCitationQuality(input.referenceSnapshot);

  return {
    clinicalReasonableness: {
      status: blocked ? "FAIL" : "PASS",
      detail: blocked
        ? "Hard safety checks failed, clinical reasonableness cannot pass."
        : "Dose, concentration, and route appear clinically coherent for MVP validation.",
    },
    preparationCompleteness: {
      status: sparseSteps ? "WARN" : "PASS",
      detail: sparseSteps
        ? "Preparation steps are minimal. Add order-of-addition and QC checkpoints."
        : "Preparation instructions include core compounding sequence and QC step.",
    },
    citationQuality,
    overall: blocked ? "FAIL" : sparseSteps ? "NEEDS_REVIEW" : "PASS",
    citations: input.referenceSnapshot.citations,
    externalWarnings: input.referenceSnapshot.warnings,
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function runAiReview(input: ReviewInput): Promise<AiReviewResult> {
  if (!env.openAiApiKey) {
    return fallbackReview(input);
  }

  const citationQuality = buildCitationQuality(input.referenceSnapshot);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.openAiModel,
        input: [
          {
            role: "system",
            content:
              "You are a pharmaceutical compounding safety reviewer. Return strict JSON with keys clinicalReasonableness, preparationCompleteness, overall. Never do arithmetic.",
          },
          {
            role: "user",
            content: `Review this report for clinical coherence and completeness.\nMedication: ${input.medicationName}\nRoute: ${input.route}\nReport: ${JSON.stringify(
              input.report,
            )}\nHard checks: ${JSON.stringify(
              input.hardSummary.checks,
            )}\nExternal references summary: ${JSON.stringify({
              rxNormStatus: input.referenceSnapshot.rxNormStatus,
              rxNormId: input.referenceSnapshot.rxNormId,
              rxNormName: input.referenceSnapshot.rxNormName,
              openFdaStatus: input.referenceSnapshot.openFdaStatus,
              openFdaInteractionLabelCount:
                input.referenceSnapshot.openFdaInteractionLabelCount,
              openFdaNdcStatus: input.referenceSnapshot.openFdaNdcStatus,
              openFdaNdcCount: input.referenceSnapshot.openFdaNdcCount,
              openFdaNdcProductNdc: input.referenceSnapshot.openFdaNdcProductNdc,
              dailyMedStatus: input.referenceSnapshot.dailyMedStatus,
              dailyMedSetId: input.referenceSnapshot.dailyMedSetId,
              citations: input.referenceSnapshot.citations,
              warnings: input.referenceSnapshot.warnings,
            })}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      return fallbackReview(input);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    const text =
      payload.output_text ??
      payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("\n") ??
      "";

    const parsed = extractJsonObject(text);
    if (!parsed || typeof parsed !== "object") {
      return fallbackReview(input);
    }

    const clinical = parsed as Record<string, unknown>;
    const clinicalReasonableness = (clinical.clinicalReasonableness ??
      {}) as Record<string, string>;
    const preparationCompleteness = (clinical.preparationCompleteness ??
      {}) as Record<string, string>;

    const overallRaw = String(clinical.overall ?? "NEEDS_REVIEW").toUpperCase();
    const overall: AiReviewResult["overall"] =
      overallRaw === "PASS" ? "PASS" : overallRaw === "FAIL" ? "FAIL" : "NEEDS_REVIEW";

    return {
      clinicalReasonableness: {
        status: normalizeStatus(clinicalReasonableness.status ?? "WARN"),
        detail:
          clinicalReasonableness.detail ??
          "LLM review returned no detail for clinical reasonableness.",
      },
      preparationCompleteness: {
        status: normalizeStatus(preparationCompleteness.status ?? "WARN"),
        detail:
          preparationCompleteness.detail ??
          "LLM review returned no detail for preparation completeness.",
      },
      citationQuality,
      overall,
      citations: input.referenceSnapshot.citations,
      externalWarnings: input.referenceSnapshot.warnings,
    };
  } catch {
    return fallbackReview(input);
  }
}
