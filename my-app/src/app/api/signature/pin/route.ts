import { NextResponse } from "next/server";

import { setSignaturePin } from "@/lib/medivance/db";
import { createClient } from "@/lib/supabase/server";

function safeRedirectPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  return value;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  const formData = await request.formData();
  const pin = typeof formData.get("signaturePin") === "string" ? String(formData.get("signaturePin")) : "";
  const confirmPin =
    typeof formData.get("confirmSignaturePin") === "string"
      ? String(formData.get("confirmSignaturePin"))
      : "";
  const redirectTo = safeRedirectPath(formData.get("redirectTo"));

  const redirectUrl = new URL(redirectTo, request.url);

  if (pin.length < 8) {
    redirectUrl.searchParams.set("toast", "Signature PIN must be at least 8 characters.");
    return NextResponse.redirect(redirectUrl);
  }
  if (pin !== confirmPin) {
    redirectUrl.searchParams.set("toast", "Signature PIN confirmation does not match.");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const result = await setSignaturePin(supabase, { pin });
    if (result.ok !== true) {
      const reason =
        typeof result.reason === "string" ? result.reason : "unable_to_set_signature_pin";
      redirectUrl.searchParams.set("toast", `Could not set signature PIN: ${reason}.`);
      return NextResponse.redirect(redirectUrl);
    }

    redirectUrl.searchParams.set("toast", "Signature PIN updated.");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message =
      error instanceof Error
        ? `Could not set signature PIN: ${error.message}`
        : "Could not set signature PIN.";
    redirectUrl.searchParams.set("toast", message);
    return NextResponse.redirect(redirectUrl);
  }
}
