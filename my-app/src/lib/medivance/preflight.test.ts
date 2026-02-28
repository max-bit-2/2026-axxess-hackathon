import { describe, expect, it } from "vitest";

import type { JobContext, ResolvedFormula } from "./db";
import { runPreCompoundingPreflight } from "./preflight";

const baseContext: JobContext = {
  job: {
    id: "job-1",
    status: "queued",
    iterationCount: 0,
    priority: 2,
    lastError: null,
    pharmacistFeedback: null,
    formulaId: null,
  },
  prescription: {
    id: "rx-1",
    patientId: "patient-1",
    medicationName: "Omeprazole",
    route: "PO",
    doseMgPerKg: 1,
    frequencyPerDay: 2,
    strengthMgPerMl: 2,
    dispenseVolumeMl: 100,
    indication: null,
    notes: null,
    dueAt: "2026-03-01T00:00:00.000Z",
  },
  patient: {
    id: "patient-1",
    fullName: "Test Patient",
    dob: "2018-01-01",
    weightKg: 20,
    allergies: [],
    currentMedications: [],
    notes: null,
  },
};

const generatedFormula: ResolvedFormula = {
  id: "formula-1",
  source: "generated",
  name: "Generated Formula",
  medicationName: "Omeprazole",
  ingredients: [
    {
      name: "Omeprazole",
      role: "api",
      quantity: 1,
      unit: "g",
      concentrationMgPerMl: 2,
    },
    {
      name: "Ora-Blend",
      role: "vehicle",
      quantity: 100,
      unit: "mL",
    },
  ],
  safetyProfile: {
    minSingleDoseMg: 1,
    maxSingleDoseMg: 50,
    maxDailyDoseMg: 150,
  },
  instructions:
    "Triturate the API, gradually qs with vehicle, homogenize thoroughly, and dispense.",
  budRule: { category: "aqueous", hasStabilityData: false },
  equipment: [],
  qualityControl: [],
  containerClosure: "Amber bottle",
  labelingRequirements: "Shake well",
  budRationale: "Default aqueous BUD",
  references: [],
};

describe("pre-compounding preflight", () => {
  it("allows generated formulas to run without pharmacist context", () => {
    const summary = runPreCompoundingPreflight({
      context: baseContext,
      formula: generatedFormula,
    });

    expect(summary.blockingIssues).toHaveLength(0);
    expect(summary.checks.recipeProvenance.status).toBe("PASS");
    expect(summary.checks.recipeProvenance.detail).toContain("without pharmacist context");
    expect(summary.warnings.join(" ")).toContain("default generated version will be used");
  });

  it("records when pharmacist context is provided for generated formulas", () => {
    const summary = runPreCompoundingPreflight({
      context: baseContext,
      formula: generatedFormula,
      pharmacistFeedback: "Use lower osmolality vehicle and minimize total volume.",
    });

    expect(summary.blockingIssues).toHaveLength(0);
    expect(summary.checks.recipeProvenance.status).toBe("PASS");
    expect(summary.checks.recipeProvenance.detail).toContain("with pharmacist context");
    expect(summary.warnings.join(" ")).toContain("Pharmacist context will be applied");
  });
});
