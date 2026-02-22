import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

async function handleLogout(request: Request) {
  const requestUrl = new URL(request.url);
  if (env.disableAuthForDemo) {
    return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/signin", requestUrl.origin));
}

export async function POST(request: Request) {
  return handleLogout(request);
}

export async function GET(request: Request) {
  return handleLogout(request);
}
