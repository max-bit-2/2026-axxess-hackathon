import { env } from "@/lib/env";
import type {
  MedicationCitation,
  MedicationReferenceSnapshot,
  ReferenceStatus,
} from "@/lib/medivance/types";

const OPENFDA_BASE_URL = "https://api.fda.gov";
const DAILYMED_PUBLIC_URL = "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm";

interface RxNormIdGroupResponse {
  idGroup?: {
    rxnormId?: string[];
  };
}

interface RxNormPropertiesResponse {
  properties?: {
    rxcui?: string;
    name?: string;
  };
}

interface OpenFdaLabelResponse {
  meta?: {
    results?: {
      total?: number;
    };
  };
  results?: Array<{
    set_id?: string;
  }>;
  error?: {
    message?: string;
  };
}

interface OpenFdaNdcResponse {
  meta?: {
    results?: {
      total?: number;
    };
  };
  results?: Array<{
    product_ndc?: string;
    generic_name?: string;
    brand_name?: string;
  }>;
  error?: {
    message?: string;
  };
}

interface DailyMedSplResponse {
  data?: Array<{
    setid?: string;
    title?: string;
    published_date?: string;
  }>;
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toSafeMedicationName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function formatOpenFdaMedicationTerm(value: string) {
  return value.replaceAll("\"", '\\"');
}

async function fetchJson<T>(url: string) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchRxNormReference(medicationName: string): Promise<{
  status: ReferenceStatus;
  rxNormId: string | null;
  rxNormName: string | null;
  citation: MedicationCitation | null;
  warnings: string[];
}> {
  const baseUrl = trimTrailingSlash(env.rxNavBaseUrl);
  const lookupUrl = `${baseUrl}/rxcui.json?name=${encodeURIComponent(medicationName)}`;
  const lookupPayload = await fetchJson<RxNormIdGroupResponse>(lookupUrl);

  if (!lookupPayload) {
    return {
      status: "error",
      rxNormId: null,
      rxNormName: null,
      citation: null,
      warnings: ["RxNav lookup failed or timed out."],
    };
  }

  const rxNormId = lookupPayload.idGroup?.rxnormId?.[0] ?? null;
  if (!rxNormId) {
    return {
      status: "missing",
      rxNormId: null,
      rxNormName: null,
      citation: null,
      warnings: [`RxNav could not normalize "${medicationName}" to an RxCUI.`],
    };
  }

  const propertiesUrl = `${baseUrl}/rxcui/${rxNormId}/properties.json`;
  const propertiesPayload = await fetchJson<RxNormPropertiesResponse>(propertiesUrl);
  const rxNormName = propertiesPayload?.properties?.name ?? medicationName;

  return {
    status: "ok",
    rxNormId,
    rxNormName,
    citation: {
      source: "rxnav",
      title: `RxNav RxCUI ${rxNormId}`,
      url: propertiesUrl,
      detail: `Normalized name: ${rxNormName}.`,
    },
    warnings: [],
  };
}

async function fetchOpenFdaReference(medicationName: string): Promise<{
  status: ReferenceStatus;
  interactionLabelCount: number;
  sampleSetId: string | null;
  citation: MedicationCitation | null;
  warnings: string[];
}> {
  const endpoint = new URL("/drug/label.json", OPENFDA_BASE_URL);
  endpoint.searchParams.set(
    "search",
    `openfda.generic_name:"${formatOpenFdaMedicationTerm(medicationName)}" AND _exists_:drug_interactions`,
  );
  endpoint.searchParams.set("limit", "1");
  if (env.openFdaApiKey) {
    endpoint.searchParams.set("api_key", env.openFdaApiKey);
  }

  const payload = await fetchJson<OpenFdaLabelResponse>(endpoint.toString());
  if (!payload) {
    return {
      status: "error",
      interactionLabelCount: 0,
      sampleSetId: null,
      citation: null,
      warnings: ["openFDA lookup failed or timed out."],
    };
  }

  if (payload.error) {
    return {
      status: "missing",
      interactionLabelCount: 0,
      sampleSetId: null,
      citation: null,
      warnings: [
        payload.error.message
          ? `openFDA lookup returned: ${payload.error.message}`
          : "openFDA returned no matching label records.",
      ],
    };
  }

  const interactionLabelCount = Number(payload.meta?.results?.total ?? 0);
  const sampleSetId = payload.results?.[0]?.set_id ?? null;

  if (interactionLabelCount <= 0) {
    return {
      status: "missing",
      interactionLabelCount: 0,
      sampleSetId: null,
      citation: null,
      warnings: [`openFDA found no interaction labels for "${medicationName}".`],
    };
  }

  return {
    status: "ok",
    interactionLabelCount,
    sampleSetId,
    citation: {
      source: "openfda",
      title: `openFDA interaction labels (${interactionLabelCount})`,
      url: endpoint.toString(),
      detail: sampleSetId ? `Sample set_id: ${sampleSetId}.` : undefined,
    },
    warnings: [],
  };
}

async function fetchOpenFdaNdcReference(medicationName: string): Promise<{
  status: ReferenceStatus;
  ndcCount: number;
  productNdc: string | null;
  citation: MedicationCitation | null;
  warnings: string[];
}> {
  const endpoint = new URL("/drug/ndc.json", OPENFDA_BASE_URL);
  endpoint.searchParams.set(
    "search",
    `generic_name:"${formatOpenFdaMedicationTerm(medicationName)}"`,
  );
  endpoint.searchParams.set("limit", "1");
  if (env.openFdaApiKey) {
    endpoint.searchParams.set("api_key", env.openFdaApiKey);
  }

  const payload = await fetchJson<OpenFdaNdcResponse>(endpoint.toString());
  if (!payload) {
    return {
      status: "error",
      ndcCount: 0,
      productNdc: null,
      citation: null,
      warnings: ["openFDA NDC lookup failed or timed out."],
    };
  }

  if (payload.error) {
    return {
      status: "missing",
      ndcCount: 0,
      productNdc: null,
      citation: null,
      warnings: [
        payload.error.message
          ? `openFDA NDC lookup returned: ${payload.error.message}`
          : "openFDA NDC returned no matching records.",
      ],
    };
  }

  const ndcCount = Number(payload.meta?.results?.total ?? 0);
  const productNdc = payload.results?.[0]?.product_ndc ?? null;

  if (ndcCount <= 0) {
    return {
      status: "missing",
      ndcCount: 0,
      productNdc: null,
      citation: null,
      warnings: [`openFDA NDC found no records for "${medicationName}".`],
    };
  }

  return {
    status: "ok",
    ndcCount,
    productNdc,
    citation: {
      source: "openfda",
      title: `openFDA NDC directory match (${ndcCount})`,
      url: endpoint.toString(),
      detail: productNdc ? `Sample product_ndc: ${productNdc}.` : undefined,
    },
    warnings: [],
  };
}

async function fetchDailyMedReference(medicationName: string): Promise<{
  status: ReferenceStatus;
  setId: string | null;
  title: string | null;
  publishedDate: string | null;
  citation: MedicationCitation | null;
  warnings: string[];
}> {
  const baseUrl = trimTrailingSlash(env.dailyMedBaseUrl);
  const endpoint = `${baseUrl}/spls.json?drug_name=${encodeURIComponent(medicationName)}&pagesize=1`;
  const payload = await fetchJson<DailyMedSplResponse>(endpoint);
  if (!payload) {
    return {
      status: "error",
      setId: null,
      title: null,
      publishedDate: null,
      citation: null,
      warnings: ["DailyMed lookup failed or timed out."],
    };
  }

  const item = payload?.data?.[0];

  if (!item?.setid) {
    return {
      status: "missing",
      setId: null,
      title: null,
      publishedDate: null,
      citation: null,
      warnings: [`DailyMed found no SPL record for "${medicationName}".`],
    };
  }

  const setId = item.setid;
  const title = item.title ?? null;
  const publishedDate = item.published_date ?? null;
  const labelUrl = `${DAILYMED_PUBLIC_URL}?setid=${encodeURIComponent(setId)}`;

  return {
    status: "ok",
    setId,
    title,
    publishedDate,
    citation: {
      source: "dailymed",
      title: title ?? `DailyMed SPL ${setId}`,
      url: labelUrl,
      detail: publishedDate ? `Published: ${publishedDate}.` : undefined,
    },
    warnings: [],
  };
}

export async function fetchMedicationReferenceSnapshot(
  medicationName: string,
): Promise<MedicationReferenceSnapshot> {
  const normalizedMedication = toSafeMedicationName(medicationName);
  if (!normalizedMedication) {
    return {
      medicationName,
      rxNormStatus: "missing",
      rxNormId: null,
      rxNormName: null,
      openFdaStatus: "missing",
      openFdaInteractionLabelCount: 0,
      openFdaSampleSetId: null,
      openFdaNdcStatus: "missing",
      openFdaNdcCount: 0,
      openFdaNdcProductNdc: null,
      dailyMedStatus: "missing",
      dailyMedSetId: null,
      dailyMedTitle: null,
      dailyMedPublishedDate: null,
      citations: [],
      warnings: ["Medication name is empty; external reference lookup skipped."],
    };
  }

  const rxNorm = await fetchRxNormReference(normalizedMedication);
  const lookupName = rxNorm.rxNormName ?? normalizedMedication;

  const [openFda, openFdaNdc, dailyMed] = await Promise.all([
    fetchOpenFdaReference(lookupName),
    fetchOpenFdaNdcReference(lookupName),
    fetchDailyMedReference(lookupName),
  ]);

  const citations = [
    rxNorm.citation,
    openFda.citation,
    openFdaNdc.citation,
    dailyMed.citation,
  ].filter((citation): citation is MedicationCitation => Boolean(citation));
  const warnings = [
    ...rxNorm.warnings,
    ...openFda.warnings,
    ...openFdaNdc.warnings,
    ...dailyMed.warnings,
  ];

  return {
    medicationName: normalizedMedication,
    rxNormStatus: rxNorm.status,
    rxNormId: rxNorm.rxNormId,
    rxNormName: rxNorm.rxNormName,
    openFdaStatus: openFda.status,
    openFdaInteractionLabelCount: openFda.interactionLabelCount,
    openFdaSampleSetId: openFda.sampleSetId,
    openFdaNdcStatus: openFdaNdc.status,
    openFdaNdcCount: openFdaNdc.ndcCount,
    openFdaNdcProductNdc: openFdaNdc.productNdc,
    dailyMedStatus: dailyMed.status,
    dailyMedSetId: dailyMed.setId,
    dailyMedTitle: dailyMed.title,
    dailyMedPublishedDate: dailyMed.publishedDate,
    citations,
    warnings,
  };
}
