import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/ui/status-pill";
import { requireUser } from "@/lib/auth";
import { ensureDemoData, getQueueItems } from "@/lib/medivance/db";

const dateTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase, user } = await requireUser();
  await ensureDemoData(supabase, user.id);

  const params = await searchParams;
  const q = params.q?.toLowerCase() || "";

  let queue = await getQueueItems(supabase, user.id);

  if (q) {
    queue = queue.filter(
      (item) =>
        item.patientName.toLowerCase().includes(q) ||
        item.medicationName.toLowerCase().includes(q) ||
        item.patientId?.toLowerCase().includes(q)
    );
  }

  const stats = {
    total: queue.length,
    urgent: queue.filter((job) => job.priority >= 4).length,
    readyForApproval: queue.filter((job) => job.status === "verified").length,
    escalated: queue.filter((job) => job.status === "needs_review").length,
  };

  const displayName = user.user_metadata.full_name ?? user.email ?? "Pharmacist";

  return (
    <AppShell userLabel={String(displayName)}>
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 mt-1">Real-time compounding workflow and verification queue.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">sync</span>
            Last updated: {new Date().toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit'})}
          </span>
          <Link href="/dashboard" className="bg-[var(--color-primary)] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm shadow-[var(--color-primary)]/30 transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh Queue
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        {/* Total Queue Card */}
        <div className="liquid-glass rounded-xl p-5 flex flex-col justify-between group hover:border-slate-300 :border-slate-600 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 rounded-lg text-[var(--color-primary)]">
              <span className="material-symbols-outlined">queue_music</span>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded-md">Total</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 ">Queue Today</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stats.total}</p>
          </div>
        </div>

        {/* High Priority Card */}
        <div className="liquid-glass rounded-xl p-5 flex flex-col justify-between shadow-[var(--shadow-glow-red)] border-red-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <span className="material-symbols-outlined">priority_high</span>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-red-800 ">High Priority</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{stats.urgent}</p>
          </div>
        </div>

        {/* Ready for Signoff Card */}
        <div className="liquid-glass rounded-xl p-5 flex flex-col justify-between shadow-[var(--shadow-glow-green)] border-green-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <span className="material-symbols-outlined">verified_user</span>
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-green-800 ">Ready for Signoff</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{stats.readyForApproval}</p>
          </div>
        </div>

        {/* Escalated Card */}
        <div className="liquid-glass rounded-xl p-5 flex flex-col justify-between border-orange-200 bg-orange-50/30 ">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
              <span className="material-symbols-outlined">warning</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-orange-800 ">Escalated</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{stats.escalated}</p>
          </div>
        </div>
      </div>

      {/* Main Queue Table */}
      <div className="liquid-glass rounded-xl overflow-hidden shadow-[var(--shadow-glass)] border border-slate-200/60 ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold backdrop-blur-sm">
                <th className="px-6 py-4 w-32">Status</th>
                <th className="px-6 py-4 w-24">Priority</th>
                <th className="px-6 py-4 w-24">Iter.</th>
                <th className="px-6 py-4">Medication</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4 w-24">Route</th>
                <th className="px-6 py-4 w-32">Due Time</th>
                <th className="px-6 py-4 w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {queue.map((item) => (
                <tr key={item.jobId} className="group hover:bg-blue-50/30 :bg-blue-900/10 transition-colors">
                  <td className="px-6 py-3">
                    <StatusPill status={item.status} />
                  </td>
                  <td className="px-6 py-3">
                    {item.priority >= 4 ? (
                      <span className="text-red-600 font-bold text-sm flex items-center gap-1">
                        P{item.priority} <span className="material-symbols-outlined text-[14px]">bolt</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium text-sm">
                        P{item.priority}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-sm">#{item.iterationCount}</td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 text-sm">{item.medicationName}</span>
                      <span className="text-xs text-slate-500 ">Order</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                        {item.patientName.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700 ">{item.patientName}</span>
                        <span className="text-xs text-slate-400">MRN: {item.patientId?.slice(0, 4)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600 ">{item.route}</td>
                  <td className="px-6 py-3">
                    {item.priority >= 4 ? (
                      <span className="text-red-600 font-bold text-sm bg-red-50 px-2 py-1 rounded">
                        {item.dueAt ? dateTime.format(new Date(item.dueAt)) : "--"}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-sm">
                        {item.dueAt ? dateTime.format(new Date(item.dueAt)) : "--"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/dashboard/jobs/${item.jobId}`}>
                      <button className="text-[var(--color-primary)] hover:text-blue-700 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-blue-50 :bg-blue-900/30 transition-colors">
                        Review
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
              {!queue.length && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500 ">
                    No prescriptions found. Try adjusting your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
