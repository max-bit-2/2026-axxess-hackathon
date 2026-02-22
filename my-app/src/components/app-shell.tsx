import type { ReactNode } from "react";
import Link from "next/link";

export function AppShell({
  children,
  userLabel,
}: {
  children: ReactNode;
  userLabel: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-8">
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />
      <div className="bg-orb bg-orb-c" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-[30px] border border-white/45 px-5 py-4 shadow-[0_16px_42px_-26px_rgba(12,40,75,0.45)]">
          <div className="flex items-center gap-3">
            <span className="logo-mark" aria-hidden />
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-slate-600 uppercase">
                Medivance
              </p>
              <p className="text-sm text-slate-700">AI-Assisted Compounding Workflow</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="pill-btn pill-btn-secondary">
              Dashboard
            </Link>
            <span className="rounded-full border border-white/60 bg-white/35 px-3 py-1 text-sm text-slate-700">
              {userLabel}
            </span>
            <form action="/auth/logout" method="post">
              <button className="pill-btn" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
