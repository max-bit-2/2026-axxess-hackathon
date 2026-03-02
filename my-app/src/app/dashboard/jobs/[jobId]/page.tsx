import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { JobActionPanel } from "@/components/job-action-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { requireUser } from "@/lib/auth";
import { getJobPresentationData } from "@/lib/medivance/db";

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatFormulaLabel(name: string | null | undefined, source: string | null | undefined) {
  const resolvedName = name ?? "Unresolved";
  if (!source) return resolvedName;

  const formattedSource = formatStatus(source);
  const normalizedName = resolvedName.toLowerCase();
  const normalizedSource = formattedSource.toLowerCase();

  if (normalizedName.includes(normalizedSource)) {
    return resolvedName;
  }

  return `${resolvedName} (${formattedSource})`;
}

function normalizeDisplayStatus(status: unknown) {
  if (status === "PASS" || status === "FAIL" || status === "WARN" || status === "SKIPPED") {
    return status;
  }
  return "WARN";
}

function getCheckStyles(status: string) {
  if (status === "PASS") {
    return {
      row: "hover:bg-slate-50 :bg-slate-800/30",
      iconWrap: "bg-green-100 text-green-600 ",
      icon: "check",
      badge: "bg-green-100 text-green-700 ",
    };
  }

  if (status === "FAIL") {
    return {
      row: "bg-red-50/50 border-l-4 border-l-red-500",
      iconWrap: "bg-red-100 text-red-600 ",
      icon: "error",
      badge: "bg-red-100 text-red-700 ",
    };
  }

  if (status === "SKIPPED") {
    return {
      row: "bg-slate-50/80 border-l-4 border-l-slate-300",
      iconWrap: "bg-slate-200 text-slate-600 ",
      icon: "skip_next",
      badge: "bg-slate-200 text-slate-700 ",
    };
  }

  return {
    row: "bg-amber-50/50 border-l-4 border-l-amber-400",
    iconWrap: "bg-amber-100 text-amber-600 ",
    icon: "warning",
    badge: "bg-amber-100 text-amber-700 ",
  };
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
      status: normalizeDisplayStatus(item.status),
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
      status: normalizeDisplayStatus(raw.status),
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

function summarizeAuditFailureReason(
  eventType: string,
  eventPayload: Record<string, unknown>,
) {
  if (
    eventType !== "pipeline.escalated_to_pharmacist" &&
    eventType !== "pipeline.preflight_failed"
  ) {
    return null;
  }

  const blockingIssues = Array.isArray(eventPayload.blockingIssues)
    ? eventPayload.blockingIssues.filter((value): value is string => typeof value === "string")
    : [];
  const warnings = Array.isArray(eventPayload.warnings)
    ? eventPayload.warnings.filter((value): value is string => typeof value === "string")
    : [];

  const missingSignals = [...blockingIssues, ...warnings].filter((message) =>
    /(missing|no .*found|no .*available|lookup failed|timed out|no deterministic|no .*match)/i.test(
      message,
    ),
  );

  const lowConfidenceSignals = [...blockingIssues, ...warnings].filter((message) =>
    /(needs_review|needs review|requires attention|ai review|warn|low confidence)/i.test(
      message,
    ),
  );

  const detailParts: string[] = [];
  if (missingSignals.length > 0) {
    detailParts.push(`Missing/Unavailable data: ${missingSignals[0]}`);
  }
  if (lowConfidenceSignals.length > 0) {
    detailParts.push(`Low-confidence signal: ${lowConfidenceSignals[0]}`);
  }
  if (detailParts.length > 0) return detailParts.join(" ");

  if (blockingIssues.length > 0) return `Primary blocker: ${blockingIssues[0]}`;
  if (warnings.length > 0) return `Primary warning: ${warnings[0]}`;

  return null;
}

function buildReadableCitationHref(params: {
  jobId: string;
  source: string;
  title: string;
  detail: string;
  url: string;
}) {
  const query = new URLSearchParams({
    source: params.source,
    title: params.title,
    detail: params.detail,
    url: params.url,
    backTo: `/dashboard/jobs/${params.jobId}`,
  });
  return `/dashboard/references?${query.toString()}`;
}

function calculateAge(dob: string | null) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const hasNotHadBirthdayThisYear =
    monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate());
  if (hasNotHadBirthdayThisYear) age -= 1;

  return age >= 0 ? age : null;
}

function extractFormulaIngredients(payload: unknown) {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {},
    )
    .map((item) => {
      const name = typeof item.name === "string" ? item.name : "Unnamed ingredient";
      const role = typeof item.role === "string" ? item.role : "ingredient";
      const quantity =
        typeof item.requiredAmount === "number"
          ? item.requiredAmount
          : typeof item.quantity === "number"
            ? item.quantity
            : null;
      const unit = typeof item.unit === "string" ? item.unit : "";

      if (quantity === null) {
        return `${name} [${role}]`;
      }

      return `${name} [${role}] - ${quantity} ${unit}`.trim();
    });
}

function extractStringList(payload: unknown) {
  return Array.isArray(payload)
    ? payload.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
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
        .select("name, source, instructions, ingredient_profile")
        .eq("id", context.job.formulaId)
        .maybeSingle()
    : { data: null };
  const formulaIngredients = extractFormulaIngredients(
    formulaData?.ingredient_profile ?? latestValues.ingredients,
  );
  const formulaSteps = extractStringList(latestValues.steps);
  const formulaNotes = extractStringList(latestValues.notes);

  const displayName = user.user_metadata.full_name ?? user.email ?? "Pharmacist";
  const patientAge = calculateAge(context.patient.dob);

  return (
    <AppShell userLabel={String(displayName)}>
      
      {toastMessage ? (
        <div className={`rounded-xl border px-4 py-3 text-sm shadow-sm flex items-center gap-3 ${toastMessage.tone === "danger" ? "border-red-200 bg-red-50 text-red-700 " : "border-slate-200 bg-white text-slate-700 "}`}>
          <span className="material-symbols-outlined">{toastMessage.tone === "danger" ? "error" : "info"}</span>
          {toastMessage.text}
        </div>
      ) : null}

      {/* Job Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Job #{jobId.split("-")[0].toUpperCase()}
            </h1>
            <StatusPill status={context.job.status} />
          </div>
          <p className="text-slate-500 text-sm">
            Due {dateTime.format(new Date(context.prescription.dueAt))} • {context.prescription.medicationName}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard" className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 :bg-slate-700 text-sm font-medium transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Queue
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-start">
        
        {/* Left Column: Context (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 ">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px]">person</span>
                Patient Context
              </h3>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                  {context.patient.fullName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-lg">{context.patient.fullName}</p>
                  <p className="text-xs text-slate-500 ">MRN: {context.patient.id.slice(0, 6)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-y-3 text-sm border-t border-slate-100 pt-3">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Age</p>
                  <p className="font-medium text-slate-900 ">{patientAge ?? "--"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Weight</p>
                  <p className="font-medium text-slate-900 ">{context.patient.weightKg} kg</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Allergies</p>
                  <p className="font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded inline-block text-xs">
                    {context.patient.allergies.length ? context.patient.allergies.join(", ") : "None"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 ">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px]">prescriptions</span>
                Rx Details
              </h3>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Drug</p>
                <p className="text-lg font-bold text-[var(--color-primary)]">{context.prescription.medicationName}</p>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Dosing / Freq</p>
                <p className="text-sm font-medium text-slate-900 ">{context.prescription.doseMgPerKg} mg/kg • {context.prescription.frequencyPerDay}x/day</p>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Formula</p>
                <p className="text-sm font-medium text-slate-900 mb-2">
                  {formatFormulaLabel(formulaData?.name, formulaData?.source)}
                </p>
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed font-mono space-y-3">
                  {formulaIngredients.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 mb-1">Ingredients</p>
                      <div className="space-y-1">
                        {formulaIngredients.map((ingredient, index) => (
                          <p key={`${ingredient}-${index}`}>{ingredient}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {formulaSteps.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 mb-1">Steps</p>
                      <div className="space-y-1">
                        {formulaSteps.map((step, index) => (
                          <p key={`${step}-${index}`}>{index + 1}. {step}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 mb-1">Instructions</p>
                      <p>{formulaData?.instructions ?? "Run pipeline to resolve formula."}</p>
                    </div>
                  )}
                  {formulaNotes.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 mb-1">Notes</p>
                      <div className="space-y-1">
                        {formulaNotes.map((note, index) => (
                          <p key={`${note}-${index}`}>- {note}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Center Column: Verification & Analysis (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          <div className="bg-gradient-to-r from-[rgba(19,127,236,0.05)] to-transparent border-l-4 border-[var(--color-primary)] rounded-r-xl p-4 flex gap-4 items-start shadow-sm bg-white ">
            <div className="bg-[rgba(19,127,236,0.1)] p-2 rounded-lg text-[var(--color-primary)]">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-900 mb-1">AI Workflow Analysis</h4>
              <p className="font-mono text-xs text-slate-600 leading-relaxed bg-slate-100 p-2 rounded border border-slate-200 ">
                {latestReport ? (
                  <>
                    &gt; RUN: Pipeline completed.<br/>
                    &gt; RUNS: {latestReport.version}<br/>
                    &gt; DOSE: {String(latestValues.singleDoseMg ?? "--")} mg (Daily: {String(latestValues.dailyDoseMg ?? "--")} mg)<br/>
                    &gt; BUD: {String(latestValues.budDateIso ?? "--")}
                  </>
                ) : (
                  "Waiting for pipeline run..."
                )}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 ">
              <h3 className="font-semibold text-slate-900 ">Verification Snapshot</h3>
              <span className="text-xs font-medium text-slate-500 ">
                {latestReport ? `v${latestReport.version}` : "No report"}
              </span>
            </div>
            
            <div className="divide-y divide-slate-100 ">
              {hardChecks.length > 0 || aiReview.checks.length > 0 ? (
                <>
                  {[...hardChecks, ...aiReview.checks].map((check, i) => {
                    const styles = getCheckStyles(check.status);

                    return (
                    <div key={i} className={`p-4 flex items-center justify-between transition-colors ${styles.row}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${styles.iconWrap}`}>
                          <span className="material-symbols-outlined text-lg">
                            {styles.icon}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 ">{formatStatus(check.key)}</p>
                          <p className="text-xs text-slate-500 ">{check.detail}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${styles.badge}`}>
                        {check.status}
                      </span>
                    </div>
                  )})}
                </>
              ) : (
                <div className="p-6 text-center text-sm text-slate-500">Run pipeline to populate checks.</div>
              )}
            </div>

            {aiReview.citations.length > 0 && (
              <div className="bg-slate-50 p-4 border-t border-slate-100 ">
                <p className="text-xs font-semibold text-slate-500 mb-3">EXTERNAL CITATIONS</p>
                <div className="space-y-3">
                  {aiReview.citations.map((citation, i) => (
                    citation.source === "dailymed" ? (
                      <a
                        key={i}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-3 bg-white rounded border border-slate-200 hover:border-blue-300 transition-colors"
                      >
                        <p className="text-sm font-semibold text-[var(--color-primary)]">{citation.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{citation.detail || citation.source}</p>
                      </a>
                    ) : (
                      <Link
                        key={i}
                        href={buildReadableCitationHref({
                          jobId,
                          source: citation.source,
                          title: citation.title,
                          detail: citation.detail || citation.source,
                          url: citation.url,
                        })}
                        className="block p-3 bg-white rounded border border-slate-200 hover:border-blue-300 transition-colors"
                      >
                        <p className="text-sm font-semibold text-[var(--color-primary)]">{citation.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{citation.detail || citation.source}</p>
                      </Link>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative group bg-white rounded-xl shadow-sm border border-slate-200 p-5 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Final Label Preview</h3>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
                {finalOutput ? "Final" : "Draft"}
              </span>
            </div>
            {finalOutput ? (
              <div className="relative bg-white border-2 border-slate-300 border-dashed rounded-lg p-4 font-mono text-xs text-black shadow-sm mx-auto max-w-md select-none transition-opacity">
                <div className="mb-2 border-b border-black pb-2 space-y-1">
                  <p className="font-bold">Approved {dateTime.format(new Date(finalOutput.approvedAt))}</p>
                  <p>Signed by {finalOutput.signerName} ({finalOutput.signerEmail})</p>
                  <p>Hash: {finalOutput.signatureHash.slice(0, 16)}...</p>
                </div>
                <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(finalOutput.labelPayload, null, 2)}</pre>
              </div>
            ) : (
              <div className="relative bg-white border-2 border-slate-300 border-dashed rounded-lg p-6 text-center shadow-sm mx-auto max-w-md select-none opacity-80">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">qr_code_2</span>
                <p className="text-sm text-slate-500 font-medium">No final output yet. Approve job to generate label.</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Actions & Workflow (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <JobActionPanel
            jobId={jobId}
            jobStatus={context.job.status}
            pharmacistFeedback={context.job.pharmacistFeedback}
          />

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 ">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px]">history</span>
                Audit Trail
              </h3>
            </div>
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="relative pl-4 border-l-2 border-slate-200 space-y-6">
                
                {audit.length > 0 ? audit.map((event) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[21px] bg-white border-2 border-[var(--color-primary)] rounded-full p-0.5">
                      <div className="size-2 bg-[var(--color-primary)] rounded-full"></div>
                    </div>
                    <p className="text-xs text-slate-500 mb-0.5">{dateTime.format(new Date(event.createdAt))}</p>
                    <p className="text-sm font-bold text-slate-900 ">{event.eventType}</p>
                    {summarizeAuditFailureReason(event.eventType, event.eventPayload) ? (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {summarizeAuditFailureReason(event.eventType, event.eventPayload)}
                      </p>
                    ) : null}
                  </div>
                )) : (
                  <p className="text-sm text-slate-500 ml-2">No audit events yet.</p>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
