import { NextResponse } from "next/server";

import { rejectCompoundingJob } from "@/lib/medivance/pipeline";
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
  const feedbackValue = formData.get("feedback");
  const feedback = typeof feedbackValue === "string" ? feedbackValue.trim() : "";

  if (!feedback) {
    return buildRedirect(request, jobId, "Rejection feedback is required.");
  }

  try {
    await rejectCompoundingJob(supabase, {
      userId: user.id,
      jobId,
      feedback,
    });
    return buildRedirect(
      request,
      jobId,
      "Job marked as rejected. Feedback recorded in audit trail.",
    );
  } catch (error) {
    const message =
      error instanceof Error ? `Reject failed: ${error.message}` : "Reject failed.";
    return buildRedirect(request, jobId, message);
  }
}
