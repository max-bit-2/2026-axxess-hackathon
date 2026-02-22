import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

let cachedDemoUser: User | null = null;

function createServiceRoleClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      "Demo auth bypass requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createDemoUser(userId: string, fullName: string): User {
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: env.demoUserEmail,
    created_at: "1970-01-01T00:00:00.000Z",
    app_metadata: {
      provider: "email",
      providers: ["email"],
      demo: true,
    },
    user_metadata: {
      full_name: fullName,
      name: fullName,
      demo: true,
    },
  } as User;
}

async function resolveDemoUser(supabase: SupabaseClient): Promise<User> {
  if (cachedDemoUser) return cachedDemoUser;

  const selectedUserId = env.demoUserId;

  if (selectedUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", selectedUserId)
      .maybeSingle();

    const fullName =
      (profile && typeof profile.full_name === "string" && profile.full_name.trim()) ||
      env.demoUserName;

    cachedDemoUser = createDemoUser(selectedUserId, fullName);
    return cachedDemoUser;
  }

  const { data: latestPatientOwner, error: patientOwnerError } = await supabase
    .from("patients")
    .select("owner_id, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (patientOwnerError) throw patientOwnerError;

  if (latestPatientOwner?.owner_id) {
    const ownerId = latestPatientOwner.owner_id as string;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", ownerId)
      .maybeSingle();

    const fullName =
      (profile && typeof profile.full_name === "string" && profile.full_name.trim()) ||
      env.demoUserName;

    cachedDemoUser = createDemoUser(ownerId, fullName);
    return cachedDemoUser;
  }

  const { data: profileFallback, error: profileFallbackError } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileFallbackError) throw profileFallbackError;
  if (!profileFallback?.id) {
    throw new Error("Demo auth bypass is enabled but no profile records exist.");
  }

  const fallbackName =
    (typeof profileFallback.full_name === "string" && profileFallback.full_name.trim()) ||
    env.demoUserName;
  cachedDemoUser = createDemoUser(profileFallback.id as string, fallbackName);
  return cachedDemoUser;
}

async function getSessionContext() {
  if (env.disableAuthForDemo) {
    // Keep auth-protected pages dynamic while bypass mode is enabled.
    await cookies();
    const supabase = createServiceRoleClient();
    const user = await resolveDemoUser(supabase);
    return { supabase, user };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser() {
  const { supabase, user } = await getSessionContext();

  if (!user) {
    redirect("/signin");
  }

  return { supabase, user };
}

export async function getOptionalUser() {
  return getSessionContext();
}
