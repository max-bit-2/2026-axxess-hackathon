export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  let styles = "bg-slate-100 text-slate-800 border-slate-200 ";
  
  if (normalized.includes("verify") || normalized.includes("review") || normalized.includes("escalated") || normalized === "needs_review") {
    styles = "bg-orange-100 text-orange-800 border-orange-200 ";
  } else if (normalized.includes("progress") || normalized === "running" || normalized === "started") {
    styles = "bg-purple-100 text-purple-800 border-purple-200 ";
  } else if (normalized.includes("pass") || normalized.includes("approve") || normalized === "verified") {
    styles = "bg-green-100 text-green-800 border-green-200 ";
  } else if (normalized.includes("fail") || normalized.includes("reject") || normalized === "rejected") {
    styles = "bg-red-100 text-red-800 border-red-200 ";
  } else if (normalized.includes("pend") || normalized === "pending") {
    styles = "bg-blue-100 text-blue-800 border-blue-200 ";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles}`}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}
