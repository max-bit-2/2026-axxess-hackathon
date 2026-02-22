export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  drugbankApiKey: process.env.DRUGBANK_API_KEY ?? "",
  openFdaApiKey: process.env.OPENFDA_API_KEY ?? "",
  rxNavBaseUrl: process.env.RXNAV_BASE_URL ?? "https://rxnav.nlm.nih.gov/REST",
};

export function hasSupabaseEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function hasLlmEnv() {
  return Boolean(env.openAiApiKey || env.anthropicApiKey);
}
