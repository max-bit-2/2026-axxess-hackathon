import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import type { SigningIntentCookiePayload } from "@/lib/medivance/signing";
import type { JobStatus } from "@/lib/medivance/types";

export function JobActionPanel({
  jobId,
  jobStatus,
  signingIntent,
}: {
  jobId: string;
  jobStatus: JobStatus;
  signingIntent: SigningIntentCookiePayload | null;
}) {
  const approvalEnabled = jobStatus === "verified" && Boolean(signingIntent);

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Workflow Actions</h2>
        <StatusPill status={jobStatus} />
      </div>

      <form action={`/api/jobs/${jobId}/run`} method="post" className="space-y-3">
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Pharmacist context (optional)
        </label>
        <textarea
          className="glass-input h-20 w-full resize-none"
          name="feedback"
          placeholder="Example: prioritize lower osmolality and tighten BUD assumptions."
        />
        <button
          className="pill-btn w-full disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={jobStatus === "approved"}
        >
          Run Deterministic Pipeline (max 3 iterations)
        </button>
      </form>

      <form action="/api/signature/pin" method="post" className="space-y-3">
        <input type="hidden" name="redirectTo" value={`/dashboard/jobs/${jobId}`} />
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Set or update signature PIN
        </label>
        <input
          className="glass-input w-full"
          type="password"
          name="signaturePin"
          placeholder="Minimum 8 characters"
          minLength={8}
          required
        />
        <input
          className="glass-input w-full"
          type="password"
          name="confirmSignaturePin"
          placeholder="Confirm signature PIN"
          minLength={8}
          required
        />
        <button className="pill-btn pill-btn-secondary w-full" type="submit">
          Save Signature PIN
        </button>
      </form>

      <form action={`/api/jobs/${jobId}/signing-intent`} method="post" className="space-y-3">
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Signature meaning
        </label>
        <select
          className="glass-input w-full"
          name="signatureMeaning"
          defaultValue={signingIntent?.signatureMeaning ?? "reviewed_and_approved"}
          disabled={jobStatus !== "verified"}
        >
          <option value="reviewed_and_approved">Reviewed and approved</option>
          <option value="verified_by">Verified by</option>
          <option value="compounded_by">Compounded by</option>
        </select>
        <button
          className="pill-btn pill-btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={jobStatus !== "verified"}
        >
          Generate One-Time Signing Challenge
        </button>
      </form>

      {signingIntent ? (
        <div className="space-y-2 rounded-2xl border border-white/60 bg-white/30 p-3">
          <p className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
            Active signing challenge
          </p>
          <p className="text-sm text-slate-700">
            Meaning: <span className="font-semibold">{signingIntent.signatureMeaning.replaceAll("_", " ")}</span>
          </p>
          <p className="text-sm text-slate-700">
            Code: <span className="font-mono text-base font-semibold">{signingIntent.challengeCode}</span>
          </p>
          <p className="text-xs text-slate-600">
            Expires {new Date(signingIntent.expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-800">
          Generate a one-time signing challenge before approval.
        </p>
      )}

      <form action={`/api/jobs/${jobId}/approve`} method="post" className="space-y-3">
        <input
          type="hidden"
          name="signatureMeaning"
          value={signingIntent?.signatureMeaning ?? "reviewed_and_approved"}
        />
        <input type="hidden" name="signingIntentId" value={signingIntent?.intentId ?? ""} />
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Re-enter one-time challenge code
        </label>
        <input
          className="glass-input w-full font-mono"
          type="text"
          name="signingChallengeCode"
          placeholder="Enter challenge code"
          disabled={!approvalEnabled}
          required={approvalEnabled}
        />
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Signature PIN
        </label>
        <input
          className="glass-input w-full"
          type="password"
          name="signaturePin"
          placeholder="Enter your signature PIN"
          disabled={!approvalEnabled}
          required={approvalEnabled}
        />
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Approval note (optional)
        </label>
        <input
          className="glass-input w-full"
          type="text"
          name="note"
          placeholder="Approved after final review."
          disabled={!approvalEnabled}
        />
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            name="signatureAttestation"
            className="mt-0.5"
            disabled={!approvalEnabled}
            required={approvalEnabled}
          />
          I attest this electronic signature is legally binding for this compounding record.
        </label>
        <button
          className="pill-btn w-full disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={!approvalEnabled}
        >
          Approve + Generate Final Label
        </button>
      </form>

      <form action={`/api/jobs/${jobId}/reject`} method="post" className="space-y-3">
        <label className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase">
          Rejection reason
        </label>
        <textarea
          className="glass-input h-16 w-full resize-none"
          name="feedback"
          placeholder="Required: describe issue found during pharmacist review."
          required
        />
        <button
          className="pill-btn pill-btn-danger w-full disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={jobStatus === "approved"}
        >
          Reject Job
        </button>
      </form>
    </GlassCard>
  );
}
