import { NextResponse } from "next/server";

import { approveCompoundingJob } from "@/lib/medivance/pipeline";
import { SIGNING_INTENT_COOKIE } from "@/lib/medivance/signing";
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
  const noteValue = formData.get("note");
  const note = typeof noteValue === "string" ? noteValue.trim() : "";

  if (!note) {
    return buildRedirect(request, jobId, "Approval rationale is required.");
  }
  const signatureMeaningValue = formData.get("signatureMeaning");
  const signatureMeaning =
    typeof signatureMeaningValue === "string"
      ? signatureMeaningValue
      : "reviewed_and_approved";
  const signaturePinValue = formData.get("signaturePin");
  const signaturePin = typeof signaturePinValue === "string" ? signaturePinValue.trim() : "";
  const signingIntentIdValue = formData.get("signingIntentId");
  const signingIntentId =
    typeof signingIntentIdValue === "string" ? signingIntentIdValue.trim() : "";
  const signingChallengeCodeValue = formData.get("signingChallengeCode");
  const signingChallengeCode =
    typeof signingChallengeCodeValue === "string"
      ? signingChallengeCodeValue.trim()
      : "";
  const signatureAttestation = formData.get("signatureAttestation") === "on";
  const signerName = String(
    user.user_metadata.full_name ?? user.user_metadata.name ?? user.email ?? "",
  ).trim();
  const signerEmail = String(user.email ?? "").trim();

  try {
    await approveCompoundingJob(supabase, {
      userId: user.id,
      jobId,
      approverId: user.id,
      signerName,
      signerEmail,
      signatureMeaning,
      signatureAttestation,
      signaturePin,
      signingIntentId,
      signingChallengeCode,
      note,
    });
    const response = buildRedirect(request, jobId, "Job approved and final label generated.");
    response.cookies.set({
      name: SIGNING_INTENT_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? `Approval failed: ${error.message}` : "Approval failed.";
    return buildRedirect(request, jobId, message);
  }
}
