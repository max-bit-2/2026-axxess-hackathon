import type { JobContext, ResolvedFormula } from "@/lib/medivance/db";
import type { CheckResult } from "@/lib/medivance/types";

interface PreflightCheckMap {
  [key: string]: CheckResult;
}

export interface PreflightSummary {
  checks: PreflightCheckMap;
  blockingIssues: string[];
  warnings: string[];
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function buildSummary(
  checks: PreflightCheckMap,
  blockingIssues: string[],
  warnings: string[],
): PreflightSummary {
  return { checks, blockingIssues, warnings };
}

export function runIntakePreflight(context: JobContext): PreflightSummary {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  const hasPatientIdentity = hasText(context.patient.id) && hasText(context.patient.fullName);
  if (!hasPatientIdentity) {
    blockingIssues.push("Patient identity fields are incomplete.");
  }

  const hasPatientWeight = Number.isFinite(context.patient.weightKg) && context.patient.weightKg > 0;
  if (!hasPatientWeight) {
    blockingIssues.push("Patient weight is missing or invalid.");
  }

  const hasPrescriptionCore =
    hasText(context.prescription.medicationName) &&
    hasText(context.prescription.route) &&
    Number.isFinite(context.prescription.doseMgPerKg) &&
    context.prescription.doseMgPerKg > 0 &&
    Number.isFinite(context.prescription.frequencyPerDay) &&
    context.prescription.frequencyPerDay > 0 &&
    Number.isFinite(context.prescription.strengthMgPerMl) &&
    context.prescription.strengthMgPerMl > 0 &&
    Number.isFinite(context.prescription.dispenseVolumeMl) &&
    context.prescription.dispenseVolumeMl > 0;

  if (!hasPrescriptionCore) {
    blockingIssues.push("Prescription fields required for deterministic calculations are incomplete.");
  }

  const allergyListPresent = Array.isArray(context.patient.allergies);
  if (!allergyListPresent) {
    blockingIssues.push("Patient allergy documentation is missing.");
  }

  if (allergyListPresent && context.patient.allergies.length === 0) {
    warnings.push("No allergies listed. Confirm this is intentionally documented as NKDA.");
  }

  return buildSummary(
    {
      patientIdentity: {
        status: hasPatientIdentity ? "PASS" : "FAIL",
        detail: hasPatientIdentity
          ? "Patient identity fields are present."
          : "Patient identity fields are incomplete.",
      },
      patientWeight: {
        status: hasPatientWeight ? "PASS" : "FAIL",
        detail: hasPatientWeight
          ? `Patient weight captured (${context.patient.weightKg} kg).`
          : "Patient weight is missing or invalid.",
      },
      prescriptionCompleteness: {
        status: hasPrescriptionCore ? "PASS" : "FAIL",
        detail: hasPrescriptionCore
          ? "Prescription fields required for calculations are present."
          : "Prescription fields required for deterministic calculations are incomplete.",
      },
      allergyDocumentation: {
        status: allergyListPresent ? "PASS" : "FAIL",
        detail: allergyListPresent
          ? "Allergy documentation is present."
          : "Patient allergy documentation is missing.",
      },
    },
    blockingIssues,
    warnings,
  );
}

export function runPreCompoundingPreflight(params: {
  context: JobContext;
  formula: ResolvedFormula;
  pharmacistFeedback?: string;
}): PreflightSummary {
  const { context, formula, pharmacistFeedback } = params;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  const hasApiIngredient = formula.ingredients.some((ingredient) => ingredient.role === "api");
  const hasVehicleIngredient = formula.ingredients.some(
    (ingredient) => ingredient.role === "vehicle",
  );
  const hasInstructions = hasText(formula.instructions) && formula.instructions.trim().length >= 20;

  const safety = formula.safetyProfile;
  const hasDoseBounds =
    Number.isFinite(safety.minSingleDoseMg) &&
    Number.isFinite(safety.maxSingleDoseMg) &&
    Number.isFinite(safety.maxDailyDoseMg) &&
    Number(safety.minSingleDoseMg) >= 0 &&
    Number(safety.maxSingleDoseMg) > 0 &&
    Number(safety.maxDailyDoseMg) > 0 &&
    Number(safety.minSingleDoseMg) <= Number(safety.maxSingleDoseMg) &&
    Number(safety.maxDailyDoseMg) >= Number(safety.maxSingleDoseMg);

  if (!hasApiIngredient || !hasVehicleIngredient) {
    blockingIssues.push("Formula recipe is incomplete (API and vehicle are both required).");
  }

  if (!hasInstructions) {
    blockingIssues.push("Formula compounding instructions are missing or too brief.");
  }

  if (!hasDoseBounds) {
    blockingIssues.push("Formula safety limits are incomplete or inconsistent.");
  }

  const ingredientNames = formula.ingredients.map((ingredient) => normalize(ingredient.name));
  const allergyMatches = context.patient.allergies.filter((allergy) => {
    const token = normalize(allergy);
    return ingredientNames.some((name) => name.includes(token));
  });
  if (allergyMatches.length > 0) {
    blockingIssues.push(
      `Formula recipe conflicts with documented allergies: ${allergyMatches.join(", ")}.`,
    );
  }

  const isGeneratedFormula = formula.source === "generated";
  if (isGeneratedFormula) {
    warnings.push(
      "Generated formula detected. Pharmacist rationale is recommended before compounding.",
    );
  }

  if (isGeneratedFormula && !hasText(pharmacistFeedback)) {
    blockingIssues.push(
      "Generated formulas require pharmacist rationale before deterministic run.",
    );
  }

  return buildSummary(
    {
      recipeStructure: {
        status: hasApiIngredient && hasVehicleIngredient ? "PASS" : "FAIL",
        detail:
          hasApiIngredient && hasVehicleIngredient
            ? "Formula contains API and vehicle components."
            : "Formula recipe is incomplete (API and vehicle are both required).",
      },
      instructionsCompleteness: {
        status: hasInstructions ? "PASS" : "FAIL",
        detail: hasInstructions
          ? "Compounding instructions are sufficiently detailed."
          : "Formula compounding instructions are missing or too brief.",
      },
      safetyLimitCompleteness: {
        status: hasDoseBounds ? "PASS" : "FAIL",
        detail: hasDoseBounds
          ? "Formula safety limits are present and internally consistent."
          : "Formula safety limits are incomplete or inconsistent.",
      },
      recipeAllergyScreen: {
        status: allergyMatches.length > 0 ? "FAIL" : "PASS",
        detail:
          allergyMatches.length > 0
            ? `Recipe conflicts with allergies: ${allergyMatches.join(", ")}.`
            : "No direct recipe-allergy conflict found.",
      },
      recipeProvenance: {
        status: isGeneratedFormula && !hasText(pharmacistFeedback) ? "FAIL" : "PASS",
        detail:
          isGeneratedFormula && !hasText(pharmacistFeedback)
            ? "Generated formula requires pharmacist rationale before run."
            : isGeneratedFormula
              ? "Generated formula acknowledged with pharmacist rationale."
              : "Vetted formula source selected.",
      },
    },
    blockingIssues,
    warnings,
  );
}
