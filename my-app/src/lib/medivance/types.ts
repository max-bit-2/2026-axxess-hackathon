export type JobStatus =
  | "queued"
  | "in_progress"
  | "needs_review"
  | "verified"
  | "approved"
  | "rejected";

export type FormulaSource = "patient" | "company" | "generated";

export type CheckStatus = "PASS" | "FAIL" | "WARN";
export type ReferenceStatus = "ok" | "missing" | "error";
export type SignatureMeaning = "reviewed_and_approved" | "compounded_by" | "verified_by";

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
  lowStockWarningMultiplier?: number;
  lowStockWarningMultiplierByIngredient?: Record<string, number>;
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

export interface DoseRangeConstraints {
  maxSingleDoseMg: number | null;
  maxDailyDoseMg: number | null;
  maxDailyDoseMgPerKg: number | null;
}

export interface ExternalClinicalSafetySnapshot {
  medicationName: string;
  status: ReferenceStatus;
  sourceUrl: string | null;
  setId: string | null;
  doseText: string;
  pediatricText: string;
  interactionsText: string;
  contraindicationsText: string;
  warningsText: string;
  extractionWarnings: string[];
}

export type MedicationCitationSource = "openfda" | "rxnav" | "dailymed";

export interface MedicationCitation {
  source: MedicationCitationSource;
  title: string;
  url: string;
  detail?: string;
}

export interface MedicationReferenceSnapshot {
  medicationName: string;
  rxNormStatus: ReferenceStatus;
  rxNormId: string | null;
  rxNormName: string | null;
  openFdaStatus: ReferenceStatus;
  openFdaInteractionLabelCount: number;
  openFdaSampleSetId: string | null;
  openFdaNdcStatus: ReferenceStatus;
  openFdaNdcCount: number;
  openFdaNdcProductNdc: string | null;
  dailyMedStatus: ReferenceStatus;
  dailyMedSetId: string | null;
  dailyMedTitle: string | null;
  dailyMedPublishedDate: string | null;
  citations: MedicationCitation[];
  warnings: string[];
}

export interface HardChecks {
  doseRange: CheckResult;
  allergyCrosscheck: CheckResult;
  allergyCrossSensitivity: CheckResult;
  drugInteractions: CheckResult;
  externalDoseRange: CheckResult;
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
  citations: MedicationCitation[];
  externalWarnings: string[];
}
