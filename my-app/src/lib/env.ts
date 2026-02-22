function positiveNumberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  disableAuthForDemo: (process.env.MEDIVANCE_DISABLE_AUTH ?? "true").toLowerCase() !== "false",
  demoUserId: process.env.MEDIVANCE_DEMO_USER_ID ?? "",
  demoUserName: process.env.MEDIVANCE_DEMO_USER_NAME ?? "Demo Pharmacist",
  demoUserEmail: process.env.MEDIVANCE_DEMO_USER_EMAIL ?? "demo@medivance.local",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openFdaApiKey: process.env.OPENFDA_API_KEY ?? "",
  rxNavBaseUrl: process.env.RXNAV_BASE_URL ?? "https://rxnav.nlm.nih.gov/REST",
  dailyMedBaseUrl:
    process.env.DAILYMED_BASE_URL ?? "https://dailymed.nlm.nih.gov/dailymed/services/v2",
  failClosedExternalChecks:
    (process.env.FAIL_CLOSED_EXTERNAL_CHECKS ?? "true").toLowerCase() !== "false",
  queueTimezone:
    process.env.MEDIVANCE_QUEUE_TIMEZONE ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC",
  lowStockWarningMultiplier: positiveNumberFromEnv(
    process.env.MEDIVANCE_LOW_STOCK_WARNING_MULTIPLIER,
    1.25,
  ),
};

export function hasSupabaseEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function hasLlmEnv() {
  return Boolean(env.openAiApiKey || env.anthropicApiKey);
}
