import Link from "next/link";
import { redirect } from "next/navigation";

import { getOptionalUser } from "@/lib/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await getOptionalUser();
  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = params.error;

  return (
    <main className="landing-shell">
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />
      <div className="bg-orb bg-orb-c" />

      <section className="landing-card max-w-xl space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.22em] text-slate-600 uppercase">
            Medivance Access
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Sign in with Google
          </h1>
          <p className="text-sm text-slate-600 md:text-base">
            This MVP only supports Google OAuth via Supabase Auth.
          </p>
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/auth/login" className="pill-btn px-6 py-3">
            Continue with Google
          </Link>
          <Link href="/" className="pill-btn pill-btn-secondary px-6 py-3">
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
