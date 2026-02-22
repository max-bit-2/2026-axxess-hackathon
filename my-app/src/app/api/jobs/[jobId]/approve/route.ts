import { NextResponse } from "next/server";

import { getOptionalUser } from "@/lib/auth";
import { approveCompoundingJob } from "@/lib/medivance/pipeline";

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
  const { supabase, user } = await getOptionalUser();

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
      note,
    });
    return buildRedirect(request, jobId, "Job approved and final label generated.");
  } catch (error) {
    const message =
      error instanceof Error ? `Approval failed: ${error.message}` : "Approval failed.";
    return buildRedirect(request, jobId, message);
  }
}
