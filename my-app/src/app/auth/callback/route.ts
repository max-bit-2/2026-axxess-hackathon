import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function safeNextPath(nextValue: string | null) {
  if (!nextValue || !nextValue.startsWith("/")) {
    return "/dashboard";
  }
  return nextValue;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    const signinUrl = new URL("/signin", requestUrl.origin);
    signinUrl.searchParams.set("error", "Missing OAuth code.");
    return NextResponse.redirect(signinUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const signinUrl = new URL("/signin", requestUrl.origin);
    signinUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
