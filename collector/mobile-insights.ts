import type { StoreSnapshot } from "../audit-engine/types";
import { runPlaywrightChecks, type MobileMetrics } from "./playwright-runner";

/**
 * Collect mobile theme DOM metrics during a full audit (Playwright only).
 * PageSpeed Insights runs in the dedicated Audit Plus PageSpeed tool instead.
 */
export async function collectMobileInsights(
  storefrontUrl: string,
): Promise<StoreSnapshot["mobile"]> {
  const playwright = await runPlaywrightChecks(storefrontUrl);
  return playwrightToSnapshotMobile(playwright);
}

export function playwrightToSnapshotMobile(
  playwright: MobileMetrics,
): StoreSnapshot["mobile"] {
  return {
    smallestTapTargetPx: playwright.smallestTapTargetPx,
    heroImageBytes: playwright.heroImageBytes,
    heroImageLazy: playwright.heroImageLazy,
    pdpDescriptionFontPx: playwright.pdpDescriptionFontPx,
    stickyAtcPresent: playwright.stickyAtcPresent,
    lighthousePerformance: null,
    performanceSource: null,
    performanceMeasuredUrl: null,
  };
}

/** Merge a dedicated PageSpeed scan score into snapshot-shaped mobile fields. */
export function pageSpeedToSnapshotMobile(
  score: number,
  measuredUrl: string,
): Pick<
  StoreSnapshot["mobile"],
  "lighthousePerformance" | "performanceSource" | "performanceMeasuredUrl"
> {
  return {
    lighthousePerformance: score,
    performanceSource: "pagespeed",
    performanceMeasuredUrl: measuredUrl,
  };
}
