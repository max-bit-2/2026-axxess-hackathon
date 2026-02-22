import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  const { user } = await requireUser();
  const displayName = user.user_metadata?.full_name ?? user.email ?? "Pharmacist";

  return (
    <AppShell userLabel={String(displayName)}>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">construction</span>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Coming Soon</h1>
        <p className="text-slate-500 max-w-md">This module is currently under development. Check back later for updates.</p>
      </div>
    </AppShell>
  );
}
