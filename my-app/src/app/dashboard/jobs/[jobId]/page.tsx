import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { JobActionPanel } from "@/components/job-action-panel";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { requireUser } from "@/lib/auth";
import { getJobPresentationData } from "@/lib/medivance/db";
import { parseSigningIntentCookie, SIGNING_INTENT_COOKIE } from "@/lib/medivance/signing";

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function extractChecks(payload: Record<string, unknown>) {
  const checks = payload.checks;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    return [];
  }

  return Object.entries(checks as Record<string, unknown>).map(([key, value]) => {
    const item =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    return {
      key,
      status: typeof item.status === "string" ? item.status : "WARN",
      detail: typeof item.detail === "string" ? item.detail : "No detail provided.",
    };
  });
}

function extractAiReview(payload: Record<string, unknown>) {
  const checkKeys = [
    "clinicalReasonableness",
    "preparationCompleteness",
    "citationQuality",
  ];
  const checks = checkKeys.map((key) => {
    const raw =
      payload[key] && typeof payload[key] === "object" && !Array.isArray(payload[key])
        ? (payload[key] as Record<string, unknown>)
        : {};

    return {
      key,
      status: typeof raw.status === "string" ? raw.status : "WARN",
      detail: typeof raw.detail === "string" ? raw.detail : "No detail provided.",
    };
  });

  const rawCitations = Array.isArray(payload.citations) ? payload.citations : [];
  const citations = rawCitations
    .map((item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {},
    )
    .filter((item) => typeof item.url === "string" && typeof item.title === "string")
    .map((item) => ({
      source: typeof item.source === "string" ? item.source : "reference",
      title: item.title as string,
      url: item.url as string,
      detail: typeof item.detail === "string" ? item.detail : "",
    }));

  const externalWarnings = Array.isArray(payload.externalWarnings)
    ? payload.externalWarnings.filter((value): value is string => typeof value === "string")
    : [];

  return {
    checks,
    citations,
    externalWarnings,
  };
}

function getToast(toast: string | undefined) {
  if (!toast) return null;
  const lower = toast.toLowerCase();
  if (lower.includes("failed") || lower.includes("rejected")) {
    return { text: toast, tone: "danger" as const };
  }
  return { text: toast, tone: "neutral" as const };
}

export default async function JobDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ toast?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { jobId } = await params;
  const { toast } = await searchParams;

  let data;
  try {
    data = await getJobPresentationData(supabase, user.id, jobId);
  } catch {
    notFound();
  }

  const { context, reports, feedback, finalOutput, audit } = data;
  const cookieStore = await cookies();
  const signingIntentRaw = cookieStore.get(SIGNING_INTENT_COOKIE)?.value;
  const parsedIntent = parseSigningIntentCookie(signingIntentRaw);
  const signingIntent = parsedIntent?.jobId === jobId ? parsedIntent : null;
  const latestReport = reports[0];
  const latestValues =
    latestReport && typeof latestReport.report === "object" ? latestReport.report : {};
  const hardChecks =
    latestReport && typeof latestReport.hardChecks === "object"
      ? extractChecks(latestReport.hardChecks)
      : [];
  const aiReview =
    latestReport && typeof latestReport.aiReview === "object"
      ? extractAiReview(latestReport.aiReview)
      : { checks: [], citations: [], externalWarnings: [] };
  const toastMessage = getToast(toast);

  const { data: formulaData } = context.job.formulaId
    ? await supabase
        .from("formulas")
        .select("name, source, instructions")
        .eq("id", context.job.formulaId)
        .maybeSingle()
    : { data: null };

  return (
    <AppShell userLabel={String(user.user_metadata.full_name ?? user.email ?? "Pharmacist")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard" className="pill-btn pill-btn-secondary">
          Back to Queue
        </Link>
        <StatusPill status={context.job.status} />
      </div>

      {toastMessage ? (
        <div
          className={
            toastMessage.tone === "danger"
              ? "rounded-2xl border border-rose-200 bg-rose-100/80 px-4 py-3 text-sm text-rose-700"
              : "rounded-2xl border border-slate-200 bg-white/55 px-4 py-3 text-sm text-slate-700"
          }
        >
          {toastMessage.text}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="space-y-4">
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase">
            Job Summary
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {context.prescription.medicationName}
          </h1>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/60 bg-white/25 p-4">
              <p className="summary-label">Patient</p>
              <p className="summary-value">{context.patient.fullName}</p>
              <p className="summary-sub">
                Weight {context.patient.weightKg} kg • Allergies{" "}
                {context.patient.allergies.length
                  ? context.patient.allergies.join(", ")
                  : "None listed"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/25 p-4">
              <p className="summary-label">Prescription</p>
              <p className="summary-value">
                {context.prescription.doseMgPerKg} mg/kg • {context.prescription.frequencyPerDay}x/day
              </p>
              <p className="summary-sub">
                {context.prescription.strengthMgPerMl} mg/mL •{" "}
                {context.prescription.dispenseVolumeMl} mL
              </p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/25 p-4 sm:col-span-2">
              <p className="summary-label">Resolved Formula</p>
              <p className="summary-value">
                {formulaData?.name ?? "Unresolved"}{" "}
                {formulaData?.source ? `(${formatStatus(formulaData.source)})` : ""}
              </p>
              <p className="summary-sub">{formulaData?.instructions ?? "Run pipeline to resolve formula."}</p>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Due {dateTime.format(new Date(context.prescription.dueAt))}
          </p>
        </GlassCard>

        <JobActionPanel
          jobId={jobId}
          jobStatus={context.job.status}
          signingIntent={signingIntent}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Latest Verification Snapshot</h2>
            <p className="text-xs text-slate-600">
              {latestReport ? `v${latestReport.version}` : "No report"}
            </p>
          </div>

          {latestReport ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/60 bg-white/25 p-3">
                  <p className="summary-label">Single Dose</p>
                  <p className="summary-value">
                    {String(latestValues.singleDoseMg ?? "--")} mg
                  </p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/25 p-3">
                  <p className="summary-label">Daily Dose</p>
                  <p className="summary-value">{String(latestValues.dailyDoseMg ?? "--")} mg</p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/25 p-3">
                  <p className="summary-label">BUD</p>
                  <p className="summary-value">{String(latestValues.budDateIso ?? "--")}</p>
                </div>
              </div>

              <div className="grid gap-2">
                {hardChecks.map((check) => (
                  <div key={check.key} className="check-row">
                    <p className="text-sm font-semibold text-slate-800">{formatStatus(check.key)}</p>
                    <p className="text-xs text-slate-700">{check.detail}</p>
                    <span
                      className={
                        check.status === "PASS"
                          ? "check-pass"
                          : check.status === "FAIL"
                            ? "check-fail"
                            : "check-warn"
                      }
                    >
                      {check.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="summary-label">AI + External Review</p>
                <div className="grid gap-2">
                  {aiReview.checks.map((check) => (
                    <div key={check.key} className="check-row">
                      <p className="text-sm font-semibold text-slate-800">{formatStatus(check.key)}</p>
                      <p className="text-xs text-slate-700">{check.detail}</p>
                      <span
                        className={
                          check.status === "PASS"
                            ? "check-pass"
                            : check.status === "FAIL"
                              ? "check-fail"
                              : "check-warn"
                        }
                      >
                        {check.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="summary-label">External References</p>
                {aiReview.citations.length ? (
                  <div className="grid gap-2">
                    {aiReview.citations.map((citation) => (
                      <a
                        key={`${citation.source}:${citation.url}`}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="timeline-row block"
                      >
                        <p className="text-sm font-semibold text-slate-800">{citation.title}</p>
                        <p className="text-xs text-slate-600">{formatStatus(citation.source)}</p>
                        {citation.detail ? (
                          <p className="text-xs text-slate-700">{citation.detail}</p>
                        ) : null}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-700">
                    No external citations attached for this run.
                  </p>
                )}
                {aiReview.externalWarnings.length ? (
                  <p className="text-xs text-amber-800">
                    {aiReview.externalWarnings.join(" ")}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-700">
              No report generated yet. Run pipeline to create deterministic calculations and hard safety checks.
            </p>
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Final Output</h2>
          {finalOutput ? (
            <div className="space-y-3 rounded-2xl border border-white/60 bg-white/30 p-4">
              <p className="text-sm text-slate-700">
                Approved {dateTime.format(new Date(finalOutput.approvedAt))}
              </p>
              <p className="text-xs text-slate-700">
                Signed by {finalOutput.signerName} ({finalOutput.signerEmail}) •{" "}
                {formatStatus(finalOutput.signatureMeaning)}
              </p>
              <p className="text-xs text-slate-600">
                Signature hash: <span className="font-mono">{finalOutput.signatureHash.slice(0, 16)}...</span>
              </p>
              <p className="summary-label">Label Preview</p>
              <pre className="json-preview">{JSON.stringify(finalOutput.labelPayload, null, 2)}</pre>
            </div>
          ) : (
            <p className="text-sm text-slate-700">
              No final output yet. Approve the verified job to generate locked report + label payload.
            </p>
          )}
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="space-y-3 xl:col-span-1">
          <h3 className="text-base font-semibold text-slate-800">Report History</h3>
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.id} className="timeline-row">
                <p className="text-sm font-semibold text-slate-800">
                  v{report.version} • {formatStatus(report.overallStatus)}
                </p>
                <p className="text-xs text-slate-600">
                  {dateTime.format(new Date(report.createdAt))}
                </p>
              </div>
            ))}
            {!reports.length ? <p className="text-sm text-slate-600">No reports yet.</p> : null}
          </div>
        </GlassCard>

        <GlassCard className="space-y-3 xl:col-span-1">
          <h3 className="text-base font-semibold text-slate-800">Pharmacist Feedback</h3>
          <div className="space-y-2">
            {feedback.map((item) => (
              <div key={item.id} className="timeline-row">
                <p className="text-sm font-semibold text-slate-800">
                  {formatStatus(item.decision)}
                </p>
                <p className="text-xs text-slate-700">{item.feedback}</p>
                <p className="text-xs text-slate-600">
                  {dateTime.format(new Date(item.createdAt))}
                </p>
              </div>
            ))}
            {!feedback.length ? <p className="text-sm text-slate-600">No pharmacist notes yet.</p> : null}
          </div>
        </GlassCard>

        <GlassCard className="space-y-3 xl:col-span-1">
          <h3 className="text-base font-semibold text-slate-800">Audit Trail</h3>
          <div className="space-y-2">
            {audit.map((event) => (
              <div key={event.id} className="timeline-row">
                <p className="text-sm font-semibold text-slate-800">{event.eventType}</p>
                <p className="text-xs text-slate-600">
                  {dateTime.format(new Date(event.createdAt))}
                </p>
              </div>
            ))}
            {!audit.length ? <p className="text-sm text-slate-600">No events yet.</p> : null}
          </div>
        </GlassCard>
      </section>
    </AppShell>
  );
}
