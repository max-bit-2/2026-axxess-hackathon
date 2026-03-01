import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import type { JobStatus } from "@/lib/medivance/types";

export function JobActionPanel({
  jobId,
  jobStatus,
  pharmacistFeedback,
}: {
  jobId: string;
  jobStatus: JobStatus;
  pharmacistFeedback?: string | null;
}) {
  const approvalEnabled = jobStatus === "verified";

  return (
    <GlassCard className="space-y-6 !p-6 bg-white rounded-xl shadow-lg border border-slate-200">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <h3 className="font-bold text-lg text-slate-900 ">Workflow Actions</h3>
        <StatusPill status={jobStatus} />
      </div>

      <form action={`/api/jobs/${jobId}/run`} method="post" className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 ">
          Pharmacist context
        </label>
        <p className="text-xs leading-relaxed text-slate-500">
          Add pharmacist guidance to steer the run away from the default generated formula.
          Leave this blank to proceed with the generated version.
        </p>
        <textarea
          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] resize-none h-20 text-slate-900 placeholder-slate-400"
          name="feedback"
          defaultValue={pharmacistFeedback ?? ""}
          placeholder="Example: prioritize lower osmolality or substitute a preferred vehicle..."
        />
        <button
          className="flex w-full items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 :bg-slate-700 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          type="submit"
          disabled={jobStatus === "approved"}
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          Run Pipeline (max 3 runs)
        </button>
      </form>

      <div className="border-t border-slate-100 pt-4">
        <form action={`/api/jobs/${jobId}/approve`} method="post" className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-500">
            This signature records the pharmacist&apos;s review and approval of the compounding
            record before preparing the medication.
          </p>

          <textarea
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] resize-none h-16 text-slate-900 placeholder-slate-400"
            name="note"
            placeholder="Approval note (optional)"
            disabled={!approvalEnabled}
          />

          <label className="flex items-start gap-2 text-xs text-slate-600 mt-2 mb-4">
            <input
              type="checkbox"
              name="signatureAttestation"
              className="mt-0.5 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              disabled={!approvalEnabled}
              required={approvalEnabled}
            />
            I attest this electronic signature is legally binding.
          </label>

          <button
            className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-[var(--color-primary)]/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            type="submit"
            disabled={!approvalEnabled}
          >
            <span className="material-symbols-outlined">verified</span>
            Approve & Sign
          </button>
        </form>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <form action={`/api/jobs/${jobId}/reject`} method="post" className="space-y-3">
          <textarea
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500/50 focus:border-red-500 resize-none h-16 text-slate-900 placeholder-slate-400"
            name="feedback"
            placeholder="Rejection reason (required)"
            required
          />
          <button
            className="flex w-full items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 :bg-red-900/20 text-red-600 font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            type="submit"
            disabled={jobStatus === "approved"}
          >
            <span className="material-symbols-outlined text-[20px]">block</span>
            Reject Job
          </button>
        </form>
      </div>
    </GlassCard>
  );
}
