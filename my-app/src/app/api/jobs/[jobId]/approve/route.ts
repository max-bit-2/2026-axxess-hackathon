import { NextResponse } from "next/server";

import { approveCompoundingJob } from "@/lib/medivance/pipeline";
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

  try {
    await approveCompoundingJob(supabase, {
      userId: user.id,
      jobId,
      approverId: user.id,
      note,
    });
    return buildRedirect(request, jobId, "Job approved and final label generated.");
  } catch (error) {
    const message =
      error instanceof Error ? `Approval failed: ${error.message}` : "Approval failed.";
    return buildRedirect(request, jobId, message);
  }
}
