import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getInventoryAlerts } from "@/lib/medivance/db";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  const alerts = await getInventoryAlerts(supabase, user.id);
  return NextResponse.json({ alerts });
}
