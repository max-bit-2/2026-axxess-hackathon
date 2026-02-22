import { cn } from "@/lib/cn";
import type { JobStatus } from "@/lib/medivance/types";

const statusStyle: Record<JobStatus, string> = {
  queued: "bg-white/40 text-slate-700 border-slate-300/80",
  in_progress: "bg-sky-100/80 text-sky-800 border-sky-300/80",
  needs_review: "bg-amber-100/90 text-amber-800 border-amber-300/90",
  verified: "bg-emerald-100/85 text-emerald-800 border-emerald-300/80",
  approved: "bg-cyan-100/85 text-cyan-800 border-cyan-300/80",
  rejected: "bg-rose-100/85 text-rose-800 border-rose-300/80",
};

const statusLabel: Record<JobStatus, string> = {
  queued: "Queued",
  in_progress: "In Progress",
  needs_review: "Needs Review",
  verified: "Verified",
  approved: "Approved",
  rejected: "Rejected",
};

export function StatusPill({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase",
        statusStyle[status],
        className,
      )}
    >
      {statusLabel[status]}
    </span>
  );
}
