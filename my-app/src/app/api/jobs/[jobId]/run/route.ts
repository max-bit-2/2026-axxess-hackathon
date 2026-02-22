import { NextResponse } from "next/server";

import { runCompoundingPipeline } from "@/lib/medivance/pipeline";
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

  try {
    const result = await runCompoundingPipeline(supabase, {
      userId: user.id,
      jobId,
      pharmacistFeedback: feedback || undefined,
    });

    const message =
      result.status === "verified"
        ? "Verification complete. Job is ready for pharmacist approval."
        : "Pipeline ran 3 iterations and escalated to pharmacist review.";
    return buildRedirect(request, jobId, message);
  } catch (error) {
    const message =
      error instanceof Error ? `Run failed: ${error.message}` : "Run failed.";
    return buildRedirect(request, jobId, message);
  }
}
