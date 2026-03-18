import { AppShell } from "@/components/app-shell";
import { InventoryManagementClient } from "@/components/inventory-management-client";
import { requireUser } from "@/lib/auth";
import { getInventoryItems } from "@/lib/medivance/db";

export default async function Page() {
  const { supabase, user } = await requireUser();
  const displayName = user.user_metadata?.full_name ?? user.email ?? "Pharmacist";
  const items = await getInventoryItems(supabase, user.id);

  return (
    <AppShell userLabel={String(displayName)}>
      <InventoryManagementClient items={items} />
    </AppShell>
  );
}
