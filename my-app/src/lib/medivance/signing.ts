import type { SignatureMeaning } from "@/lib/medivance/types";

export const SIGNING_INTENT_COOKIE = "medivance_signing_intent";

export interface SigningIntentCookiePayload {
  jobId: string;
  intentId: string;
  challengeCode: string;
  signatureMeaning: SignatureMeaning;
  expiresAt: string;
  issuedAt: string;
}

export function normalizeSignatureMeaning(value: string): SignatureMeaning {
  if (value === "compounded_by") return "compounded_by";
  if (value === "verified_by") return "verified_by";
  return "reviewed_and_approved";
}

export function parseSigningIntentCookie(
  raw: string | undefined,
): SigningIntentCookiePayload | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SigningIntentCookiePayload>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.jobId !== "string" ||
      typeof parsed.intentId !== "string" ||
      typeof parsed.challengeCode !== "string" ||
      typeof parsed.signatureMeaning !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.issuedAt !== "string"
    ) {
      return null;
    }

    const expiresAt = new Date(parsed.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return null;
    }

    return {
      jobId: parsed.jobId,
      intentId: parsed.intentId,
      challengeCode: parsed.challengeCode,
      signatureMeaning: normalizeSignatureMeaning(parsed.signatureMeaning),
      expiresAt: parsed.expiresAt,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}
