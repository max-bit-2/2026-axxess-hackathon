import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { extractCitationTableData } from "@/lib/medivance/citation-extractor";

function decodeParam(value: string | undefined) {
  if (!value) return "";
  return value;
}

function formatSource(source: string) {
  if (source === "rxnav") return "RxNav (RxNorm)";
  if (source === "openfda") return "openFDA";
  if (source === "dailymed") return "DailyMed";
  return source || "Reference";
}

export default async function CitationReferencePage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    title?: string;
    detail?: string;
    url?: string;
    backTo?: string;
  }>;
}) {
  const { user } = await requireUser();
  const params = await searchParams;

  const source = decodeParam(params.source);
  const title = decodeParam(params.title);
  const detail = decodeParam(params.detail);
  const url = decodeParam(params.url);
  const backTo = decodeParam(params.backTo) || "/dashboard";

  const tableData = await extractCitationTableData({ source, url });
  const relevantRows = tableData.rows.filter((row) => row.usedInCalculation);
  const displayName = user.user_metadata.full_name ?? user.email ?? "Pharmacist";

  return (
    <AppShell userLabel={String(displayName)}>
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Citation Detail</h1>
          <Link
            href={backTo.startsWith("/") ? backTo : "/dashboard"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Source</p>
            <p className="text-sm font-semibold text-slate-900">{formatSource(source)}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Reference</p>
            <p className="text-base font-semibold text-[var(--color-primary)]">{title || "Untitled citation"}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
              Extracted Fields
            </p>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-slate-600 text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 text-left font-semibold">Field</th>
                    <th className="px-3 py-2 text-left font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {relevantRows.map((row) => (
                    <tr key={row.field} className="border-b last:border-b-0 border-slate-100 align-top">
                      <td className="px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{row.field}</td>
                      <td className="px-3 py-2 text-slate-900 whitespace-pre-wrap break-words">
                        <span>{row.value}</span>
                      </td>
                    </tr>
                  ))}
                  {!relevantRows.length ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-3 text-slate-500">
                        No calculation-relevant fields were found for this citation.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {tableData.warnings.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-amber-700 mb-1">Warnings</p>
              <ul className="text-xs text-amber-800 space-y-1">
                {tableData.warnings.map((warning) => (
                  <li key={warning}>- {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail ? (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Context</p>
              <p className="text-sm text-slate-700">{detail}</p>
            </div>
          ) : null}

          {url ? (
            <div className="pt-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-blue-600"
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                Open Raw Source
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
