import {
  buildMissingExternalClinicalSafetySnapshot,
  evaluateExternalClinicalChecks,
} from "./external-safety";
import { env } from "../env";
import type {
  CalculationResult,
  ExternalClinicalSafetySnapshot,
  FormulaSafetyProfile,
  HardCheckSummary,
  IngredientUnit,
} from "@/lib/medivance/types";

export interface InventoryLotSnapshot {
  ingredientName: string;
  availableQuantity: number;
  unit: IngredientUnit | string;
  expiresOn: string;
  lotNumber: string;
}

const MG_PER_G = 1000;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function toMg(quantity: number, unit: string) {
  if (unit === "mg") return quantity;
  if (unit === "g") return quantity * MG_PER_G;
  return quantity;
}

function getLowStockWarningMultiplier(
  formulaSafety: FormulaSafetyProfile,
  ingredientName: string,
) {
  const perIngredient = formulaSafety.lowStockWarningMultiplierByIngredient ?? {};
  const normalizedIngredientName = normalize(ingredientName);
  const matchedEntry = Object.entries(perIngredient).find(
    ([key]) => normalize(key) === normalizedIngredientName,
  );
  const byIngredient = matchedEntry?.[1];

  const configured =
    byIngredient ??
    formulaSafety.lowStockWarningMultiplier ??
    env.lowStockWarningMultiplier;

  if (!Number.isFinite(configured) || configured <= 1) {
    return 1.25;
  }
  return configured;
}

export function runHardChecks(params: {
  medicationName?: string;
  result: CalculationResult;
  allergies: string[];
  formulaSafety: FormulaSafetyProfile;
  ingredients: string[];
  inventoryLots: InventoryLotSnapshot[];
  patientWeightKg?: number;
  currentMedications?: string[];
  externalSafetySnapshot?: ExternalClinicalSafetySnapshot;
  failClosedExternalChecks?: boolean;
}) {
  const { result, allergies, formulaSafety, ingredients, inventoryLots } = params;
  const patientWeightKg = params.patientWeightKg ?? 0;
  const currentMedications = params.currentMedications ?? [];
  const medicationName = params.medicationName ?? (ingredients[0] ?? "unknown");
  const externalSafetySnapshot =
    params.externalSafetySnapshot ??
    buildMissingExternalClinicalSafetySnapshot(medicationName);
  const failClosedExternalChecks = params.failClosedExternalChecks ?? false;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  const minSingleDose = formulaSafety.minSingleDoseMg ?? 0;
  const maxSingleDose = formulaSafety.maxSingleDoseMg ?? 1000;
  const maxDailyDose = formulaSafety.maxDailyDoseMg ?? 4000;

  const doseRangeStatus =
    result.singleDoseMg >= minSingleDose &&
    result.singleDoseMg <= maxSingleDose &&
    result.dailyDoseMg <= maxDailyDose;

  if (!doseRangeStatus) {
    blockingIssues.push(
      `Dose out of bounds: single ${result.singleDoseMg} mg (range ${minSingleDose}-${maxSingleDose}), daily ${result.dailyDoseMg} mg (max ${maxDailyDose}).`,
    );
  }

  const allergyMatches = allergies.filter((allergy) => {
    const token = normalize(allergy);
    return ingredients.some((name) => normalize(name).includes(token));
  });

  if (allergyMatches.length) {
    blockingIssues.push(
      `Potential allergy crossmatch detected: ${allergyMatches.join(", ")}.`,
    );
  }

  const invalidUnits = result.ingredients.filter(
    (ingredient) => !Number.isFinite(ingredient.requiredAmount) || ingredient.requiredAmount <= 0,
  );

  if (invalidUnits.length) {
    blockingIssues.push("Unit consistency failed: at least one ingredient quantity is invalid.");
  }

  if (result.budDays <= 0 || result.budDays > 180) {
    blockingIssues.push(
      `Assigned BUD ${result.budDays} days is outside supported bounds (1-180).`,
    );
  }

  const requiredByIngredient = new Map<
    string,
    { quantity: number; unit: string; displayName: string }
  >();
  for (const ingredient of result.ingredients) {
    requiredByIngredient.set(normalize(ingredient.name), {
      quantity: ingredient.requiredAmount,
      unit: ingredient.unit,
      displayName: ingredient.name,
    });
  }

  let inventoryShortages = 0;
  const lowStockIngredients: string[] = [];
  for (const [ingredientName, requirement] of requiredByIngredient.entries()) {
    const lots = inventoryLots.filter(
      (lot) => normalize(lot.ingredientName) === ingredientName,
    );

    if (!lots.length) {
      inventoryShortages += 1;
      continue;
    }

    const warningThresholdMultiplier = getLowStockWarningMultiplier(
      formulaSafety,
      requirement.displayName,
    );

    if (requirement.unit === "mL") {
      const totalAvailableMl = lots
        .filter((lot) => lot.unit === "mL")
        .reduce((sum, lot) => sum + lot.availableQuantity, 0);

      if (totalAvailableMl < requirement.quantity) {
        inventoryShortages += 1;
      } else if (totalAvailableMl < requirement.quantity * warningThresholdMultiplier) {
        lowStockIngredients.push(requirement.displayName);
      }
      continue;
    }

    const requiredMg = toMg(requirement.quantity, requirement.unit);
    const totalAvailableMg = lots.reduce((sum, lot) => {
      return sum + toMg(lot.availableQuantity, lot.unit);
    }, 0);

    if (totalAvailableMg < requiredMg) {
      inventoryShortages += 1;
    } else if (totalAvailableMg < requiredMg * warningThresholdMultiplier) {
      lowStockIngredients.push(requirement.displayName);
    }
  }

  if (inventoryShortages > 0) {
    blockingIssues.push(`Inventory shortage on ${inventoryShortages} required ingredient(s).`);
  }
  if (lowStockIngredients.length > 0) {
    warnings.push(
      `Inventory is low for ${Array.from(new Set(lowStockIngredients)).join(", ")}; replenish soon.`,
    );
  }

  const budDate = new Date(result.budDateIso);
  let expiryIssues = 0;

  for (const ingredient of result.ingredients) {
    const lotExpiries = inventoryLots
      .filter((lot) => normalize(lot.ingredientName) === normalize(ingredient.name))
      .map((lot) => new Date(lot.expiresOn))
      .filter((date) => !Number.isNaN(date.getTime()));

    if (!lotExpiries.length) {
      continue;
    }

    const earliest = lotExpiries.reduce((min, current) => (current < min ? current : min));
    if (earliest < budDate) {
      expiryIssues += 1;
    }
  }

  if (expiryIssues > 0) {
    blockingIssues.push(`Lot expiry occurs before BUD for ${expiryIssues} ingredient(s).`);
  }

  const incompatibilityPairs = formulaSafety.incompatibilities ?? [];
  const foundIncompatibilities = incompatibilityPairs.filter((pair) => {
    if (!Array.isArray(pair) || pair.length < 2) return false;
    const [a, b] = pair.map((item) => normalize(String(item)));
    return ingredients.some((name) => normalize(name).includes(a)) &&
      ingredients.some((name) => normalize(name).includes(b));
  });

  if (foundIncompatibilities.length) {
    blockingIssues.push("Known incompatibility detected in ingredient combination.");
  }

  if (result.steps.length < 4) {
    warnings.push("Preparation instructions are sparse; verify compounding technique details.");
  }

  const externalClinical = evaluateExternalClinicalChecks({
    medicationName,
    result,
    patientWeightKg,
    allergies,
    ingredients,
    currentMedications,
    snapshot: externalSafetySnapshot,
    failClosedExternalChecks,
  });

  blockingIssues.push(...externalClinical.blockingIssues);
  warnings.push(...externalClinical.warnings);

  return {
    checks: {
      doseRange: {
        status: doseRangeStatus ? "PASS" : "FAIL",
        detail: doseRangeStatus
          ? `Dose within configured bounds (${minSingleDose}-${maxSingleDose} mg single dose).`
          : "Dose exceeded configured safety range.",
      },
      allergyCrosscheck: {
        status: allergyMatches.length ? "FAIL" : "PASS",
        detail: allergyMatches.length
          ? `Potential crossmatch with: ${allergyMatches.join(", ")}.`
          : "No patient allergy conflict detected against ingredients.",
      },
      allergyCrossSensitivity: externalClinical.checks.allergyCrossSensitivity,
      drugInteractions: externalClinical.checks.drugInteractions,
      externalDoseRange: externalClinical.checks.externalDoseRange,
      unitsConsistency: {
        status: invalidUnits.length ? "FAIL" : "PASS",
        detail: invalidUnits.length
          ? "At least one ingredient quantity failed unit validation."
          : "All ingredient quantities are finite and positive.",
      },
      budValidity: {
        status: result.budDays <= 0 || result.budDays > 180 ? "FAIL" : "PASS",
        detail:
          result.budDays <= 0 || result.budDays > 180
            ? `BUD ${result.budDays} days is invalid.`
            : `BUD ${result.budDays} days assigned through deterministic rules.`,
      },
      inventoryAvailability: {
        status: inventoryShortages ? "FAIL" : "PASS",
        detail: inventoryShortages
          ? `Inventory short on ${inventoryShortages} ingredient(s).`
          : "Inventory can satisfy calculated requirements.",
      },
      lotExpiry: {
        status: expiryIssues ? "FAIL" : "PASS",
        detail: expiryIssues
          ? `${expiryIssues} ingredient lot(s) expire before assigned BUD.`
          : "All lots are valid through assigned BUD.",
      },
      incompatibilities: {
        status: foundIncompatibilities.length ? "FAIL" : "PASS",
        detail: foundIncompatibilities.length
          ? "Incompatible ingredient pair present in formula."
          : "No known incompatibility pair matched.",
      },
    },
    blockingIssues,
    warnings,
  } satisfies HardCheckSummary;
}
