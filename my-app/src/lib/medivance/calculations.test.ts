import { describe, expect, it } from "vitest";

import {
  alligation,
  applyDeterministicCorrections,
  assignBud,
  calculateCompoundingReport,
  dilution,
  doseByWeight,
} from "./calculations";

describe("calculations", () => {
  it("computes alligation deterministically", () => {
    const result = alligation(20, 5, 10, 100);
    expect(result.highConcentrationQuantity).toBeCloseTo(33.3333, 4);
    expect(result.lowConcentrationQuantity).toBeCloseTo(66.6667, 4);
  });

  it("solves C1V1=C2V2 for missing variable", () => {
    const missingV1 = dilution({ c1: 20, c2: 5, v2: 100 });
    expect(missingV1).toBe(25);
  });

  it("computes weight-based doses", () => {
    const dose = doseByWeight({
      mgPerKg: 1.5,
      weightKg: 20,
      frequencyPerDay: 2,
    });
    expect(dose.singleDoseMg).toBe(30);
    expect(dose.dailyDoseMg).toBe(60);
  });

  it("applies BUD deterministic bounds", () => {
    expect(assignBud({ category: "aqueous", hasStabilityData: false })).toBe(14);
    expect(assignBud({ category: "non_aqueous", hasStabilityData: false })).toBe(90);
    expect(assignBud({ category: "aqueous", hasStabilityData: true, stabilityDays: 365 })).toBe(
      180,
    );
  });

  it("builds compounding report with deterministic ingredient totals", () => {
    const result = calculateCompoundingReport({
      prescription: {
        medicationName: "Omeprazole",
        route: "PO",
        doseMgPerKg: 1,
        frequencyPerDay: 2,
        strengthMgPerMl: 2,
        dispenseVolumeMl: 100,
      },
      patientWeightKg: 25,
      budRule: { category: "aqueous", hasStabilityData: false },
      ingredients: [
        {
          name: "Omeprazole",
          role: "api",
          quantity: 0.5,
          unit: "g",
          concentrationMgPerMl: 2,
        },
        {
          name: "Vehicle",
          role: "vehicle",
          quantity: 0,
          unit: "mL",
        },
      ],
    });

    expect(result.singleDoseMg).toBe(25);
    expect(result.dailyDoseMg).toBe(50);
    expect(result.finalVolumeMl).toBe(100);
    expect(result.ingredients[0]?.requiredAmount).toBeCloseTo(0.206, 3);
    expect(result.ingredients[1]?.requiredAmount).toBe(100);
    expect(result.steps.length).toBeGreaterThanOrEqual(5);
  });

  it("applies deterministic correction heuristics", () => {
    const corrected = applyDeterministicCorrections(
      {
        medicationName: "Baclofen",
        route: "PO",
        doseMgPerKg: 1,
        frequencyPerDay: 3,
        strengthMgPerMl: 10,
        dispenseVolumeMl: 120,
      },
      ["Dose out of bounds", "Inventory shortage", "Known incompatibility detected"],
    );

    expect(corrected.doseMgPerKg).toBeLessThan(1);
    expect(corrected.dispenseVolumeMl).toBeLessThan(120);
    expect(corrected.strengthMgPerMl).toBeLessThan(10);
  });
});
