#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "DemoPass!2026";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const demoUsers = [
  { email: "demo.chris.p@medivance-demo.local", fullName: "Chris P" },
  { email: "demo.kerri.c@medivance-demo.local", fullName: "Kerri C" },
  { email: "demo.mallorie.t@medivance-demo.local", fullName: "Mallorie T" },
  { email: "demo.taishi.n@medivance-demo.local", fullName: "Taishi N" },
  { email: "demo.alex.rivera@medivance-demo.local", fullName: "Alex Rivera" },
  { email: "demo.jordan.lee@medivance-demo.local", fullName: "Jordan Lee" },
  { email: "demo.sam.patel@medivance-demo.local", fullName: "Sam Patel" },
  { email: "demo.priya.khan@medivance-demo.local", fullName: "Priya Khan" },
];

const medications = [
  {
    medicationName: "Omeprazole",
    indication: "GERD",
    route: "PO",
    doseMgPerKg: 1.0,
    frequencyPerDay: 2,
    strengthMgPerMl: 2,
    dispenseVolumeMl: 150,
    notes: "Take before breakfast and dinner.",
    dueOffsetHours: 0,
  },
  {
    medicationName: "Baclofen",
    indication: "Spasticity",
    route: "PO",
    doseMgPerKg: 0.35,
    frequencyPerDay: 3,
    strengthMgPerMl: 10,
    dispenseVolumeMl: 120,
    notes: "Titrate to response.",
    dueOffsetHours: 4,
  },
  {
    medicationName: "Clonidine",
    indication: "Hypertension",
    route: "PO",
    doseMgPerKg: 0.01,
    frequencyPerDay: 2,
    strengthMgPerMl: 0.1,
    dispenseVolumeMl: 90,
    notes: "Monitor BP and heart rate.",
    dueOffsetHours: 6,
  },
];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function splitName(fullName) {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: firstName || "Demo",
    lastName: rest.join(" ") || "User",
  };
}

async function listExistingUsersByEmail() {
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

async function ensureAuthUser(entry, usersByEmail) {
  const emailKey = entry.email.toLowerCase();
  const existing = usersByEmail.get(emailKey);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_USER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: entry.fullName,
      },
      app_metadata: {
        ...(existing.app_metadata ?? {}),
        demo: true,
      },
    });

    if (error) throw error;
    return { id: existing.id, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: entry.email,
    password: DEMO_USER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: entry.fullName,
    },
    app_metadata: {
      demo: true,
    },
  });

  if (error) throw error;
  if (!data?.user?.id) throw new Error(`User creation succeeded without id for ${entry.email}`);

  usersByEmail.set(emailKey, data.user);
  return { id: data.user.id, created: true };
}

async function ensureDemoDomainData(userId, fullName) {
  const targetPatientCount = 10;
  const { count, error: countError } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (countError) throw countError;

  const existingCount = count ?? 0;
  if (existingCount >= targetPatientCount) {
    return { seeded: false, patientId: null };
  }

  const { firstName, lastName } = splitName(fullName);
  const patientCountToCreate = targetPatientCount - existingCount;
  const patientRows = Array.from({ length: patientCountToCreate }, (_, index) => ({
    owner_id: userId,
    first_name: `${firstName}${index + 1 + existingCount}`,
    last_name: lastName,
    dob: "1990-01-15",
    weight_kg: 70.5 - (index % 5) * 2.1,
    allergies: index % 4 === 0 ? ["sulfa"] : [],
    notes: `Demo patient record ${index + 1 + existingCount} for ${fullName}`,
  }));

  const { data: patients, error: patientError } = await supabase
    .from("patients")
    .insert(patientRows)
    .select("id");

  if (patientError || !patients?.length) {
    throw patientError ?? new Error(`Failed to seed patient for ${fullName}`);
  }

  const now = Date.now();
  const prescriptions = patients.map((patient, index) => {
    const medication = medications[index % medications.length];
    return {
      owner_id: userId,
      patient_id: patient.id,
      medication_name: medication.medicationName,
      indication: medication.indication,
      route: medication.route,
      dose_mg_per_kg: medication.doseMgPerKg,
      frequency_per_day: medication.frequencyPerDay,
      strength_mg_per_ml: medication.strengthMgPerMl,
      dispense_volume_ml: medication.dispenseVolumeMl,
      notes: medication.notes,
      due_at: new Date(now + (medication.dueOffsetHours + index) * 60 * 60 * 1000).toISOString(),
    };
  });

  const { error: prescriptionError } = await supabase
    .from("prescriptions")
    .insert(prescriptions);

  if (prescriptionError) throw prescriptionError;

  return { seeded: true, patientId: patients[0].id };
}

async function main() {
  console.log(`Seeding ${demoUsers.length} demo users...`);

  const usersByEmail = await listExistingUsersByEmail();

  let createdCount = 0;
  let updatedCount = 0;
  let seededDataCount = 0;

  for (const user of demoUsers) {
    const authResult = await ensureAuthUser(user, usersByEmail);
    if (authResult.created) createdCount += 1;
    else updatedCount += 1;

    const dataResult = await ensureDemoDomainData(authResult.id, user.fullName);
    if (dataResult.seeded) seededDataCount += 1;

    console.log(
      `${user.email} -> auth:${authResult.created ? "created" : "updated"} data:${dataResult.seeded ? "seeded" : "exists"}`,
    );
  }

  console.log("Done.");
  console.log(`Auth users created: ${createdCount}`);
  console.log(`Auth users updated: ${updatedCount}`);
  console.log(`Demo datasets seeded: ${seededDataCount}`);
  console.log(`Demo password: ${DEMO_USER_PASSWORD}`);
}

main().catch((error) => {
  console.error("Failed to seed demo users:");
  console.error(error);
  process.exit(1);
});
