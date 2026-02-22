import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import type { JobStatus } from "@/lib/medivance/types";

export function JobActionPanel({
  jobId,
  jobStatus,
}: {
  jobId: string;
  jobStatus: JobStatus;
}) {
  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Workflow Actions</h2>
        <StatusPill status={jobStatus} />
      </div>

      <form action={`/api/jobs/${jobId}/run`} method="post" className="space-y-3">
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Pharmacist context (optional)
        </label>
        <textarea
          className="glass-input h-20 w-full resize-none"
          name="feedback"
          placeholder="Example: prioritize lower osmolality and tighten BUD assumptions."
        />
        <button className="pill-btn w-full" type="submit">
          Run Deterministic Pipeline (max 3 iterations)
        </button>
      </form>

      <form action={`/api/jobs/${jobId}/approve`} method="post" className="space-y-3">
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Approval note (optional)
        </label>
        <input
          className="glass-input w-full"
          type="text"
          name="note"
          placeholder="Approved after final review."
        />
        <button
          className="pill-btn w-full disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={jobStatus !== "verified"}
        >
          Approve + Generate Final Label
        </button>
      </form>

      <form action={`/api/jobs/${jobId}/reject`} method="post" className="space-y-3">
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Rejection reason
        </label>
        <textarea
          className="glass-input h-16 w-full resize-none"
          name="feedback"
          placeholder="Required: describe issue found during pharmacist review."
          required
        />
        <button className="pill-btn pill-btn-danger w-full" type="submit">
          Reject Job
        </button>
      </form>
    </GlassCard>
  );
}
