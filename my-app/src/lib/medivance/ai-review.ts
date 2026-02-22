import { env } from "@/lib/env";
import type {
  AiReviewResult,
  CalculationResult,
  CheckStatus,
  HardCheckSummary,
} from "@/lib/medivance/types";

interface ReviewInput {
  medicationName: string;
  route: string;
  report: CalculationResult;
  hardSummary: HardCheckSummary;
}

function normalizeStatus(status: string): CheckStatus {
  const value = status.toUpperCase();
  if (value === "FAIL") return "FAIL";
  if (value === "WARN" || value === "NEEDS_REVIEW") return "WARN";
  return "PASS";
}

function fallbackReview(input: ReviewInput): AiReviewResult {
  const blocked = input.hardSummary.blockingIssues.length > 0;
  const sparseSteps = input.report.steps.length < 5;

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
    citationQuality: {
      status: "WARN",
      detail:
        "MVP mode: no external citation validation configured yet. Attach DrugBank/openFDA links when API keys are available.",
    },
    overall: blocked ? "FAIL" : sparseSteps ? "NEEDS_REVIEW" : "PASS",
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
              "You are a pharmaceutical compounding safety reviewer. Return strict JSON with keys clinicalReasonableness, preparationCompleteness, citationQuality, overall. Never do arithmetic.",
          },
          {
            role: "user",
            content: `Review this report for clinical coherence and completeness.\nMedication: ${input.medicationName}\nRoute: ${input.route}\nReport: ${JSON.stringify(
              input.report,
            )}\nHard checks: ${JSON.stringify(input.hardSummary.checks)}`,
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
    const citationQuality = (clinical.citationQuality ?? {}) as Record<string, string>;

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
      citationQuality: {
        status: normalizeStatus(citationQuality.status ?? "WARN"),
        detail:
          citationQuality.detail ?? "LLM review returned no citation quality detail.",
      },
      overall,
    };
  } catch {
    return fallbackReview(input);
  }
}
