#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const SCENARIOS = [
  {
    key: "pass",
    patient: {
      first_name: "DemoVerified",
      last_name: "Patient",
      dob: "1991-05-14",
      weight_kg: 68.2,
      allergies: [],
      notes: "Pipeline demo scenario: expected to verify successfully.",
    },
    formula: {
      medication_name: "Omeprazole",
      name: "Demo Verified Omeprazole 2 mg/mL",
      source: "patient",
      ingredient_profile: [
        {
          name: "Omeprazole Demo API",
          role: "api",
          quantity: 0.5,
          unit: "g",
          concentrationMgPerMl: 2,
        },
        {
          name: "Demo Sodium Bicarbonate Vehicle",
          role: "vehicle",
          quantity: 0,
          unit: "mL",
        },
      ],
      safety_profile: {
        minSingleDoseMg: 2,
        maxSingleDoseMg: 40,
        maxDailyDoseMg: 80,
        budRule: {
          category: "aqueous",
          hasStabilityData: false,
        },
      },
      instructions:
        "Suspend omeprazole in sodium bicarbonate vehicle, protect from light, and verify final volume before dispense.",
      is_active: true,
    },
    prescription: {
      medication_name: "Omeprazole",
      indication: "GERD",
      route: "PO",
      dose_mg_per_kg: 0.4,
      frequency_per_day: 2,
      strength_mg_per_ml: 2,
      dispense_volume_ml: 150,
      notes: "Pipeline demo scenario: expected VERIFIED outcome.",
    },
    inventory: [
      {
        ingredient_name: "Omeprazole Demo API",
        lot_number: "PIPE-PASS-API-01",
        available_quantity: 5,
        unit: "g",
        expires_on: "2027-12-31",
      },
      {
        ingredient_name: "Demo Sodium Bicarbonate Vehicle",
        lot_number: "PIPE-PASS-VEH-01",
        available_quantity: 1000,
        unit: "mL",
        expires_on: "2026-12-31",
      },
    ],
  },
  {
    key: "fail",
    patient: {
      first_name: "DemoFailing",
      last_name: "Patient",
      dob: "1987-08-20",
      weight_kg: 79.4,
      allergies: [],
      notes: "Pipeline demo scenario: expected to fail dose and inventory checks.",
    },
    formula: {
      medication_name: "Omeprazole",
      name: "Demo Failing Omeprazole 2 mg/mL",
      source: "patient",
      ingredient_profile: [
        {
          name: "Omeprazole Demo Fail API",
          role: "api",
          quantity: 0.5,
          unit: "g",
          concentrationMgPerMl: 2,
        },
        {
          name: "Demo Fail Vehicle",
          role: "vehicle",
          quantity: 0,
          unit: "mL",
        },
      ],
      safety_profile: {
        minSingleDoseMg: 2,
        maxSingleDoseMg: 40,
        maxDailyDoseMg: 80,
        budRule: {
          category: "aqueous",
          hasStabilityData: false,
        },
      },
      instructions:
        "Suspend omeprazole in the demo fail vehicle, document calculations, and verify compounding technique.",
      is_active: true,
    },
    prescription: {
      medication_name: "Omeprazole",
      indication: "GERD",
      route: "PO",
      dose_mg_per_kg: 1.2,
      frequency_per_day: 2,
      strength_mg_per_ml: 2,
      dispense_volume_ml: 150,
      notes: "Pipeline demo scenario: expected NEEDS_REVIEW due to dose and inventory failures.",
    },
    inventory: [
      {
        ingredient_name: "Omeprazole Demo Fail API",
        lot_number: "PIPE-FAIL-API-01",
        available_quantity: 0.05,
        unit: "g",
        expires_on: "2027-12-31",
      },
      {
        ingredient_name: "Demo Fail Vehicle",
        lot_number: "PIPE-FAIL-VEH-01",
        available_quantity: 50,
        unit: "mL",
        expires_on: "2026-12-31",
      },
    ],
  },
];

function usage() {
  console.log(
    "Usage: node scripts/seed-pipeline-demo-cases.mjs --email USER_EMAIL",
  );
}

function parseArgs(argv) {
  let email = "";

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--email" && next) {
      email = next.trim().toLowerCase();
      index += 1;
      continue;
    }

    if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    }
  }

  if (!email) {
    usage();
    process.exit(1);
  }

  return { email };
}

async function listUsersByEmail() {
  const map = new Map();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email) {
        map.set(user.email.toLowerCase(), user);
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return map;
}

async function getOrCreatePatient(userId, scenario) {
  const { data: existing, error: existingError } = await supabase
    .from("patients")
    .select("id")
    .eq("owner_id", userId)
    .eq("first_name", scenario.patient.first_name)
    .eq("last_name", scenario.patient.last_name)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("patients")
      .update({
        dob: scenario.patient.dob,
        weight_kg: scenario.patient.weight_kg,
        allergies: scenario.patient.allergies,
        notes: scenario.patient.notes,
      })
      .eq("id", existing.id)
      .eq("owner_id", userId);

    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("patients")
    .insert({
      owner_id: userId,
      ...scenario.patient,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw error ?? new Error("Failed to create patient.");
  return data.id;
}

async function upsertFormula(userId, patientId, scenario) {
  const { data: existing, error: existingError } = await supabase
    .from("formulas")
    .select("id")
    .eq("owner_id", userId)
    .eq("patient_id", patientId)
    .eq("medication_name", scenario.formula.medication_name)
    .eq("name", scenario.formula.name)
    .maybeSingle();

  if (existingError) throw existingError;

  const payload = {
    owner_id: userId,
    patient_id: patientId,
    ...scenario.formula,
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("formulas")
      .update(payload)
      .eq("id", existing.id)
      .eq("owner_id", userId);

    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("formulas")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data?.id) throw error ?? new Error("Failed to create formula.");
  return data.id;
}

async function upsertInventoryLot(userId, lot) {
  const { data: existing, error: existingError } = await supabase
    .from("inventory_lots")
    .select("id")
    .eq("owner_id", userId)
    .eq("lot_number", lot.lot_number)
    .maybeSingle();

  if (existingError) throw existingError;

  const payload = {
    owner_id: userId,
    ...lot,
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("inventory_lots")
      .update(payload)
      .eq("id", existing.id)
      .eq("owner_id", userId);

    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("inventory_lots")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data?.id) throw error ?? new Error("Failed to create inventory lot.");
  return data.id;
}

async function ensureScenarioPrescriptionDoesNotExist(userId, scenario) {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("owner_id", userId)
    .eq("notes", scenario.prescription.notes)
    .limit(1);

  if (error) throw error;
  if ((data ?? []).length > 0) {
    throw new Error(
      `Scenario "${scenario.key}" already exists for this account. Use a fresh account for a clean demo run.`,
    );
  }
}

async function createPrescription(userId, patientId, scenario, dueOffsetMinutes) {
  const dueAt = new Date(Date.now() + dueOffsetMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("prescriptions")
    .insert({
      owner_id: userId,
      patient_id: patientId,
      ...scenario.prescription,
      due_at: dueAt,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw error ?? new Error("Failed to create prescription.");
  return data.id;
}

async function getJobsForPrescriptions(userId, prescriptionIds) {
  const { data, error } = await supabase
    .from("compounding_jobs")
    .select("id, prescription_id, status")
    .eq("owner_id", userId)
    .in("prescription_id", prescriptionIds);

  if (error) throw error;
  return data ?? [];
}

async function main() {
  const { email } = parseArgs(process.argv.slice(2));
  const usersByEmail = await listUsersByEmail();
  const user = usersByEmail.get(email);

  if (!user?.id) {
    throw new Error(
      `User not found for ${email}. If this is a Google-only account, sign in once in the app first, then rerun this script.`,
    );
  }

  for (const scenario of SCENARIOS) {
    await ensureScenarioPrescriptionDoesNotExist(user.id, scenario);
  }

  const createdPrescriptionIds = [];

  for (const [index, scenario] of SCENARIOS.entries()) {
    const patientId = await getOrCreatePatient(user.id, scenario);
    await upsertFormula(user.id, patientId, scenario);

    for (const lot of scenario.inventory) {
      await upsertInventoryLot(user.id, lot);
    }

    const prescriptionId = await createPrescription(
      user.id,
      patientId,
      scenario,
      10 + index * 15,
    );
    createdPrescriptionIds.push(prescriptionId);
  }

  const jobs = await getJobsForPrescriptions(user.id, createdPrescriptionIds);

  console.log(`Target account: ${email}`);
  console.log("Created deterministic pipeline demo cases:");
  console.log("  - DemoVerified Patient / Omeprazole -> expected VERIFIED");
  console.log("  - DemoFailing Patient / Omeprazole -> expected NEEDS_REVIEW");
  console.log("Expected failing checks: doseRange, inventoryAvailability");
  console.log(`Prescriptions created: ${createdPrescriptionIds.length}`);
  console.log(`Jobs created: ${jobs.length}`);
  for (const job of jobs) {
    console.log(`  - job ${job.id} for prescription ${job.prescription_id} status ${job.status}`);
  }
}

main().catch((error) => {
  console.error("Failed to seed pipeline demo cases:");
  console.error(error);
  process.exit(1);
});
