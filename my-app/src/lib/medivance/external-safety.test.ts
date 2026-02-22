import { describe, expect, it } from "vitest";

import {
  buildMissingExternalClinicalSafetySnapshot,
  evaluateExternalClinicalChecks,
  extractDoseConstraintsFromLabelText,
} from "./external-safety";

const baselineReport = {
  singleDoseMg: 10,
  dailyDoseMg: 20,
  finalConcentrationMgPerMl: 2,
  finalVolumeMl: 100,
  budDays: 14,
  budDateIso: "2026-03-10",
  ingredients: [
    { name: "Omeprazole", requiredAmount: 0.2, unit: "g" as const },
    { name: "Vehicle", requiredAmount: 100, unit: "mL" as const },
  ],
  steps: ["a", "b", "c", "d", "e"],
  notes: [],
};

describe("external safety", () => {
  it("extracts deterministic dose constraints from label text", () => {
    const constraints = extractDoseConstraintsFromLabelText(
      "Maximum 20 mg/dose. Do not exceed 40 mg/day. Up to 2 mg/kg/day.",
    );

    expect(constraints.maxSingleDoseMg).toBe(20);
    expect(constraints.maxDailyDoseMg).toBe(40);
    expect(constraints.maxDailyDoseMgPerKg).toBe(2);
  });

  it("flags DDI if interaction section mentions concurrent meds", () => {
    const summary = evaluateExternalClinicalChecks({
      medicationName: "Omeprazole",
      result: baselineReport,
      patientWeightKg: 25,
      allergies: [],
      ingredients: ["Omeprazole", "Vehicle"],
      currentMedications: ["Warfarin"],
      snapshot: {
        ...buildMissingExternalClinicalSafetySnapshot("Omeprazole"),
        status: "ok",
        interactionsText:
          "Clinically relevant interactions include warfarin and clopidogrel.",
      },
      failClosedExternalChecks: true,
    });

    expect(summary.checks.drugInteractions.status).toBe("FAIL");
    expect(summary.blockingIssues.join(" ").toLowerCase()).toContain("warfarin");
  });

  it("fails when external dose range is exceeded", () => {
    const summary = evaluateExternalClinicalChecks({
      medicationName: "Omeprazole",
      result: { ...baselineReport, singleDoseMg: 16, dailyDoseMg: 32 },
      patientWeightKg: 20,
      allergies: [],
      ingredients: ["Omeprazole", "Vehicle"],
      currentMedications: [],
      snapshot: {
        ...buildMissingExternalClinicalSafetySnapshot("Omeprazole"),
        status: "ok",
        doseText: "Do not exceed 15 mg/dose. Maximum 30 mg/day.",
      },
      failClosedExternalChecks: true,
    });

    expect(summary.checks.externalDoseRange.status).toBe("FAIL");
    expect(summary.blockingIssues.join(" ")).toContain("dose-range violation");
  });

  it("flags allergy cross-sensitivity from ingredient/corpus match", () => {
    const summary = evaluateExternalClinicalChecks({
      medicationName: "Sulfamethoxazole Compound",
      result: baselineReport,
      patientWeightKg: 25,
      allergies: ["sulfa"],
      ingredients: ["Sulfamethoxazole", "Vehicle"],
      currentMedications: [],
      snapshot: {
        ...buildMissingExternalClinicalSafetySnapshot("Sulfamethoxazole"),
        status: "ok",
        contraindicationsText:
          "Contraindicated in patients with sulfonamide hypersensitivity.",
      },
      failClosedExternalChecks: true,
    });

    expect(summary.checks.allergyCrossSensitivity.status).toBe("FAIL");
    expect(summary.blockingIssues.join(" ")).toContain("cross-sensitivity");
  });

  it("returns WARN instead of FAIL on external errors when fail-closed is off", () => {
    const summary = evaluateExternalClinicalChecks({
      medicationName: "Baclofen",
      result: baselineReport,
      patientWeightKg: 20,
      allergies: ["penicillin"],
      ingredients: ["Baclofen", "Vehicle"],
      currentMedications: ["Amoxicillin"],
      snapshot: {
        ...buildMissingExternalClinicalSafetySnapshot("Baclofen"),
        status: "error",
      },
      failClosedExternalChecks: false,
    });

    expect(summary.checks.drugInteractions.status).toBe("WARN");
    expect(summary.checks.externalDoseRange.status).toBe("WARN");
    expect(summary.checks.allergyCrossSensitivity.status).toBe("WARN");
  });

  it("treats extraction warnings as non-blocking when fail-closed is off", () => {
    const summary = evaluateExternalClinicalChecks({
      medicationName: "Baclofen",
      result: baselineReport,
      patientWeightKg: 20,
      allergies: [],
      ingredients: ["Baclofen", "Vehicle"],
      currentMedications: [],
      snapshot: {
        ...buildMissingExternalClinicalSafetySnapshot("Baclofen"),
        status: "missing",
        extractionWarnings: ["openFDA returned no clinical label records for Baclofen."],
      },
      failClosedExternalChecks: false,
    });

    expect(summary.blockingIssues).toHaveLength(0);
    expect(summary.warnings.join(" ")).toContain("openFDA returned no clinical label records");
  });

  it("treats extraction warnings as blocking when fail-closed is on", () => {
    const summary = evaluateExternalClinicalChecks({
      medicationName: "Baclofen",
      result: baselineReport,
      patientWeightKg: 20,
      allergies: [],
      ingredients: ["Baclofen", "Vehicle"],
      currentMedications: [],
      snapshot: {
        ...buildMissingExternalClinicalSafetySnapshot("Baclofen"),
        status: "missing",
        extractionWarnings: ["openFDA returned no clinical label records for Baclofen."],
      },
      failClosedExternalChecks: true,
    });

    expect(summary.blockingIssues.join(" ")).toContain(
      "openFDA returned no clinical label records",
    );
  });
});
