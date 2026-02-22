import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { requireUser } from "@/lib/auth";
import { ensureDemoData, getQueueItems } from "@/lib/medivance/db";

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  await ensureDemoData(supabase, user.id);

  const queue = await getQueueItems(supabase, user.id);

  const stats = {
    total: queue.length,
    urgent: queue.filter((job) => job.priority >= 4).length,
    readyForApproval: queue.filter((job) => job.status === "verified").length,
    escalated: queue.filter((job) => job.status === "needs_review").length,
  };

  const displayName = user.user_metadata.full_name ?? user.email ?? "Pharmacist";

  return (
    <AppShell userLabel={String(displayName)}>
      <section className="grid gap-4 md:grid-cols-4">
        <GlassCard className="stat-card">
          <p className="stat-label">Queue Today</p>
          <p className="stat-value">{stats.total}</p>
        </GlassCard>
        <GlassCard className="stat-card">
          <p className="stat-label">High Priority</p>
          <p className="stat-value">{stats.urgent}</p>
        </GlassCard>
        <GlassCard className="stat-card">
          <p className="stat-label">Ready For Signoff</p>
          <p className="stat-value">{stats.readyForApproval}</p>
        </GlassCard>
        <GlassCard className="stat-card">
          <p className="stat-label">Escalated</p>
          <p className="stat-value">{stats.escalated}</p>
        </GlassCard>
      </section>

      <GlassCard className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase">
              Compounding Queue
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Today&apos;s Jobs</h1>
          </div>
          <p className="rounded-full border border-white/60 bg-white/30 px-3 py-1 text-xs text-slate-600">
            Patient-specific → Company → Generated Formula Cascade
          </p>
        </div>

        <div className="grid gap-3">
          {queue.map((item, index) => (
            <Link
              href={`/dashboard/jobs/${item.jobId}`}
              key={item.jobId}
              className="queue-row"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={item.status} />
                <p className="text-sm text-slate-700">
                  P{item.priority} • Iterations {item.iterationCount}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">{item.medicationName}</p>
                <p className="text-sm text-slate-700">
                  {item.patientName} • {item.route}
                </p>
              </div>

              <div className="justify-self-start text-left sm:justify-self-end sm:text-right">
                <p className="text-sm text-slate-700">Due</p>
                <p className="text-sm font-medium text-slate-900">
                  {item.dueAt ? dateTime.format(new Date(item.dueAt)) : "--"}
                </p>
              </div>
            </Link>
          ))}

          {!queue.length ? (
            <div className="rounded-2xl border border-white/60 bg-white/35 p-6 text-center text-slate-700">
              No prescriptions queued yet. Add a prescription row in Supabase to start the workflow.
            </div>
          ) : null}
        </div>
      </GlassCard>
    </AppShell>
  );
}
