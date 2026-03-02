#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "DemoPass!2026";

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

function parseArgs(argv) {
  const args = {
    sourceEmail: "",
    destinationEmail: "",
    destinationName: "",
    password: DEFAULT_PASSWORD,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--from" && next) {
      args.sourceEmail = next.trim().toLowerCase();
      index += 1;
      continue;
    }
    if (token === "--to" && next) {
      args.destinationEmail = next.trim().toLowerCase();
      index += 1;
      continue;
    }
    if (token === "--name" && next) {
      args.destinationName = next.trim();
      index += 1;
      continue;
    }
    if (token === "--password" && next) {
      args.password = next;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  if (!args.sourceEmail || !args.destinationEmail) {
    printUsage();
    process.exit(1);
  }

  if (args.sourceEmail === args.destinationEmail) {
    throw new Error("Source and destination emails must be different.");
  }

  return args;
}

function printUsage() {
  console.log(
    "Usage: node scripts/clone-demo-account.mjs --from SOURCE_EMAIL --to DEST_EMAIL [--name \"Dest Name\"] [--password \"DemoPass!2026\"]",
  );
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

async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function ensureDestinationUser({
  destinationEmail,
  destinationName,
  password,
  usersByEmail,
  sourceProfile,
}) {
  const existing = usersByEmail.get(destinationEmail);
  const fullName =
    destinationName || sourceProfile?.full_name || existing?.user_metadata?.full_name || "Demo User";

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: fullName,
      },
      app_metadata: {
        ...(existing.app_metadata ?? {}),
        demo: true,
      },
    });

    if (error) throw error;
    return { id: existing.id, created: false, fullName };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: destinationEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
    app_metadata: {
      demo: true,
    },
  });

  if (error) throw error;
  if (!data?.user?.id) {
    throw new Error(`User creation succeeded without id for ${destinationEmail}`);
  }

  return { id: data.user.id, created: true, fullName };
}

async function ensureDestinationIsEmpty(userId) {
  const tableChecks = [
    ["patients", "owner_id"],
    ["prescriptions", "owner_id"],
    ["formulas", "owner_id"],
    ["inventory_lots", "owner_id"],
    ["compounding_jobs", "owner_id"],
  ];

  for (const [table, ownerColumn] of tableChecks) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(ownerColumn, userId);

    if (error) throw error;
    if ((count ?? 0) > 0) {
      throw new Error(`Destination account already has data in ${table}. Use a fresh account.`);
    }
  }
}

async function upsertProfile(userId, fullName, sourceProfile) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    role: sourceProfile?.role ?? "pharmacist",
  });

  if (error) throw error;
}

async function fetchRows(table, userId, columns) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function clonePatients(sourceUserId, destinationUserId) {
  const sourcePatients = await fetchRows(
    "patients",
    sourceUserId,
    "id, first_name, last_name, dob, weight_kg, bsa_m2, allergies, notes",
  );
  const patientIdMap = new Map();

  for (const patient of sourcePatients) {
    const { data, error } = await supabase
      .from("patients")
      .insert({
        owner_id: destinationUserId,
        first_name: patient.first_name,
        last_name: patient.last_name,
        dob: patient.dob,
        weight_kg: patient.weight_kg,
        bsa_m2: patient.bsa_m2,
        allergies: patient.allergies ?? [],
        notes: patient.notes,
      })
      .select("id")
      .single();

    if (error || !data?.id) throw error ?? new Error("Failed to clone patient.");
    patientIdMap.set(patient.id, data.id);
  }

  return { sourcePatients, patientIdMap };
}

async function clonePrescriptions(sourceUserId, destinationUserId, patientIdMap) {
  const sourcePrescriptions = await fetchRows(
    "prescriptions",
    sourceUserId,
    "patient_id, medication_name, indication, route, dose_mg_per_kg, frequency_per_day, strength_mg_per_ml, dispense_volume_ml, notes, status, due_at",
  );

  for (const prescription of sourcePrescriptions) {
    const mappedPatientId = patientIdMap.get(prescription.patient_id);
    if (!mappedPatientId) {
      throw new Error(`Missing patient mapping for prescription patient ${prescription.patient_id}`);
    }

    const { error } = await supabase.from("prescriptions").insert({
      owner_id: destinationUserId,
      patient_id: mappedPatientId,
      medication_name: prescription.medication_name,
      indication: prescription.indication,
      route: prescription.route,
      dose_mg_per_kg: prescription.dose_mg_per_kg,
      frequency_per_day: prescription.frequency_per_day,
      strength_mg_per_ml: prescription.strength_mg_per_ml,
      dispense_volume_ml: prescription.dispense_volume_ml,
      notes: prescription.notes,
      status: prescription.status ?? "queued",
      due_at: prescription.due_at,
    });

    if (error) throw error;
  }

  return sourcePrescriptions.length;
}

async function cloneFormulas(sourceUserId, destinationUserId, patientIdMap) {
  const sourceFormulas = await fetchRows(
    "formulas",
    sourceUserId,
    "patient_id, medication_name, name, source, ingredient_profile, safety_profile, instructions, is_active",
  );

  for (const formula of sourceFormulas) {
    const mappedPatientId = formula.patient_id ? patientIdMap.get(formula.patient_id) : null;
    if (formula.patient_id && !mappedPatientId) {
      throw new Error(`Missing patient mapping for formula patient ${formula.patient_id}`);
    }

    const { error } = await supabase.from("formulas").insert({
      owner_id: destinationUserId,
      patient_id: mappedPatientId ?? null,
      medication_name: formula.medication_name,
      name: formula.name,
      source: formula.source,
      ingredient_profile: formula.ingredient_profile,
      safety_profile: formula.safety_profile,
      instructions: formula.instructions,
      is_active: formula.is_active,
    });

    if (error) throw error;
  }

  return sourceFormulas.length;
}

async function cloneInventoryLots(sourceUserId, destinationUserId) {
  const sourceInventory = await fetchRows(
    "inventory_lots",
    sourceUserId,
    "ingredient_name, ndc, lot_number, available_quantity, unit, expires_on",
  );

  for (const lot of sourceInventory) {
    const { error } = await supabase.from("inventory_lots").insert({
      owner_id: destinationUserId,
      ingredient_name: lot.ingredient_name,
      ndc: lot.ndc,
      lot_number: lot.lot_number,
      available_quantity: lot.available_quantity,
      unit: lot.unit,
      expires_on: lot.expires_on,
    });

    if (error) throw error;
  }

  return sourceInventory.length;
}

async function countJobs(userId) {
  const { count, error } = await supabase
    .from("compounding_jobs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const usersByEmail = await listUsersByEmail();
  const sourceUser = usersByEmail.get(args.sourceEmail);

  if (!sourceUser?.id) {
    throw new Error(`Source user not found: ${args.sourceEmail}`);
  }

  const sourceProfile = await getProfile(sourceUser.id);
  const destination = await ensureDestinationUser({
    destinationEmail: args.destinationEmail,
    destinationName: args.destinationName,
    password: args.password,
    usersByEmail,
    sourceProfile,
  });

  await ensureDestinationIsEmpty(destination.id);
  await upsertProfile(destination.id, destination.fullName, sourceProfile);

  const { sourcePatients, patientIdMap } = await clonePatients(sourceUser.id, destination.id);
  const prescriptionCount = await clonePrescriptions(sourceUser.id, destination.id, patientIdMap);
  const formulaCount = await cloneFormulas(sourceUser.id, destination.id, patientIdMap);
  const inventoryLotCount = await cloneInventoryLots(sourceUser.id, destination.id);
  const jobCount = await countJobs(destination.id);

  console.log(`Source account: ${args.sourceEmail}`);
  console.log(`Destination account: ${args.destinationEmail}`);
  console.log(`Destination user: ${destination.created ? "created" : "updated"}`);
  console.log(`Patients cloned: ${sourcePatients.length}`);
  console.log(`Prescriptions cloned: ${prescriptionCount}`);
  console.log(`Formulas cloned: ${formulaCount}`);
  console.log(`Inventory lots cloned: ${inventoryLotCount}`);
  console.log(`Fresh jobs created: ${jobCount}`);
  console.log(`Destination password: ${args.password}`);
}

main().catch((error) => {
  console.error("Failed to clone demo account:");
  console.error(error);
  process.exit(1);
});
