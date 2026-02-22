import type {
  BudRule,
  CalculationInput,
  CalculationResult,
  Ingredient,
  WorkingPrescription,
} from "@/lib/medivance/types";

const MG_PER_G = 1000;

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function alligation(
  cHigh: number,
  cLow: number,
  cDesired: number,
  totalQuantity: number,
) {
  if (cHigh <= cLow) {
    throw new Error("High concentration must be greater than low concentration.");
  }
  if (cDesired <= cLow || cDesired >= cHigh) {
    throw new Error("Desired concentration must fall between low and high concentrations.");
  }

  const partsHigh = cDesired - cLow;
  const partsLow = cHigh - cDesired;
  const totalParts = partsHigh + partsLow;

  return {
    highConcentrationQuantity: round((partsHigh / totalParts) * totalQuantity, 4),
    lowConcentrationQuantity: round((partsLow / totalParts) * totalQuantity, 4),
  };
}

export function dilution(params: {
  c1?: number;
  v1?: number;
  c2?: number;
  v2?: number;
}) {
  const { c1, v1, c2, v2 } = params;
  const provided = [c1, v1, c2, v2].filter((value) => value !== undefined).length;

  if (provided !== 3) {
    throw new Error("Provide exactly 3 values for C1V1=C2V2.");
  }

  if (c1 === undefined) return round((c2! * v2!) / v1!, 6);
  if (v1 === undefined) return round((c2! * v2!) / c1!, 6);
  if (c2 === undefined) return round((c1 * v1) / v2!, 6);
  return round((c1 * v1) / c2, 6);
}

export function doseByWeight(params: {
  mgPerKg: number;
  weightKg: number;
  frequencyPerDay: number;
}) {
  const singleDoseMg = round(params.mgPerKg * params.weightKg, 4);
  const dailyDoseMg = round(singleDoseMg * params.frequencyPerDay, 4);

  return {
    singleDoseMg,
    dailyDoseMg,
  };
}

export function assignBud(rule: BudRule) {
  if (rule.hasStabilityData && rule.stabilityDays) {
    return Math.min(rule.stabilityDays, 180);
  }

  return rule.category === "aqueous" ? 14 : 90;
}

function getApiIngredient(ingredients: Ingredient[]) {
  return ingredients.find((ingredient) => ingredient.role === "api") ?? ingredients[0];
}

export function calculateCompoundingReport(input: CalculationInput): CalculationResult {
  const { prescription } = input;

  const safeWeightKg = Math.max(input.patientWeightKg || 0, 1);
  const safeConcentration = Math.max(prescription.strengthMgPerMl || 0, 1);
  const safeVolume = Math.max(prescription.dispenseVolumeMl || 0, 30);

  const dose = doseByWeight({
    mgPerKg: Math.max(prescription.doseMgPerKg || 0, 0.001),
    weightKg: safeWeightKg,
    frequencyPerDay: Math.max(prescription.frequencyPerDay || 1, 1),
  });

  const budDays = assignBud(input.budRule);
  const budDateIso = addDaysIso(budDays);

  const totalApiNeededMg = round(safeConcentration * safeVolume, 4);
  const apiIngredient = getApiIngredient(input.ingredients);
  const overfillMultiplier = 1.03;

  const ingredients = input.ingredients.map((ingredient) => {
    if (ingredient.name === apiIngredient.name) {
      if (ingredient.unit === "g") {
        return {
          name: ingredient.name,
          requiredAmount: round((totalApiNeededMg * overfillMultiplier) / MG_PER_G, 4),
          unit: ingredient.unit,
        };
      }

      return {
        name: ingredient.name,
        requiredAmount: round(totalApiNeededMg * overfillMultiplier, 3),
        unit: "mg" as const,
      };
    }

    if (ingredient.role === "vehicle") {
      return {
        name: ingredient.name,
        requiredAmount: round(safeVolume, 3),
        unit: "mL" as const,
      };
    }

    return {
      name: ingredient.name,
      requiredAmount: round(Math.max(ingredient.quantity, 0), 3),
      unit: ingredient.unit,
    };
  });

  const singleDoseVolumeMl = round(dose.singleDoseMg / safeConcentration, 4);

  const steps = [
    `Prepare a calibrated vessel for ${prescription.medicationName}.`,
    `Weigh/measure active ingredient to ${ingredients[0]?.requiredAmount ?? 0} ${ingredients[0]?.unit ?? "mg"}.`,
    `Levigate active ingredient and gradually qs with vehicle to ${round(safeVolume, 2)} mL.`,
    "Homogenize for 90 seconds and perform visual particulate inspection.",
    `Dispense with storage instructions. Assigned BUD: ${budDateIso}.`,
  ];

  const notes = [
    `Single dose: ${dose.singleDoseMg} mg (${singleDoseVolumeMl} mL at ${safeConcentration} mg/mL).`,
    `Daily dose: ${dose.dailyDoseMg} mg across ${prescription.frequencyPerDay} doses.`,
  ];

  if (input.pharmacistFeedback) {
    notes.push(`Pharmacist context considered: ${input.pharmacistFeedback}`);
  }

  return {
    singleDoseMg: dose.singleDoseMg,
    dailyDoseMg: dose.dailyDoseMg,
    finalConcentrationMgPerMl: round(safeConcentration, 4),
    finalVolumeMl: round(safeVolume, 3),
    budDays,
    budDateIso,
    ingredients,
    steps,
    notes,
  };
}

export function applyDeterministicCorrections(
  prescription: WorkingPrescription,
  issues: string[],
) {
  const next = { ...prescription };
  const joined = issues.join(" ").toLowerCase();

  if (joined.includes("dose")) {
    next.doseMgPerKg = round(Math.max(next.doseMgPerKg * 0.9, 0.01), 4);
  }

  if (joined.includes("inventory") || joined.includes("shortage")) {
    next.dispenseVolumeMl = round(Math.max(next.dispenseVolumeMl * 0.85, 15), 2);
  }

  if (joined.includes("incompatib")) {
    next.strengthMgPerMl = round(Math.max(next.strengthMgPerMl * 0.95, 1), 3);
  }

  return next;
}
