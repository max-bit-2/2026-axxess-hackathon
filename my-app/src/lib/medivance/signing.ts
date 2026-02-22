import type { SignatureMeaning } from "@/lib/medivance/types";

export function normalizeSignatureMeaning(value: string): SignatureMeaning {
  if (value === "compounded_by") return "compounded_by";
  if (value === "verified_by") return "verified_by";
  return "reviewed_and_approved";
}
