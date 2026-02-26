import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type {
  FormulaSource,
  FormulaSafetyProfile,
  Ingredient,
  JobStatus,
  SignatureMeaning,
} from "@/lib/medivance/types";
import type { InventoryLotSnapshot } from "@/lib/medivance/safety";

type JsonRecord = Record<string, unknown>;

function asArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function asRecord(value: unknown, fallback: JsonRecord = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  return value as JsonRecord;
}

function asNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asPositiveNumberOptional(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric;
}

function asNumberMap(value: unknown): Record<string, number> {
  const source = asRecord(value, {});
  const entries = Object.entries(source).flatMap(([key, raw]) => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return [];
    return [[key, numeric] as const];
  });
  return Object.fromEntries(entries);
}

function toDateKeyInTimezone(value: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  }
}

export interface QueueItem {
  jobId: string;
  status: JobStatus;
  priority: number;
  iterationCount: number;
  lastError: string | null;
  createdAt: string;
  medicationName: string;
  route: string;
  dueAt: string;
  patientId: string;
  patientName: string;
}

export interface ResolvedFormula {
  id: string;
  source: FormulaSource;
  name: string;
  medicationName: string;
  ingredients: Ingredient[];
  safetyProfile: FormulaSafetyProfile;
  instructions: string;
  budRule: { category: "aqueous" | "non_aqueous"; hasStabilityData: boolean; stabilityDays?: number };
  equipment: string[];
  qualityControl: string[];
  containerClosure: string | null;
  labelingRequirements: string | null;
  budRationale: string | null;
  references: Array<Record<string, unknown>>;
}

export interface JobContext {
  job: {
    id: string;
    status: JobStatus;
    iterationCount: number;
    priority: number;
    lastError: string | null;
    pharmacistFeedback: string | null;
    formulaId: string | null;
  };
  prescription: {
    id: string;
    patientId: string;
    medicationName: string;
    route: string;
    doseMgPerKg: number;
    frequencyPerDay: number;
    strengthMgPerMl: number;
    dispenseVolumeMl: number;
    indication: string | null;
    notes: string | null;
    dueAt: string;
  };
  patient: {
    id: string;
    fullName: string;
    dob: string | null;
    weightKg: number;
    allergies: string[];
    currentMedications: string[];
    notes: string | null;
  };
}

export interface CalculationReportRow {
  id: string;
  version: number;
  overallStatus: string;
  report: JsonRecord;
  hardChecks: JsonRecord;
  aiReview: JsonRecord;
  createdAt: string;
}

export interface FeedbackRow {
  id: string;
  decision: string;
  feedback: string;
  createdAt: string;
}

export interface FinalOutputRow {
  id: string;
  approvedAt: string;
  signerName: string;
  signerEmail: string;
  signatureMeaning: SignatureMeaning;
  signatureStatement: string;
  signatureHash: string;
  finalReport: JsonRecord;
  labelPayload: JsonRecord;
}

export interface AuditEventRow {
  id: string;
  eventType: string;
  eventPayload: JsonRecord;
  createdAt: string;
}

const DEMO_PATIENTS = [
  {
    firstName: "Avery",
    lastName: "Lopez",
    dob: "1991-05-14",
    weightKg: 68.2,
    allergies: ["sulfa"],
    notes: "Prefers grape-flavored suspension.",
  },
  {
    firstName: "Noah",
    lastName: "Kim",
    dob: "1987-08-20",
    weightKg: 79.4,
    allergies: [],
    notes: "Needs flavor masking for better adherence.",
  },
  {
    firstName: "Mia",
    lastName: "Patel",
    dob: "1994-01-11",
    weightKg: 62.7,
    allergies: ["penicillin"],
    notes: "Requests oral syringe calibration notes.",
  },
  {
    firstName: "Ethan",
    lastName: "Reed",
    dob: "1985-09-03",
    weightKg: 84.6,
    allergies: [],
    notes: "Swallowing difficulty; prefers suspension over tablets.",
  },
  {
    firstName: "Sophia",
    lastName: "Nguyen",
    dob: "1990-03-28",
    weightKg: 64.5,
    allergies: ["lactose"],
    notes: "Use lactose-free excipient profile when possible.",
  },
  {
    firstName: "Liam",
    lastName: "Garcia",
    dob: "1983-12-10",
    weightKg: 88.1,
    allergies: [],
    notes: "Monitor for daytime sedation effects.",
  },
  {
    firstName: "Isabella",
    lastName: "Brooks",
    dob: "1996-04-06",
    weightKg: 59.8,
    allergies: ["sulfites"],
    notes: "Document preservative-free options in counseling notes.",
  },
  {
    firstName: "Lucas",
    lastName: "Hayes",
    dob: "1988-11-22",
    weightKg: 91.3,
    allergies: [],
    notes: "Prefers BID schedule when clinically appropriate.",
  },
  {
    firstName: "Amelia",
    lastName: "Turner",
    dob: "1993-07-17",
    weightKg: 66.9,
    allergies: ["sulfa"],
    notes: "Previous rash with sulfonamide-containing products.",
  },
  {
    firstName: "James",
    lastName: "Chen",
    dob: "1989-02-26",
    weightKg: 81.7,
    allergies: [],
    notes: "Requests larger-print auxiliary labels.",
  },
] as const;

const DEMO_MEDICATION_PROFILES = [
  {
    medicationName: "Omeprazole",
    indication: "GERD",
    route: "PO",
    doseMgPerKg: 0.4,
    frequencyPerDay: 2,
    strengthMgPerMl: 2,
    dispenseVolumeMl: 150,
    notes: "Take before breakfast and dinner.",
  },
  {
    medicationName: "Baclofen",
    indication: "Spasticity",
    route: "PO",
    doseMgPerKg: 0.15,
    frequencyPerDay: 3,
    strengthMgPerMl: 10,
    dispenseVolumeMl: 120,
    notes: "Titrate to response.",
  },
  {
    medicationName: "Gabapentin",
    indication: "Neuropathic Pain",
    route: "PO",
    doseMgPerKg: 3,
    frequencyPerDay: 3,
    strengthMgPerMl: 50,
    dispenseVolumeMl: 180,
    notes: "May cause dizziness; monitor sedation.",
  },
  {
    medicationName: "Spironolactone",
    indication: "Heart Failure",
    route: "PO",
    doseMgPerKg: 0.5,
    frequencyPerDay: 2,
    strengthMgPerMl: 5,
    dispenseVolumeMl: 120,
    notes: "Monitor potassium and renal function.",
  },
  {
    medicationName: "Hydrochlorothiazide",
    indication: "Hypertension",
    route: "PO",
    doseMgPerKg: 0.25,
    frequencyPerDay: 2,
    strengthMgPerMl: 5,
    dispenseVolumeMl: 120,
    notes: "Give earlier in the day to reduce nocturia.",
  },
  {
    medicationName: "Sildenafil",
    indication: "Pulmonary Hypertension",
    route: "PO",
    doseMgPerKg: 0.5,
    frequencyPerDay: 3,
    strengthMgPerMl: 2.5,
    dispenseVolumeMl: 150,
    notes: "Monitor blood pressure and headache symptoms.",
  },
  {
    medicationName: "Naltrexone",
    indication: "Chronic Pain (LDN)",
    route: "PO",
    doseMgPerKg: 0.06,
    frequencyPerDay: 1,
    strengthMgPerMl: 1,
    dispenseVolumeMl: 60,
    notes: "Administer at bedtime when tolerated.",
  },
  {
    medicationName: "Levothyroxine",
    indication: "Hypothyroidism",
    route: "PO",
    doseMgPerKg: 0.0016,
    frequencyPerDay: 1,
    strengthMgPerMl: 0.025,
    dispenseVolumeMl: 90,
    notes: "Take on an empty stomach, separated from minerals.",
  },
] as const;

export async function ensureDemoData(
  supabase: SupabaseClient,
  userId: string,
) {
  const targetDemoPatientCount = DEMO_PATIENTS.length;
  const { count, error: countError } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (countError) throw countError;
  const existingPatientCount = count ?? 0;
  if (existingPatientCount >= targetDemoPatientCount) return;

  const patientsToSeed = DEMO_PATIENTS.slice(existingPatientCount, targetDemoPatientCount);

  const { data: seededPatients, error: patientError } = await supabase
    .from("patients")
    .insert(
      patientsToSeed.map((patient) => ({
        owner_id: userId,
        first_name: patient.firstName,
        last_name: patient.lastName,
        dob: patient.dob,
        weight_kg: patient.weightKg,
        allergies: patient.allergies,
        notes: patient.notes,
      })),
    )
    .select("id, first_name");

  if (patientError || !seededPatients?.length) {
    throw patientError ?? new Error("Failed to seed demo patients.");
  }
  if (existingPatientCount === 0) {
    const primaryPatientId = asString(seededPatients[0]?.id);
    const primaryPatientFirstName = asString(seededPatients[0]?.first_name, "Demo");

    const companyFormula = {
      owner_id: userId,
      patient_id: null,
      medication_name: "Baclofen",
      name: "Baclofen 10 mg/mL Oral Suspension",
      source: "company",
      ingredient_profile: [
        {
          name: "Baclofen",
          role: "api",
          quantity: 1,
          unit: "g",
          concentrationMgPerMl: 10,
        },
        {
          name: "Ora-Blend",
          role: "vehicle",
          quantity: 0,
          unit: "mL",
        },
      ],
      safety_profile: {
        minSingleDoseMg: 2,
        maxSingleDoseMg: 30,
        maxDailyDoseMg: 90,
        incompatibilities: [["baclofen", "ethanol"]],
        budRule: {
          category: "aqueous",
          hasStabilityData: false,
        },
      },
      instructions:
        "Triturate baclofen to a fine powder, wet with glycerin, and qs with Ora-Blend.",
      equipment: ["Class A balance", "Mortar and pestle", "Graduated cylinder"],
      quality_control: ["Appearance check", "Volume verification", "Label verification"],
      container_closure: "Amber PET bottle with child-resistant cap.",
      labeling_requirements: "Shake well. Refrigerate. Keep out of reach of children.",
      bud_rationale:
        "Default USP <795> aqueous BUD applied due to no supporting stability study.",
      reference_sources: [
        { source: "internal", detail: "MFR-BCF-10-PO" },
        { source: "usp", detail: "<795> default nonsterile guidance" },
      ],
    };

    const patientSpecificFormula = {
      owner_id: userId,
      patient_id: primaryPatientId,
      medication_name: "Omeprazole",
      name: `${primaryPatientFirstName} Omeprazole 2 mg/mL Custom`,
      source: "patient",
      ingredient_profile: [
        {
          name: "Omeprazole",
          role: "api",
          quantity: 0.5,
          unit: "g",
          concentrationMgPerMl: 2,
        },
        {
          name: "Sodium Bicarbonate Vehicle",
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
        "Suspend omeprazole powder in sodium bicarbonate vehicle. Protect from light.",
      equipment: ["Class A balance", "Mortar and pestle", "Amber bottle"],
      quality_control: ["Visual check for clumping", "pH spot check", "Final volume verification"],
      container_closure: "Amber oral suspension bottle.",
      labeling_requirements: "Shake well. Refrigerate. Discard after BUD.",
      bud_rationale:
        "Patient-specific nonsterile aqueous preparation with no additional stability data.",
      reference_sources: [
        { source: "internal", detail: "MFR-OME-2-PO-AVERY" },
        { source: "literature", detail: "Omeprazole bicarbonate suspension pediatric practice notes" },
      ],
    };

    const { error: formulaError } = await supabase
      .from("formulas")
      .insert([companyFormula, patientSpecificFormula]);
    if (formulaError) throw formulaError;

    const apiInventoryLots = DEMO_MEDICATION_PROFILES.map((profile, index) => ({
      owner_id: userId,
      ingredient_name: profile.medicationName,
      lot_number: `API-${index + 1}`.padEnd(8, "0"),
      available_quantity: 20,
      unit: "g",
      expires_on: "2027-12-31",
    }));

    const { error: inventoryError } = await supabase.from("inventory_lots").insert([
      {
        owner_id: userId,
        ingredient_name: "Ora-Blend",
        lot_number: "ORB-3421",
        available_quantity: 2100,
        unit: "mL",
        expires_on: "2026-11-30",
      },
      {
        owner_id: userId,
        ingredient_name: "Sodium Bicarbonate Vehicle",
        lot_number: "SBV-1021",
        available_quantity: 1100,
        unit: "mL",
        expires_on: "2026-08-10",
      },
      ...apiInventoryLots,
    ]);
    if (inventoryError) throw inventoryError;
  }

  const prescriptions = seededPatients.map((seededPatient, index) => {
    const profile = DEMO_MEDICATION_PROFILES[index % DEMO_MEDICATION_PROFILES.length];
    return {
      owner_id: userId,
      patient_id: asString(seededPatient.id),
      medication_name: profile.medicationName,
      indication: profile.indication,
      route: profile.route,
      dose_mg_per_kg: profile.doseMgPerKg,
      frequency_per_day: profile.frequencyPerDay,
      strength_mg_per_ml: profile.strengthMgPerMl,
      dispense_volume_ml: profile.dispenseVolumeMl,
      notes: profile.notes,
      due_at: new Date(Date.now() + index * 15 * 60 * 1000).toISOString(),
    };
  });

  const { error: prescriptionError } = await supabase
    .from("prescriptions")
    .insert(prescriptions);
  if (prescriptionError) throw prescriptionError;
}

export async function syncDemoPatientDemographicsOnLogin(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("owner_id", userId);
  if (error) throw error;

  const demoMap = new Map(
    DEMO_PATIENTS.map((patient) => [
      `${patient.firstName.toLowerCase()}::${patient.lastName.toLowerCase()}`,
      patient,
    ]),
  );

  const updates: Array<PromiseLike<{ error: unknown }>> = [];
  for (const row of data ?? []) {
    const firstName = asString(row.first_name);
    const lastName = asString(row.last_name);
    const demo = demoMap.get(`${firstName.toLowerCase()}::${lastName.toLowerCase()}`);
    if (!demo) continue;
    const patientId = asString(row.id);
    if (!patientId) continue;
    updates.push(
      supabase
        .from("patients")
        .update({
          dob: demo.dob,
          weight_kg: demo.weightKg,
        })
        .eq("id", patientId)
        .eq("owner_id", userId),
    );
  }

  if (!updates.length) return;

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function syncDemoPrescriptionProfilesOnLogin(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("id, patient_id, patients!inner(first_name, last_name)")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const demoNames = new Set(
    DEMO_PATIENTS.map(
      (patient) => `${patient.firstName.toLowerCase()}::${patient.lastName.toLowerCase()}`,
    ),
  );

  const demoPrescriptions = (data ?? []).filter((row: Record<string, unknown>) => {
    const patient = asRecord(row.patients);
    const key = `${asString(patient.first_name).toLowerCase()}::${asString(
      patient.last_name,
    ).toLowerCase()}`;
    return demoNames.has(key);
  });

  if (!demoPrescriptions.length) return;

  const updates: Array<PromiseLike<{ error: unknown }>> = [];
  for (const [index, row] of demoPrescriptions.entries()) {
    const profile = DEMO_MEDICATION_PROFILES[index % DEMO_MEDICATION_PROFILES.length];
    const prescriptionId = asString(row.id);
    if (!prescriptionId) continue;
    updates.push(
      supabase
        .from("prescriptions")
        .update({
          medication_name: profile.medicationName,
          indication: profile.indication,
          route: profile.route,
          dose_mg_per_kg: profile.doseMgPerKg,
          frequency_per_day: profile.frequencyPerDay,
          strength_mg_per_ml: profile.strengthMgPerMl,
          dispense_volume_ml: profile.dispenseVolumeMl,
          notes: profile.notes,
        })
        .eq("id", prescriptionId)
        .eq("owner_id", userId),
    );
  }

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function getQueueItems(
  supabase: SupabaseClient,
  userId: string,
  options?: { includeAll?: boolean },
) {
  const { data, error } = await supabase
    .from("compounding_jobs")
    .select(
      `
      id,
      status,
      priority,
      iteration_count,
      last_error,
      created_at,
      prescriptions!inner (
        id,
        medication_name,
        route,
        due_at,
        patient_id,
        patients!inner (
          id,
          first_name,
          last_name
        )
      )
    `,
    )
    .eq("owner_id", userId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  const includeAll = options?.includeAll ?? false;
  const todayDateKey = toDateKeyInTimezone(new Date(), env.queueTimezone);

  const mappedItems = (data ?? [])
    .map((row: Record<string, unknown>) => {
      const prescription = asRecord(row.prescriptions);
      const patient = asRecord(prescription.patients);
      const firstName = asString(patient.first_name, "Unknown");
      const lastName = asString(patient.last_name, "Patient");
      const dueAt = asString(prescription.due_at);

      return {
        jobId: asString(row.id),
        status: asString(row.status, "queued") as JobStatus,
        priority: asNumber(row.priority, 2),
        iterationCount: asNumber(row.iteration_count, 0),
        lastError: row.last_error ? asString(row.last_error) : null,
        createdAt: asString(row.created_at),
        medicationName: asString(prescription.medication_name, "Unknown"),
        route: asString(prescription.route, "PO"),
        dueAt,
        patientId: asString(prescription.patient_id),
        patientName: `${firstName} ${lastName}`,
      } satisfies QueueItem;
    });

  if (includeAll) return mappedItems;

  return mappedItems.filter((item) => {
    if (!item.dueAt) return false;
    return toDateKeyInTimezone(new Date(item.dueAt), env.queueTimezone) === todayDateKey;
  });
}

export async function refreshQueueDueDatesOnLogin(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("compounding_jobs")
    .select(
      `
      id,
      status,
      prescriptions!inner (
        id,
        created_at
      )
    `,
    )
    .eq("owner_id", userId);

  if (error) throw error;

  const activeRows = (data ?? [])
    .filter((row: Record<string, unknown>) => {
      const status = asString(row.status, "queued");
      return status !== "approved" && status !== "rejected";
    })
    .map((row: Record<string, unknown>) => {
      const prescription = asRecord(row.prescriptions);
      return {
        prescriptionId: asString(prescription.id),
        createdAt: asString(prescription.created_at),
      };
    })
    .filter((row) => row.prescriptionId.length > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (!activeRows.length) return;

  const nowMs = Date.now();
  const updates = activeRows.map((row, index) => {
    const dueAt =
      index < 3
        ? new Date(nowMs + (index * 15 + 5) * 60 * 1000).toISOString()
        : new Date(nowMs + (index - 2) * 24 * 60 * 60 * 1000).toISOString();

    return supabase
      .from("prescriptions")
      .update({ due_at: dueAt })
      .eq("id", row.prescriptionId)
      .eq("owner_id", userId);
  });

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function getJobContext(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("compounding_jobs")
    .select(
      `
      id,
      status,
      priority,
      iteration_count,
      last_error,
      pharmacist_feedback,
      formula_id,
      prescriptions!inner (
        id,
        patient_id,
        medication_name,
        route,
        dose_mg_per_kg,
        frequency_per_day,
        strength_mg_per_ml,
        dispense_volume_ml,
        indication,
        notes,
        due_at,
        patients!inner (
          id,
          first_name,
          last_name,
          dob,
          weight_kg,
          allergies,
          notes
        )
      )
    `,
    )
    .eq("owner_id", userId)
    .eq("id", jobId)
    .single();

  if (error || !data) throw error ?? new Error("Job not found.");

  const rowData = asRecord(data);
  const prescription = asRecord(rowData.prescriptions);
  const patient = asRecord(prescription.patients);
  const patientId = asString(prescription.patient_id);
  const prescriptionId = asString(prescription.id);

  const { data: concurrentMedicationRows, error: concurrentMedicationError } = await supabase
    .from("prescriptions")
    .select("medication_name")
    .eq("owner_id", userId)
    .eq("patient_id", patientId)
    .neq("id", prescriptionId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (concurrentMedicationError) throw concurrentMedicationError;
  const currentMedications = Array.from(
    new Set(
      (concurrentMedicationRows ?? [])
        .map((row: Record<string, unknown>) => asString(row.medication_name).trim())
        .filter((medicationName) => medicationName.length > 0),
    ),
  );

  return {
    job: {
      id: asString(data.id),
      status: asString(data.status, "queued") as JobStatus,
      iterationCount: asNumber(data.iteration_count, 0),
      priority: asNumber(data.priority, 2),
      lastError: data.last_error ? asString(data.last_error) : null,
      pharmacistFeedback: data.pharmacist_feedback
        ? asString(data.pharmacist_feedback)
        : null,
      formulaId: data.formula_id ? asString(data.formula_id) : null,
    },
    prescription: {
      id: asString(prescription.id),
      patientId: asString(prescription.patient_id),
      medicationName: asString(prescription.medication_name),
      route: asString(prescription.route),
      doseMgPerKg: asNumber(prescription.dose_mg_per_kg, 0),
      frequencyPerDay: asNumber(prescription.frequency_per_day, 0),
      strengthMgPerMl: asNumber(prescription.strength_mg_per_ml, 0),
      dispenseVolumeMl: asNumber(prescription.dispense_volume_ml, 0),
      indication: prescription.indication ? asString(prescription.indication) : null,
      notes: prescription.notes ? asString(prescription.notes) : null,
      dueAt: asString(prescription.due_at),
    },
    patient: {
      id: asString(patient.id),
      fullName: `${asString(patient.first_name)} ${asString(patient.last_name)}`,
      dob: patient.dob ? asString(patient.dob) : null,
      weightKg: asNumber(patient.weight_kg, 0),
      allergies: asArray<string>(patient.allergies, []),
      currentMedications,
      notes: patient.notes ? asString(patient.notes) : null,
    },
  } satisfies JobContext;
}

function parseFormulaRow(rowValue: unknown): ResolvedFormula {
  const row = asRecord(rowValue);
  const safetyRecord = asRecord(row.safety_profile, {});
  const budCandidate = asRecord(safetyRecord.budRule, {});
  const category = asString(budCandidate.category, "aqueous");
  const references = asArray<Record<string, unknown>>(row.reference_sources, []);

  return {
    id: asString(row.id),
    source: asString(row.source, "generated") as FormulaSource,
    name: asString(row.name, "Unnamed Formula"),
    medicationName: asString(row.medication_name),
    ingredients: asArray<Ingredient>(row.ingredient_profile, []),
    safetyProfile: {
      minSingleDoseMg: asNumber(safetyRecord.minSingleDoseMg, 0),
      maxSingleDoseMg: asNumber(safetyRecord.maxSingleDoseMg, 1000),
      maxDailyDoseMg: asNumber(safetyRecord.maxDailyDoseMg, 4000),
      contraindicatedIngredients: asArray<string>(
        safetyRecord.contraindicatedIngredients,
        [],
      ),
      incompatibilities: asArray<string[]>(safetyRecord.incompatibilities, []),
      lowStockWarningMultiplier: asPositiveNumberOptional(
        safetyRecord.lowStockWarningMultiplier,
      ),
      lowStockWarningMultiplierByIngredient: asNumberMap(
        safetyRecord.lowStockWarningMultiplierByIngredient,
      ),
    },
    instructions: asString(row.instructions),
    budRule: {
      category: category === "non_aqueous" ? "non_aqueous" : "aqueous",
      hasStabilityData: Boolean(budCandidate.hasStabilityData),
      stabilityDays:
        budCandidate.stabilityDays !== undefined
          ? asNumber(budCandidate.stabilityDays, 14)
          : undefined,
    },
    equipment: asArray<string>(row.equipment, []),
    qualityControl: asArray<string>(row.quality_control, []),
    containerClosure: row.container_closure ? asString(row.container_closure) : null,
    labelingRequirements: row.labeling_requirements
      ? asString(row.labeling_requirements)
      : null,
    budRationale: row.bud_rationale ? asString(row.bud_rationale) : null,
    references,
  };
}

async function queryFormulaByPriority(
  supabase: SupabaseClient,
  userId: string,
  params: {
    medicationName: string;
    patientId?: string;
    source?: FormulaSource;
  },
) {
  let query = supabase
    .from("formulas")
    .select("*")
    .eq("owner_id", userId)
    .eq("medication_name", params.medicationName)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  if (params.patientId) {
    query = query.eq("patient_id", params.patientId);
  }

  if (!params.patientId) {
    query = query.is("patient_id", null);
  }

  if (params.source) {
    query = query.eq("source", params.source);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function resolveFormulaForPrescription(
  supabase: SupabaseClient,
  userId: string,
  context: JobContext,
) {
  const patientSpecific = await queryFormulaByPriority(supabase, userId, {
    medicationName: context.prescription.medicationName,
    patientId: context.patient.id,
  });
  if (patientSpecific) return parseFormulaRow(patientSpecific);

  const company = await queryFormulaByPriority(supabase, userId, {
    medicationName: context.prescription.medicationName,
    source: "company",
  });
  if (company) return parseFormulaRow(company);

  const generatedPayload = {
    owner_id: userId,
    patient_id: null,
    medication_name: context.prescription.medicationName,
    name: `${context.prescription.medicationName} Auto-Generated Formula`,
    source: "generated",
    ingredient_profile: [
      {
        name: context.prescription.medicationName,
        role: "api",
        quantity: 1,
        unit: "g",
        concentrationMgPerMl: context.prescription.strengthMgPerMl,
      },
      {
        name: "Ora-Blend",
        role: "vehicle",
        quantity: 0,
        unit: "mL",
      },
    ],
    safety_profile: {
      minSingleDoseMg: 0.5,
      maxSingleDoseMg: 50,
      maxDailyDoseMg: 150,
      budRule: {
        category: "aqueous",
        hasStabilityData: false,
      },
    },
    instructions:
      "Generated formula pending pharmacist validation. Triturate API and qs with vehicle.",
    equipment: ["Class A balance", "Mortar and pestle", "Graduated cylinder"],
    quality_control: ["Appearance check", "Final volume check", "Label check"],
    container_closure: "Amber bottle with child-resistant cap.",
    labeling_requirements: "Shake well before use. Store as directed on final label.",
    bud_rationale:
      "Generated formula defaults to USP <795> aqueous baseline pending pharmacist validation.",
    reference_sources: [
      {
        source: "system",
        detail: "Auto-generated fallback MFR template",
      },
    ],
  };

  const { data, error } = await supabase
    .from("formulas")
    .insert(generatedPayload)
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Failed to generate formula.");
  return parseFormulaRow(data);
}

export async function getInventoryForIngredients(
  supabase: SupabaseClient,
  userId: string,
  ingredientNames: string[],
) {
  if (!ingredientNames.length) return [];

  const { data, error } = await supabase
    .from("inventory_lots")
    .select("ingredient_name, available_quantity, unit, expires_on, lot_number")
    .eq("owner_id", userId)
    .in("ingredient_name", ingredientNames);

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    return {
      ingredientName: asString(row.ingredient_name),
      availableQuantity: asNumber(row.available_quantity, 0),
      unit: asString(row.unit, "mg"),
      expiresOn: asString(row.expires_on),
      lotNumber: asString(row.lot_number),
    } satisfies InventoryLotSnapshot;
  });
}

export async function updateJobState(
  supabase: SupabaseClient,
  params: {
    jobId: string;
    status?: JobStatus;
    formulaId?: string | null;
    iterationCount?: number;
    lastError?: string | null;
    pharmacistFeedback?: string | null;
    completed?: boolean;
  },
) {
  const payload: Record<string, unknown> = {};
  if (params.status) payload.status = params.status;
  if (params.formulaId !== undefined) payload.formula_id = params.formulaId;
  if (params.iterationCount !== undefined) payload.iteration_count = params.iterationCount;
  if (params.lastError !== undefined) payload.last_error = params.lastError;
  if (params.pharmacistFeedback !== undefined) {
    payload.pharmacist_feedback = params.pharmacistFeedback;
  }
  if (params.completed) {
    payload.completed_at = new Date().toISOString();
  }
  payload.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("compounding_jobs")
    .update(payload)
    .eq("id", params.jobId);
  if (error) throw error;
}

export async function insertCalculationReport(
  supabase: SupabaseClient,
  params: {
    ownerId: string;
    jobId: string;
    version: number;
    context: JsonRecord;
    report: JsonRecord;
    hardChecks: JsonRecord;
    aiReview: JsonRecord;
    overallStatus: string;
    isFinal?: boolean;
  },
) {
  const { data, error } = await supabase
    .from("calculation_reports")
    .insert({
      owner_id: params.ownerId,
      job_id: params.jobId,
      version: params.version,
      context: params.context,
      report: params.report,
      hard_checks: params.hardChecks,
      ai_review: params.aiReview,
      overall_status: params.overallStatus,
      is_final: Boolean(params.isFinal),
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("Failed to insert report.");
  return asString(data.id);
}

export async function getLatestReportVersion(
  supabase: SupabaseClient,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("calculation_reports")
    .select("version")
    .eq("job_id", jobId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? asNumber(data.version, 0) : 0;
}

export async function writeAuditEvent(
  supabase: SupabaseClient,
  params: {
    ownerId: string;
    jobId?: string | null;
    eventType: string;
    eventPayload: JsonRecord;
  },
) {
  const { error } = await supabase.from("audit_events").insert({
    owner_id: params.ownerId,
    job_id: params.jobId ?? null,
    event_type: params.eventType,
    event_payload: params.eventPayload,
  });
  if (error) throw error;
}

export async function saveFinalOutput(
  supabase: SupabaseClient,
  params: {
    ownerId: string;
    jobId: string;
    approvedBy: string;
    signerName: string;
    signerEmail: string;
    signatureMeaning: SignatureMeaning;
    signatureStatement: string;
    signatureHash: string;
    finalReport: JsonRecord;
    labelPayload: JsonRecord;
  },
) {
  const { error } = await supabase.from("final_outputs").insert({
    owner_id: params.ownerId,
    job_id: params.jobId,
    approved_by: params.approvedBy,
    signer_name: params.signerName,
    signer_email: params.signerEmail,
    signature_meaning: params.signatureMeaning,
    signature_statement: params.signatureStatement,
    signature_hash: params.signatureHash,
    final_report: params.finalReport,
    label_payload: params.labelPayload,
    approved_at: new Date().toISOString(),
    locked_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function consumeInventoryForJob(
  supabase: SupabaseClient,
  params: {
    ownerId: string;
    jobId: string;
  },
) {
  const { data, error } = await supabase.rpc("consume_inventory_for_job", {
    p_owner_id: params.ownerId,
    p_job_id: params.jobId,
  });

  if (error) throw error;
  return asRecord(data);
}

export async function insertPharmacistFeedback(
  supabase: SupabaseClient,
  params: {
    ownerId: string;
    jobId: string;
    decision: "request_changes" | "reject" | "approve" | "note";
    feedback: string;
  },
) {
  const { error } = await supabase.from("pharmacist_feedback").insert({
    owner_id: params.ownerId,
    job_id: params.jobId,
    decision: params.decision,
    feedback: params.feedback,
  });
  if (error) throw error;
}

export async function getJobPresentationData(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const [context, reportsResult, feedbackResult, finalOutputResult, auditResult] =
    await Promise.all([
      getJobContext(supabase, userId, jobId),
      supabase
        .from("calculation_reports")
        .select("id, version, overall_status, report, hard_checks, ai_review, created_at")
        .eq("owner_id", userId)
        .eq("job_id", jobId)
        .order("version", { ascending: false }),
      supabase
        .from("pharmacist_feedback")
        .select("id, decision, feedback, created_at")
        .eq("owner_id", userId)
        .eq("job_id", jobId)
        .order("created_at", { ascending: false }),
      supabase
        .from("final_outputs")
        .select(
          "id, approved_at, signer_name, signer_email, signature_meaning, signature_statement, signature_hash, final_report, label_payload",
        )
        .eq("owner_id", userId)
        .eq("job_id", jobId)
        .maybeSingle(),
      supabase
        .from("audit_events")
        .select("id, event_type, event_payload, created_at")
        .eq("owner_id", userId)
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  if (reportsResult.error) throw reportsResult.error;
  if (feedbackResult.error) throw feedbackResult.error;
  if (finalOutputResult.error) throw finalOutputResult.error;
  if (auditResult.error) throw auditResult.error;

  const reports: CalculationReportRow[] = (reportsResult.data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: asString(row.id),
      version: asNumber(row.version, 1),
      overallStatus: asString(row.overall_status),
      report: asRecord(row.report),
      hardChecks: asRecord(row.hard_checks),
      aiReview: asRecord(row.ai_review),
      createdAt: asString(row.created_at),
    }),
  );

  const feedback: FeedbackRow[] = (feedbackResult.data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: asString(row.id),
      decision: asString(row.decision),
      feedback: asString(row.feedback),
      createdAt: asString(row.created_at),
    }),
  );

  const finalOutput: FinalOutputRow | null = finalOutputResult.data
    ? {
        id: asString(finalOutputResult.data.id),
        approvedAt: asString(finalOutputResult.data.approved_at),
        signerName: asString(finalOutputResult.data.signer_name),
        signerEmail: asString(finalOutputResult.data.signer_email),
        signatureMeaning: asString(
          finalOutputResult.data.signature_meaning,
        ) as SignatureMeaning,
        signatureStatement: asString(finalOutputResult.data.signature_statement),
        signatureHash: asString(finalOutputResult.data.signature_hash),
        finalReport: asRecord(finalOutputResult.data.final_report),
        labelPayload: asRecord(finalOutputResult.data.label_payload),
      }
    : null;

  const audit: AuditEventRow[] = (auditResult.data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: asString(row.id),
      eventType: asString(row.event_type),
      eventPayload: asRecord(row.event_payload),
      createdAt: asString(row.created_at),
    }),
  );

  return { context, reports, feedback, finalOutput, audit };
}
