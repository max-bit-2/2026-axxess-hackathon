export interface CitationTableRow {
  field: string;
  value: string;
  usedInCalculation: boolean;
}

export interface CitationExtractionResult {
  rows: CitationTableRow[];
  warnings: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function compactText(value: string) {
  if (!value) return "N/A";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "N/A";
  return normalized;
}

function summarizeArray(values: unknown[], limit = 4) {
  const items = values
    .map((value) => asString(value).trim())
    .filter((value) => value.length > 0)
    .slice(0, limit);
  if (!items.length) return "N/A";
  return items.join(", ");
}

function summarizeTextArray(value: unknown) {
  return summarizeArray(asArray(value).map((item) => compactText(asString(item))));
}

function pushRow(
  rows: CitationTableRow[],
  field: string,
  value: string,
  usedInCalculation: boolean,
) {
  rows.push({
    field,
    value: value && value.trim().length > 0 ? value : "N/A",
    usedInCalculation,
  });
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error("Response was not JSON.");
  }
  return response.json() as Promise<unknown>;
}

function buildDailyMedFallbackUrls(url: string) {
  try {
    const parsed = new URL(url);
    const setId = parsed.searchParams.get("setid");
    if (!setId) return [];
    return [
      `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?setid=${encodeURIComponent(setId)}`,
      `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${encodeURIComponent(setId)}.json`,
    ];
  } catch {
    return [];
  }
}

function extractRxNavRows(payload: unknown) {
  const rows: CitationTableRow[] = [];
  const properties = asRecord(asRecord(payload).properties);
  pushRow(rows, "RXCUI", asString(properties.rxcui), true);
  pushRow(rows, "NORMALIZED_NAME", asString(properties.name), true);
  pushRow(rows, "SYNONYM", asString(properties.synonym), false);
  pushRow(rows, "TERM_TYPE", asString(properties.tty), false);
  pushRow(rows, "LANGUAGE", asString(properties.language), false);
  pushRow(rows, "SUPPRESSED", asString(properties.suppress), false);
  pushRow(rows, "UMLS_CUI", asString(properties.umlscui), false);
  return rows;
}

function extractOpenFdaNdcRows(payload: unknown) {
  const rows: CitationTableRow[] = [];
  const firstResult = asRecord(asArray(asRecord(payload).results)[0]);
  const openFda = asRecord(firstResult.openfda);

  pushRow(rows, "PRODUCT_NDC", asString(firstResult.product_ndc), false);
  pushRow(rows, "GENERIC_NAME", asString(firstResult.generic_name), true);
  pushRow(rows, "BRAND_NAME_BASE", asString(firstResult.brand_name), false);
  pushRow(rows, "LABELER_NAME", asString(firstResult.labeler_name), false);
  pushRow(rows, "DOSAGE_FORM", asString(firstResult.dosage_form), true);
  pushRow(rows, "ROUTE", summarizeArray(asArray(firstResult.route)), true);
  pushRow(rows, "PRODUCT_TYPE", asString(firstResult.product_type), false);
  pushRow(rows, "MARKETING_CATEGORY", asString(firstResult.marketing_category), false);
  pushRow(rows, "APPLICATION_NUMBER", asString(firstResult.application_number), false);
  pushRow(rows, "MARKETING_START_DATE", asString(firstResult.marketing_start_date), false);
  pushRow(rows, "LISTING_EXPIRATION_DATE", asString(firstResult.listing_expiration_date), false);
  pushRow(rows, "FINISHED", String(Boolean(firstResult.finished)), false);

  const activeIngredients = asArray(firstResult.active_ingredients).map((item) => asRecord(item));
  pushRow(
    rows,
    "ACTIVE_INGREDIENTS",
    summarizeArray(activeIngredients.map((item) => asString(item.name))),
    true,
  );
  pushRow(
    rows,
    "ACTIVE_INGREDIENT_STRENGTHS",
    summarizeArray(activeIngredients.map((item) => asString(item.strength))),
    true,
  );
  pushRow(rows, "PHARM_CLASS_EPC", summarizeArray(asArray(openFda.pharm_class_epc)), false);
  pushRow(rows, "PHARM_CLASS_MOA", summarizeArray(asArray(openFda.pharm_class_moa)), false);
  pushRow(rows, "RXCUI", summarizeArray(asArray(openFda.rxcui)), true);
  pushRow(rows, "UPC", summarizeArray(asArray(firstResult.upc)), false);
  pushRow(rows, "IS_ORIGINAL_PACKAGER", String(Boolean(firstResult.is_original_packager)), false);

  const packaging = asArray(firstResult.packaging)
    .map((item) => asRecord(item))
    .map((item) => {
      const packageNdc = asString(item.package_ndc);
      const description = asString(item.description);
      return [packageNdc, description].filter(Boolean).join(" - ");
    });
  pushRow(rows, "PACKAGING", summarizeArray(packaging), false);

  return rows;
}

function extractOpenFdaLabelRows(payload: unknown) {
  const rows: CitationTableRow[] = [];
  const firstResult = asRecord(asArray(asRecord(payload).results)[0]);
  const openFda = asRecord(firstResult.openfda);

  pushRow(rows, "GENERIC_NAME", summarizeArray(asArray(openFda.generic_name)), true);
  pushRow(rows, "BRAND_NAME", summarizeArray(asArray(openFda.brand_name)), false);
  pushRow(rows, "ROUTE", summarizeArray(asArray(openFda.route)), true);
  pushRow(rows, "DOSAGE_FORM", summarizeArray(asArray(openFda.dosage_form)), true);
  pushRow(rows, "SUBSTANCE_NAME", summarizeArray(asArray(openFda.substance_name)), true);
  pushRow(rows, "PRODUCT_TYPE", summarizeArray(asArray(openFda.product_type)), false);
  pushRow(rows, "RXCUI", summarizeArray(asArray(openFda.rxcui)), true);
  pushRow(rows, "SPL_SET_ID", summarizeArray(asArray(openFda.spl_set_id)), false);
  pushRow(rows, "DOSAGE_AND_ADMINISTRATION", summarizeTextArray(firstResult.dosage_and_administration), true);
  pushRow(rows, "DRUG_INTERACTIONS", summarizeTextArray(firstResult.drug_interactions), true);
  pushRow(rows, "CONTRAINDICATIONS", summarizeTextArray(firstResult.contraindications), true);
  pushRow(rows, "WARNINGS", summarizeTextArray(firstResult.warnings), true);
  pushRow(rows, "PEDIATRIC_USE", summarizeTextArray(firstResult.pediatric_use), true);

  return rows;
}

function extractDailyMedRows(payload: unknown) {
  const rows: CitationTableRow[] = [];
  const firstItem = asRecord(asArray(asRecord(payload).data)[0]);
  pushRow(rows, "SETID", asString(firstItem.setid), false);
  pushRow(rows, "TITLE", asString(firstItem.title), true);
  pushRow(rows, "PUBLISHED_DATE", asString(firstItem.published_date), false);
  return rows;
}

export async function extractCitationTableData(params: {
  source: string;
  url: string;
}): Promise<CitationExtractionResult> {
  const source = params.source.toLowerCase();
  const warnings: string[] = [];

  if (!params.url) {
    return {
      rows: [],
      warnings: ["Citation URL is missing."],
    };
  }

  let payload: unknown | null = null;
  const attemptedUrls = [params.url];
  if (source === "dailymed") {
    attemptedUrls.push(...buildDailyMedFallbackUrls(params.url));
  }

  let lastError: unknown = null;
  for (const attemptedUrl of attemptedUrls) {
    try {
      payload = await fetchJson(attemptedUrl);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!payload) {
    return {
      rows: [],
      warnings: [
        `Unable to fetch citation payload: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
      ],
    };
  }

  const endpoint = (() => {
    try {
      return new URL(params.url).pathname;
    } catch {
      return "";
    }
  })();

  const rows =
    source === "rxnav"
      ? extractRxNavRows(payload)
      : source === "openfda" && endpoint.includes("/drug/ndc")
        ? extractOpenFdaNdcRows(payload)
        : source === "openfda"
          ? extractOpenFdaLabelRows(payload)
          : source === "dailymed"
            ? extractDailyMedRows(payload)
            : [];

  if (!rows.length) {
    warnings.push("No structured fields were extracted for this citation.");
  }

  if (rows.some((row) => row.usedInCalculation && row.value === "N/A")) {
    warnings.push("Some fields are unavailable in this API response.");
  }

  return { rows, warnings };
}
