import { NextResponse } from "next/server";

import { issueSigningIntent } from "@/lib/medivance/db";
import {
  SIGNING_INTENT_COOKIE,
  normalizeSignatureMeaning,
} from "@/lib/medivance/signing";
import { createClient } from "@/lib/supabase/server";

function buildRedirect(request: Request, jobId: string, toast: string) {
  const requestUrl = new URL(request.url);
  const redirectUrl = new URL(`/dashboard/jobs/${jobId}`, requestUrl.origin);
  redirectUrl.searchParams.set("toast", toast);
  return NextResponse.redirect(redirectUrl);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  const formData = await request.formData();
  const signatureMeaningValue = formData.get("signatureMeaning");
  const signatureMeaning = normalizeSignatureMeaning(
    typeof signatureMeaningValue === "string"
      ? signatureMeaningValue
      : "reviewed_and_approved",
  );

  try {
    const payload = await issueSigningIntent(supabase, {
      jobId,
      signatureMeaning,
    });

    const response = buildRedirect(
      request,
      jobId,
      `One-time signing challenge generated (expires ${new Date(payload.expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}).`,
    );

    response.cookies.set({
      name: SIGNING_INTENT_COOKIE,
      value: JSON.stringify({
        jobId,
        intentId: payload.intentId,
        challengeCode: payload.challengeCode,
        signatureMeaning: payload.signatureMeaning,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
      }),
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? `Signing challenge failed: ${error.message}`
        : "Signing challenge failed.";
    return buildRedirect(request, jobId, message);
  }
}
