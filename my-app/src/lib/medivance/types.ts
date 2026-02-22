export type JobStatus =
  | "queued"
  | "in_progress"
  | "needs_review"
  | "verified"
  | "approved"
  | "rejected";

export type FormulaSource = "patient" | "company" | "generated";

export type CheckStatus = "PASS" | "FAIL" | "WARN";

export type IngredientUnit = "mg" | "g" | "mL";

export type IngredientRole = "api" | "vehicle" | "excipient";

export interface Ingredient {
  name: string;
  role: IngredientRole;
  quantity: number;
  unit: IngredientUnit;
  concentrationMgPerMl?: number;
  ndc?: string;
}

export interface BudRule {
  category: "aqueous" | "non_aqueous";
  hasStabilityData: boolean;
  stabilityDays?: number;
}

export interface FormulaSafetyProfile {
  minSingleDoseMg?: number;
  maxSingleDoseMg?: number;
  maxDailyDoseMg?: number;
  contraindicatedIngredients?: string[];
  incompatibilities?: string[][];
}

export interface WorkingPrescription {
  medicationName: string;
  route: string;
  doseMgPerKg: number;
  frequencyPerDay: number;
  strengthMgPerMl: number;
  dispenseVolumeMl: number;
}

export interface CalculationInput {
  prescription: WorkingPrescription;
  patientWeightKg: number;
  budRule: BudRule;
  ingredients: Ingredient[];
  pharmacistFeedback?: string;
}

export interface CalculationIngredientResult {
  name: string;
  requiredAmount: number;
  unit: IngredientUnit;
  lotExpiryWarning?: string;
}

export interface CalculationResult {
  singleDoseMg: number;
  dailyDoseMg: number;
  finalConcentrationMgPerMl: number;
  finalVolumeMl: number;
  budDays: number;
  budDateIso: string;
  ingredients: CalculationIngredientResult[];
  steps: string[];
  notes: string[];
}

export interface CheckResult {
  status: CheckStatus;
  detail: string;
}

export interface HardChecks {
  doseRange: CheckResult;
  allergyCrosscheck: CheckResult;
  unitsConsistency: CheckResult;
  budValidity: CheckResult;
  inventoryAvailability: CheckResult;
  lotExpiry: CheckResult;
  incompatibilities: CheckResult;
}

export interface HardCheckSummary {
  checks: HardChecks;
  blockingIssues: string[];
  warnings: string[];
}

export interface AiReviewResult {
  clinicalReasonableness: CheckResult;
  preparationCompleteness: CheckResult;
  citationQuality: CheckResult;
  overall: "PASS" | "FAIL" | "NEEDS_REVIEW";
}
