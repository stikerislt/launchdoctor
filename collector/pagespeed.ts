/**
 * Google PageSpeed Insights API (Lighthouse mobile performance).
 * https://developers.google.com/speed/docs/insights/v5/get-started
 */

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_TIMEOUT_MS = 90_000;

export type PageSpeedResult = {
  score: number | null;
  measuredUrl: string;
  source: "pagespeed";
  error?: string;
};

/** Parse Lighthouse performance category (0–1) into a 0–100 score. */
export function parsePageSpeedPerformanceScore(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const lr = (data as { lighthouseResult?: { categories?: { performance?: { score?: unknown } } } })
    .lighthouseResult;
  const raw = lr?.categories?.performance?.score;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

function pageSpeedApiKey(): string | null {
  const key = process.env.PAGESPEED_API_KEY?.trim();
  return key || null;
}

/**
 * Fetch mobile performance score for a public storefront URL via PageSpeed Insights.
 * Returns null when the API key is missing, the URL is unreachable, or the store is
 * not scoreable (e.g. password page).
 */
export async function fetchPageSpeedMobileScore(
  storefrontUrl: string,
): Promise<PageSpeedResult> {
  const measuredUrl = storefrontUrl;
  const apiKey = pageSpeedApiKey();

  if (!apiKey) {
    console.warn(
      "[pagespeed] PAGESPEED_API_KEY is not set — mobile performance score will be omitted",
    );
    return { score: null, measuredUrl, source: "pagespeed", error: "missing_api_key" };
  }

  const params = new URLSearchParams({
    url: measuredUrl,
    strategy: "mobile",
    category: "performance",
    key: apiKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);

  try {
    const response = await fetch(`${PSI_ENDPOINT}?${params}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? String((body as { error?: { message?: string } }).error?.message ?? response.status)
          : `HTTP ${response.status}`;
      console.warn(`[pagespeed] API error for ${measuredUrl}: ${message}`);
      return { score: null, measuredUrl, source: "pagespeed", error: message };
    }

    const score = parsePageSpeedPerformanceScore(body);
    if (score === null) {
      console.warn(`[pagespeed] No performance score in response for ${measuredUrl}`);
      return { score: null, measuredUrl, source: "pagespeed", error: "no_score" };
    }

    return { score, measuredUrl, source: "pagespeed" };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "timeout"
          : err.message
        : String(err);
    console.warn(`[pagespeed] Failed for ${measuredUrl}: ${message}`);
    return { score: null, measuredUrl, source: "pagespeed", error: message };
  } finally {
    clearTimeout(timeout);
  }
}
