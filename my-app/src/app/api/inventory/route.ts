import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  getInventoryItems,
  upsertInventoryItem,
  writeAuditEvent,
} from "@/lib/medivance/db";
import type { IngredientUnit } from "@/lib/medivance/types";

function sanitizeNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseFloat(typeof value === "string" ? value : "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function buildRedirect(request: Request, toast: string) {
  const requestUrl = new URL(request.url);
  const redirectUrl = new URL("/inventory", requestUrl.origin);
  redirectUrl.searchParams.set("toast", toast);
  return NextResponse.redirect(redirectUrl);
}

function sanitizeUnit(value: string): IngredientUnit | null {
  if (value === "mg" || value === "g" || value === "mL") return value;
  return null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  const items = await getInventoryItems(supabase, user.id);
  return NextResponse.json({ items });
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
  const action = sanitizeString(formData.get("action"));
  if (action !== "upsert" && action.length > 0) {
    return buildRedirect(request, "Unsupported inventory action.");
  }

  const ingredientName = sanitizeString(formData.get("ingredientName"));
  const unit = sanitizeUnit(sanitizeString(formData.get("unit")));
  const availableQuantity = sanitizeNumber(formData.get("availableQuantity"), NaN);
  const lowStockThreshold = sanitizeNumber(formData.get("lowStockThreshold"), NaN);
  const lotNumber = sanitizeString(formData.get("lotNumber"));
  const expiresOn = sanitizeString(formData.get("expiresOn"));
  const notes = sanitizeString(formData.get("notes"));
  const sourceDocument = sanitizeString(formData.get("sourceDocument"));

  if (!ingredientName) {
    return buildRedirect(request, "Ingredient name is required.");
  }
  if (!unit) {
    return buildRedirect(request, "Inventory unit must be mg, g, or mL.");
  }
  if (!Number.isFinite(availableQuantity) || availableQuantity < 0) {
    return buildRedirect(request, "Available quantity must be a non-negative number.");
  }
  if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
    return buildRedirect(request, "Low-stock threshold must be a non-negative number.");
  }

  try {
    const upsertResult = await upsertInventoryItem({
      ownerId: user.id,
      ingredientName,
      availableQuantity,
      unit,
      lowStockThreshold,
      lotNumber: lotNumber || undefined,
      expiresOn: expiresOn || undefined,
    });
    await writeAuditEvent(supabase, {
      ownerId: user.id,
      eventType: "inventory.adjusted",
      eventPayload: {
        performedBy: user.id,
        action: "manual_inventory_adjustment",
        ingredientName,
        unit,
        lotNumber: upsertResult.lotNumber,
        expiresOn: upsertResult.expiresOn,
        lowStockThreshold,
        availableQuantity,
        lotAction: upsertResult.lotAction,
        previousLotQuantity: upsertResult.previousLotQuantity,
        previousLotExpiresOn: upsertResult.previousLotExpiresOn,
        previousLot: upsertResult.previousLot,
        previousLowStockThreshold: upsertResult.previousLowStockThreshold,
        newLowStockThreshold: upsertResult.lowStockThreshold,
        timestamp: new Date().toISOString(),
        notes: notes.length > 0 ? notes : undefined,
        sourceDocument: sourceDocument.length > 0 ? sourceDocument : undefined,
      },
    });
    return buildRedirect(request, "Inventory updated successfully.");
  } catch (error) {
    const message =
      error instanceof Error ? `Update failed: ${error.message}` : "Inventory update failed.";
    return buildRedirect(request, message);
  }
}
