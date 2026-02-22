import Link from "next/link";
import { redirect } from "next/navigation";

import { getOptionalUser } from "@/lib/auth";

export default async function Home() {
  const { user } = await getOptionalUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="landing-shell">
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />
      <div className="bg-orb bg-orb-c" />

      <section className="landing-card">
        <div className="space-y-4 animate-slide-up">
          <p className="text-xs font-semibold tracking-[0.24em] text-slate-600 uppercase">
            Medivance
          </p>
          <h1 className="text-balance text-4xl leading-[1.05] font-semibold text-slate-900 md:text-6xl">
            Pharmaceutical Workflow.
            <br />
            <span className="text-slate-600">Deterministic Safety.</span>
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 md:text-lg">
            MVP platform for compounding queue management, formula resolution, deterministic
            calculations, AI-assisted verification, and pharmacist sign-off with a full audit trail.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 animate-slide-up-delayed">
          <Link href="/signin" className="pill-btn px-6 py-3 text-sm md:text-base">
            Continue with Google
          </Link>
          <Link href="/dashboard" className="pill-btn pill-btn-secondary px-6 py-3 text-sm md:text-base">
            View Demo Dashboard
          </Link>
        </div>

        <div className="mt-10 grid gap-3 text-sm text-slate-700 md:grid-cols-3 animate-fade-in">
          <div className="feature-pill">
            <span className="feature-dot" />
            Queue + patient context
          </div>
          <div className="feature-pill">
            <span className="feature-dot" />
            Formula hierarchy fallback
          </div>
          <div className="feature-pill">
            <span className="feature-dot" />
            Verifier loop with escalation
          </div>
        </div>
      </section>
    </main>
  );
}
