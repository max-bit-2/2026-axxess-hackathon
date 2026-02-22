import { describe, expect, it } from "vitest";

import { runHardChecks } from "./safety";

describe("safety hard checks", () => {
  const baselineResult = {
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

  const baselineSafety = {
    minSingleDoseMg: 2,
    maxSingleDoseMg: 30,
    maxDailyDoseMg: 90,
    incompatibilities: [["omeprazole", "ethanol"]],
  };

  it("passes when all deterministic checks are valid", () => {
    const summary = runHardChecks({
      result: baselineResult,
      allergies: [],
      formulaSafety: baselineSafety,
      ingredients: ["Omeprazole", "Vehicle"],
      inventoryLots: [
        {
          ingredientName: "Omeprazole",
          availableQuantity: 1,
          unit: "g",
          expiresOn: "2026-12-31",
          lotNumber: "LOT-1",
        },
        {
          ingredientName: "Vehicle",
          availableQuantity: 500,
          unit: "mL",
          expiresOn: "2026-12-31",
          lotNumber: "LOT-2",
        },
      ],
    });

    expect(summary.blockingIssues).toHaveLength(0);
    expect(summary.checks.doseRange.status).toBe("PASS");
    expect(summary.checks.inventoryAvailability.status).toBe("PASS");
  });

  it("fails when dose exceeds configured range", () => {
    const summary = runHardChecks({
      result: { ...baselineResult, singleDoseMg: 100, dailyDoseMg: 300 },
      allergies: [],
      formulaSafety: baselineSafety,
      ingredients: ["Omeprazole", "Vehicle"],
      inventoryLots: [],
    });

    expect(summary.checks.doseRange.status).toBe("FAIL");
    expect(summary.blockingIssues.join(" ")).toContain("Dose out of bounds");
  });

  it("fails on allergy crossmatch", () => {
    const summary = runHardChecks({
      result: baselineResult,
      allergies: ["omep"],
      formulaSafety: baselineSafety,
      ingredients: ["Omeprazole", "Vehicle"],
      inventoryLots: [],
    });

    expect(summary.checks.allergyCrosscheck.status).toBe("FAIL");
  });

  it("fails on inventory shortage", () => {
    const summary = runHardChecks({
      result: baselineResult,
      allergies: [],
      formulaSafety: baselineSafety,
      ingredients: ["Omeprazole", "Vehicle"],
      inventoryLots: [
        {
          ingredientName: "Omeprazole",
          availableQuantity: 0.01,
          unit: "g",
          expiresOn: "2026-12-31",
          lotNumber: "LOT-1",
        },
      ],
    });

    expect(summary.checks.inventoryAvailability.status).toBe("FAIL");
  });

  it("warns when inventory is near shortage threshold", () => {
    const summary = runHardChecks({
      result: baselineResult,
      allergies: [],
      formulaSafety: baselineSafety,
      ingredients: ["Omeprazole", "Vehicle"],
      inventoryLots: [
        {
          ingredientName: "Omeprazole",
          availableQuantity: 0.24,
          unit: "g",
          expiresOn: "2026-12-31",
          lotNumber: "LOT-1",
        },
        {
          ingredientName: "Vehicle",
          availableQuantity: 105,
          unit: "mL",
          expiresOn: "2026-12-31",
          lotNumber: "LOT-2",
        },
      ],
    });

    expect(summary.checks.inventoryAvailability.status).toBe("PASS");
    expect(summary.warnings.join(" ")).toContain("Inventory is low");
  });

  it("fails when lot expiry is earlier than BUD", () => {
    const summary = runHardChecks({
      result: baselineResult,
      allergies: [],
      formulaSafety: baselineSafety,
      ingredients: ["Omeprazole", "Vehicle"],
      inventoryLots: [
        {
          ingredientName: "Omeprazole",
          availableQuantity: 1,
          unit: "g",
          expiresOn: "2026-02-01",
          lotNumber: "LOT-1",
        },
      ],
    });

    expect(summary.checks.lotExpiry.status).toBe("FAIL");
  });

  it("fails on known incompatibility pair", () => {
    const summary = runHardChecks({
      result: baselineResult,
      allergies: [],
      formulaSafety: {
        ...baselineSafety,
        incompatibilities: [["omeprazole", "ethanol"]],
      },
      ingredients: ["Omeprazole", "Vehicle", "Ethanol"],
      inventoryLots: [],
    });

    expect(summary.checks.incompatibilities.status).toBe("FAIL");
  });
});
