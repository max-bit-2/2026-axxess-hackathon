import { env } from "../env";
import type {
  CalculationResult,
  CheckResult,
  DoseRangeConstraints,
  ExternalClinicalSafetySnapshot,
} from "@/lib/medivance/types";

const OPENFDA_BASE_URL = "https://api.fda.gov";
const MAX_TEXT_LENGTH = 24000;

interface OpenFdaClinicalLabelResponse {
  results?: Array<{
    set_id?: string;
    dosage_and_administration?: string[];
    pediatric_use?: string[];
    drug_interactions?: string[];
    contraindications?: string[];
    warnings_and_cautions?: string[];
  }>;
  error?: {
    message?: string;
  };
}

const ALLERGY_CROSS_SENSITIVITY_MAP: Record<string, string[]> = {
  sulfa: ["sulfonamide", "sulfamethoxazole", "sulfadiazine", "sulfacetamide", "sulfisoxazole"],
  penicillin: [
    "penicillin",
    "amoxicillin",
    "ampicillin",
    "dicloxacillin",
    "nafcillin",
    "cephalexin",
    "cefazolin",
    "ceftriaxone",
  ],
  cephalosporin: ["cephalexin", "cefazolin", "cefuroxime", "ceftriaxone"],
  aspirin: ["acetylsalicylic", "salicylate", "ibuprofen", "naproxen", "ketorolac"],
  nsaid: ["ibuprofen", "naproxen", "ketorolac", "diclofenac", "indomethacin"],
  peanut: ["peanut", "arachis"],
  soy: ["soy", "lecithin"],
  egg: ["egg", "ovalbumin"],
  lactose: ["lactose"],
};

const MEDICATION_STOPWORDS = new Set([
  "and",
  "with",
  "for",
  "tablet",
  "tablets",
  "capsule",
  "capsules",
  "oral",
  "solution",
  "suspension",
  "extended",
  "release",
  "delayed",
  "injectable",
  "powder",
  "mg",
  "ml",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeToken(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function truncateForStorage(value: string) {
  if (value.length <= MAX_TEXT_LENGTH) return value;
  return value.slice(0, MAX_TEXT_LENGTH);
}

function extractLabelValue(value: string[] | undefined) {
  if (!Array.isArray(value) || value.length === 0) return "";
  return truncateForStorage(normalizeWhitespace(value.join(" ")));
}

function formatOpenFdaMedicationTerm(value: string) {
  return value.replaceAll("\"", '\\"');
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function isPositiveNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function parseFloatSafe(value: string) {
  const parsed = Number.parseFloat(value.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function minimumOrNull(values: Array<number | null>) {
  const filtered = values.filter(isPositiveNumber);
  if (!filtered.length) return null;
  return Math.min(...filtered);
}

function maxOrNull(values: Array<number | null>) {
  const filtered = values.filter(isPositiveNumber);
  if (!filtered.length) return null;
  return Math.max(...filtered);
}

function addDoseMatches(text: string, pattern: RegExp, target: number[]) {
  let match = pattern.exec(text);
  while (match) {
    const single = parseFloatSafe(match[1] ?? "");
    const rangeUpper = parseFloatSafe(match[2] ?? "");
    const value = rangeUpper ?? single;
    if (value !== null) target.push(value);
    match = pattern.exec(text);
  }
}

export function extractDoseConstraintsFromLabelText(text: string): DoseRangeConstraints {
  const normalized = normalizeToken(text);
  const maxSingleDoseCandidates: number[] = [];
  const maxDailyDoseCandidates: number[] = [];
  const maxDailyPerKgCandidates: number[] = [];

  addDoseMatches(
    normalized,
    /(?:maximum|max|not to exceed|do not exceed|up to)\s+(\d+(?:\.\d+)?)\s*(?:mg)\s*\/\s*dose/g,
    maxSingleDoseCandidates,
  );
  addDoseMatches(
    normalized,
    /(?:single dose(?: of)?|per dose(?: of)?).{0,24}?(\d+(?:\.\d+)?)\s*mg/g,
    maxSingleDoseCandidates,
  );
  addDoseMatches(
    normalized,
    /(?:maximum|max|not to exceed|do not exceed|up to)\s+(\d+(?:\.\d+)?)\s*(?:mg)\s*\/\s*day/g,
    maxDailyDoseCandidates,
  );
  addDoseMatches(
    normalized,
    /(?:maximum|max|not to exceed|do not exceed|up to)\s+(\d+(?:\.\d+)?)\s*(?:mg)\s*\/\s*kg\s*\/\s*day/g,
    maxDailyPerKgCandidates,
  );
  addDoseMatches(
    normalized,
    /(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*mg\s*\/\s*kg\s*\/\s*day/g,
    maxDailyPerKgCandidates,
  );

  return {
    maxSingleDoseMg: minimumOrNull(maxSingleDoseCandidates),
    maxDailyDoseMg: minimumOrNull(maxDailyDoseCandidates),
    maxDailyDoseMgPerKg: maxOrNull(maxDailyPerKgCandidates),
  };
}

function makeCheck(status: CheckResult["status"], detail: string): CheckResult {
  return { status, detail };
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildMedicationAliases(name: string) {
  const normalized = normalizeToken(name);
  if (!normalized) return [];
  const aliasSet = new Set<string>([normalized]);
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !MEDICATION_STOPWORDS.has(token));
  for (const token of tokens) {
    aliasSet.add(token);
  }
  return Array.from(aliasSet);
}

function tokenAppears(haystack: string, token: string) {
  if (!token) return false;
  return haystack.includes(token);
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function buildCrossSensitivityTokens(allergy: string) {
  const normalized = normalizeToken(allergy);
  if (!normalized) return [];
  const tokens = [normalized, ...(ALLERGY_CROSS_SENSITIVITY_MAP[normalized] ?? [])];
  return dedupe(tokens.filter((token) => token.length >= 3));
}

export function buildMissingExternalClinicalSafetySnapshot(
  medicationName: string,
): ExternalClinicalSafetySnapshot {
  return {
    medicationName,
    status: "missing",
    sourceUrl: null,
    setId: null,
    doseText: "",
    pediatricText: "",
    interactionsText: "",
    contraindicationsText: "",
    warningsText: "",
    extractionWarnings: [],
  };
}

export async function fetchExternalClinicalSafetySnapshot(
  medicationName: string,
): Promise<ExternalClinicalSafetySnapshot> {
  const normalizedMedicationName = normalizeWhitespace(medicationName);
  if (!normalizedMedicationName) {
    return {
      ...buildMissingExternalClinicalSafetySnapshot(medicationName),
      extractionWarnings: [
        "Medication name is empty; external clinical safety lookup skipped.",
      ],
    };
  }

  const endpoint = new URL("/drug/label.json", OPENFDA_BASE_URL);
  endpoint.searchParams.set(
    "search",
    `openfda.generic_name:"${formatOpenFdaMedicationTerm(normalizedMedicationName)}"`,
  );
  endpoint.searchParams.set("limit", "1");
  if (env.openFdaApiKey) {
    endpoint.searchParams.set("api_key", env.openFdaApiKey);
  }

  const payload = await fetchJson<OpenFdaClinicalLabelResponse>(endpoint.toString());
  if (!payload) {
    return {
      medicationName: normalizedMedicationName,
      status: "error",
      sourceUrl: endpoint.toString(),
      setId: null,
      doseText: "",
      pediatricText: "",
      interactionsText: "",
      contraindicationsText: "",
      warningsText: "",
      extractionWarnings: ["openFDA clinical label lookup failed or timed out."],
    };
  }

  if (payload.error || !payload.results?.length) {
    return {
      medicationName: normalizedMedicationName,
      status: "missing",
      sourceUrl: endpoint.toString(),
      setId: null,
      doseText: "",
      pediatricText: "",
      interactionsText: "",
      contraindicationsText: "",
      warningsText: "",
      extractionWarnings: [
        payload.error?.message
          ? `openFDA clinical label lookup returned: ${payload.error.message}`
          : `openFDA returned no clinical label records for "${normalizedMedicationName}".`,
      ],
    };
  }

  const label = payload.results[0];
  return {
    medicationName: normalizedMedicationName,
    status: "ok",
    sourceUrl: endpoint.toString(),
    setId: label?.set_id ?? null,
    doseText: extractLabelValue(label?.dosage_and_administration),
    pediatricText: extractLabelValue(label?.pediatric_use),
    interactionsText: extractLabelValue(label?.drug_interactions),
    contraindicationsText: extractLabelValue(label?.contraindications),
    warningsText: extractLabelValue(label?.warnings_and_cautions),
    extractionWarnings: [],
  };
}

function evaluateDrugInteractionCheck(params: {
  snapshot: ExternalClinicalSafetySnapshot;
  currentMedications: string[];
  failClosedExternalChecks: boolean;
}) {
  const { snapshot, currentMedications, failClosedExternalChecks } = params;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!currentMedications.length) {
    return {
      check: makeCheck("PASS", "No concurrent medications on record for DDI screening."),
      blockingIssues,
      warnings,
    };
  }

  if (snapshot.status === "error") {
    const detail = "External DDI label lookup failed.";
    if (failClosedExternalChecks) {
      blockingIssues.push(detail);
      return {
        check: makeCheck("FAIL", detail),
        blockingIssues,
        warnings,
      };
    }
    warnings.push(detail);
    return {
      check: makeCheck("WARN", detail),
      blockingIssues,
      warnings,
    };
  }

  const interactionText = normalizeToken(snapshot.interactionsText);
  if (!interactionText) {
    const detail = "No interaction text available from external references.";
    warnings.push(detail);
    return {
      check: makeCheck("WARN", detail),
      blockingIssues,
      warnings,
    };
  }

  const matchedMeds = dedupe(
    currentMedications.filter((medication) => {
      const aliases = buildMedicationAliases(medication);
      return aliases.some((alias) => tokenAppears(interactionText, alias));
    }),
  );

  if (matchedMeds.length > 0) {
    const detail = `External interaction section references concurrent medication(s): ${matchedMeds.join(", ")}.`;
    blockingIssues.push(detail);
    return {
      check: makeCheck("FAIL", detail),
      blockingIssues,
      warnings,
    };
  }

  return {
    check: makeCheck("PASS", "No concurrent medication terms were detected in external interaction sections."),
    blockingIssues,
    warnings,
  };
}

function evaluateExternalDoseRangeCheck(params: {
  snapshot: ExternalClinicalSafetySnapshot;
  result: CalculationResult;
  patientWeightKg: number;
  failClosedExternalChecks: boolean;
}) {
  const { snapshot, result, patientWeightKg, failClosedExternalChecks } = params;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (snapshot.status === "error") {
    const detail = "External dose-range lookup failed.";
    if (failClosedExternalChecks) {
      blockingIssues.push(detail);
      return {
        check: makeCheck("FAIL", detail),
        constraints: {
          maxSingleDoseMg: null,
          maxDailyDoseMg: null,
          maxDailyDoseMgPerKg: null,
        } satisfies DoseRangeConstraints,
        blockingIssues,
        warnings,
      };
    }
    warnings.push(detail);
    return {
      check: makeCheck("WARN", detail),
      constraints: {
        maxSingleDoseMg: null,
        maxDailyDoseMg: null,
        maxDailyDoseMgPerKg: null,
      } satisfies DoseRangeConstraints,
      blockingIssues,
      warnings,
    };
  }

  const combinedDoseText = normalizeWhitespace(`${snapshot.doseText} ${snapshot.pediatricText}`);
  if (!combinedDoseText) {
    const detail = "No dosage text available in external labels.";
    warnings.push(detail);
    return {
      check: makeCheck("WARN", detail),
      constraints: {
        maxSingleDoseMg: null,
        maxDailyDoseMg: null,
        maxDailyDoseMgPerKg: null,
      } satisfies DoseRangeConstraints,
      blockingIssues,
      warnings,
    };
  }

  const constraints = extractDoseConstraintsFromLabelText(combinedDoseText);
  const hasAnyConstraint =
    constraints.maxSingleDoseMg !== null ||
    constraints.maxDailyDoseMg !== null ||
    constraints.maxDailyDoseMgPerKg !== null;

  if (!hasAnyConstraint) {
    const detail = "No deterministic numeric max dose constraints were extracted from external labels.";
    warnings.push(detail);
    return {
      check: makeCheck("WARN", detail),
      constraints,
      blockingIssues,
      warnings,
    };
  }

  const violations: string[] = [];
  if (
    constraints.maxSingleDoseMg !== null &&
    result.singleDoseMg > constraints.maxSingleDoseMg
  ) {
    violations.push(
      `single dose ${formatNumber(result.singleDoseMg)} mg > max ${formatNumber(constraints.maxSingleDoseMg)} mg`,
    );
  }

  if (constraints.maxDailyDoseMg !== null && result.dailyDoseMg > constraints.maxDailyDoseMg) {
    violations.push(
      `daily dose ${formatNumber(result.dailyDoseMg)} mg > max ${formatNumber(constraints.maxDailyDoseMg)} mg/day`,
    );
  }

  if (
    constraints.maxDailyDoseMgPerKg !== null &&
    patientWeightKg > 0 &&
    result.dailyDoseMg / patientWeightKg > constraints.maxDailyDoseMgPerKg
  ) {
    const computed = result.dailyDoseMg / patientWeightKg;
    violations.push(
      `daily dose ${formatNumber(computed)} mg/kg/day > max ${formatNumber(constraints.maxDailyDoseMgPerKg)} mg/kg/day`,
    );
  }

  if (violations.length > 0) {
    const detail = `External dose-range violation: ${violations.join("; ")}.`;
    blockingIssues.push(detail);
    return {
      check: makeCheck("FAIL", detail),
      constraints,
      blockingIssues,
      warnings,
    };
  }

  const summary: string[] = [];
  if (constraints.maxSingleDoseMg !== null) {
    summary.push(`max single ${formatNumber(constraints.maxSingleDoseMg)} mg`);
  }
  if (constraints.maxDailyDoseMg !== null) {
    summary.push(`max daily ${formatNumber(constraints.maxDailyDoseMg)} mg/day`);
  }
  if (constraints.maxDailyDoseMgPerKg !== null) {
    summary.push(`max daily ${formatNumber(constraints.maxDailyDoseMgPerKg)} mg/kg/day`);
  }

  return {
    check: makeCheck("PASS", `External dose checks passed against extracted limits: ${summary.join(", ")}.`),
    constraints,
    blockingIssues,
    warnings,
  };
}

function evaluateAllergyCrossSensitivityCheck(params: {
  snapshot: ExternalClinicalSafetySnapshot;
  medicationName: string;
  ingredients: string[];
  allergies: string[];
  failClosedExternalChecks: boolean;
}) {
  const { snapshot, medicationName, ingredients, allergies, failClosedExternalChecks } = params;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!allergies.length) {
    return {
      check: makeCheck("PASS", "No patient allergies recorded for cross-sensitivity screening."),
      blockingIssues,
      warnings,
    };
  }

  if (snapshot.status === "error") {
    const detail = "External allergy cross-sensitivity lookup failed.";
    if (failClosedExternalChecks) {
      blockingIssues.push(detail);
      return {
        check: makeCheck("FAIL", detail),
        blockingIssues,
        warnings,
      };
    }
    warnings.push(detail);
    return {
      check: makeCheck("WARN", detail),
      blockingIssues,
      warnings,
    };
  }

  const corpus = normalizeToken(
    [medicationName, ...ingredients, snapshot.contraindicationsText, snapshot.warningsText].join(" "),
  );
  const matches: string[] = [];

  for (const allergy of allergies) {
    const mappedTokens = buildCrossSensitivityTokens(allergy);
    for (const token of mappedTokens) {
      if (tokenAppears(corpus, token)) {
        matches.push(`${allergy} -> ${token}`);
      }
    }
  }

  if (matches.length > 0) {
    const uniqueMatches = dedupe(matches);
    const detail = `Potential cross-sensitivity detected from external label data: ${uniqueMatches.join(", ")}.`;
    blockingIssues.push(detail);
    return {
      check: makeCheck("FAIL", detail),
      blockingIssues,
      warnings,
    };
  }

  return {
    check: makeCheck("PASS", "No external cross-sensitivity term match detected."),
    blockingIssues,
    warnings,
  };
}

export function evaluateExternalClinicalChecks(params: {
  medicationName: string;
  result: CalculationResult;
  patientWeightKg: number;
  allergies: string[];
  ingredients: string[];
  currentMedications: string[];
  snapshot: ExternalClinicalSafetySnapshot;
  failClosedExternalChecks: boolean;
}) {
  const ddi = evaluateDrugInteractionCheck({
    snapshot: params.snapshot,
    currentMedications: params.currentMedications,
    failClosedExternalChecks: params.failClosedExternalChecks,
  });

  const dose = evaluateExternalDoseRangeCheck({
    snapshot: params.snapshot,
    result: params.result,
    patientWeightKg: params.patientWeightKg,
    failClosedExternalChecks: params.failClosedExternalChecks,
  });

  const allergy = evaluateAllergyCrossSensitivityCheck({
    snapshot: params.snapshot,
    medicationName: params.medicationName,
    ingredients: params.ingredients,
    allergies: params.allergies,
    failClosedExternalChecks: params.failClosedExternalChecks,
  });

  const extractionWarnings = params.snapshot.extractionWarnings.filter(
    (warning) => warning.trim().length > 0,
  );
  const extractionBlocking = params.failClosedExternalChecks ? extractionWarnings : [];
  const extractionNonBlocking = params.failClosedExternalChecks ? [] : extractionWarnings;

  return {
    checks: {
      drugInteractions: ddi.check,
      externalDoseRange: dose.check,
      allergyCrossSensitivity: allergy.check,
    },
    doseConstraints: dose.constraints,
    blockingIssues: [
      ...ddi.blockingIssues,
      ...dose.blockingIssues,
      ...allergy.blockingIssues,
      ...extractionBlocking,
    ],
    warnings: [
      ...ddi.warnings,
      ...dose.warnings,
      ...allergy.warnings,
      ...extractionNonBlocking,
    ],
  };
}
