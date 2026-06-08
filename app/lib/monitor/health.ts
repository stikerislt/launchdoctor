/**
 * Store Monitor health model.
 *
 * The monitor is a layer over data the audit pipeline already produces — it
 * does NOT re-collect the store. `extractHealth` turns one completed audit into
 * a compact HealthSnapshot; `computeHealthAlerts` diffs two snapshots to surface
 * "what changed" (the drop-alert engine). This module is pure (no server-only
 * imports) so it can run in the loader and render on the client.
 */

export interface CatalogHealth {
  brokenCompareAt: number; // count
  duplicatePairs: number; // count
  missingSkuPct: number;
  untrackedInventoryPct: number;
  thinDescriptionPct: number;
  noImagePct: number;
  missingAltPct: number;
  heavyImagePct: number;
  missingSeoPct: number;
}

export interface HealthSnapshot {
  auditId: string;
  capturedAt: string | null;
  launchScore: number | null;
  seoScore: number | null;
  criticalCount: number;
  highCount: number;
  performance: number | null;
  performanceSource: "pagespeed" | null;
  productCount: number;
  catalog: CatalogHealth;
}

interface SnapshotStats {
  thinDescPct?: number;
  noImagePct?: number;
  missingAltPct?: number;
  noSkuPct?: number;
  inventoryOffPct?: number;
  heavyImagePct?: number;
  missingProductSeoPct?: number;
  compareAtBrokenCount?: number;
  duplicatePairCount?: number;
}

interface SnapshotShape {
  products?: { total?: number; stats?: SnapshotStats };
  mobile?: {
    lighthousePerformance?: number | null;
    performanceSource?: "pagespeed" | null;
  };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function readCatalogHealth(snapshot: unknown): {
  productCount: number;
  performance: number | null;
  performanceSource: "pagespeed" | null;
  catalog: CatalogHealth;
} {
  const snap = (snapshot ?? {}) as SnapshotShape;
  const stats = snap.products?.stats ?? {};

  return {
    productCount: num(snap.products?.total),
    performance:
      typeof snap.mobile?.lighthousePerformance === "number"
        ? snap.mobile.lighthousePerformance
        : null,
    performanceSource:
      snap.mobile?.performanceSource === "pagespeed" ? "pagespeed" : null,
    catalog: {
      brokenCompareAt: num(stats.compareAtBrokenCount),
      duplicatePairs: num(stats.duplicatePairCount),
      missingSkuPct: num(stats.noSkuPct),
      untrackedInventoryPct: num(stats.inventoryOffPct),
      thinDescriptionPct: num(stats.thinDescPct),
      noImagePct: num(stats.noImagePct),
      missingAltPct: num(stats.missingAltPct),
      heavyImagePct: num(stats.heavyImagePct),
      missingSeoPct: num(stats.missingProductSeoPct),
    },
  };
}

export interface AuditLike {
  id: string;
  completedAt: Date | string | null;
  launchScore: number | null;
  seoScore?: number | null;
  snapshot: unknown;
  findings: Array<{ severity: string }>;
}

export function extractHealth(audit: AuditLike): HealthSnapshot {
  const { productCount, performance, performanceSource, catalog } =
    readCatalogHealth(audit.snapshot);
  let criticalCount = 0;
  let highCount = 0;
  for (const finding of audit.findings) {
    if (finding.severity === "CRITICAL") criticalCount += 1;
    else if (finding.severity === "HIGH") highCount += 1;
  }

  return {
    auditId: audit.id,
    capturedAt:
      audit.completedAt instanceof Date
        ? audit.completedAt.toISOString()
        : (audit.completedAt ?? null),
    launchScore: audit.launchScore,
    seoScore: audit.seoScore ?? null,
    criticalCount,
    highCount,
    performance,
    performanceSource,
    productCount,
    catalog,
  };
}

export type AlertTone = "critical" | "warning" | "success" | "info";

export interface HealthAlert {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
}

const SCORE_DELTA_THRESHOLD = 3;
const PERF_DELTA_THRESHOLD = 8;

/**
 * Diff the two most recent monitor snapshots into merchant-facing alerts.
 * Regressions are surfaced loudly; clear improvements get a positive note so
 * the subscription feels rewarding, not just alarming.
 */
export function computeHealthAlerts(
  latest: HealthSnapshot,
  previous: HealthSnapshot | null,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  if (!previous) {
    alerts.push({
      id: "baseline",
      tone: "info",
      title: "Baseline recorded",
      detail:
        "This is your first monitored scan. Future scans will be compared against it to flag anything that changes.",
    });
    return alerts;
  }

  // Launch score movement.
  if (latest.launchScore != null && previous.launchScore != null) {
    const delta = latest.launchScore - previous.launchScore;
    if (delta <= -SCORE_DELTA_THRESHOLD) {
      alerts.push({
        id: "score-drop",
        tone: "warning",
        title: `Launch score dropped ${Math.abs(delta)} points`,
        detail: `Down from ${previous.launchScore} to ${latest.launchScore} since the last scan.`,
      });
    } else if (delta >= SCORE_DELTA_THRESHOLD) {
      alerts.push({
        id: "score-rise",
        tone: "success",
        title: `Launch score improved ${delta} points`,
        detail: `Up from ${previous.launchScore} to ${latest.launchScore}. Nice work.`,
      });
    }
  }

  // New critical issues.
  const criticalDelta = latest.criticalCount - previous.criticalCount;
  if (criticalDelta > 0) {
    alerts.push({
      id: "new-criticals",
      tone: "critical",
      title: `${criticalDelta} new critical issue${criticalDelta === 1 ? "" : "s"}`,
      detail: `Critical issues went from ${previous.criticalCount} to ${latest.criticalCount}. Review your latest report.`,
    });
  } else if (criticalDelta < 0 && latest.criticalCount === 0) {
    alerts.push({
      id: "criticals-cleared",
      tone: "success",
      title: "All critical issues resolved",
      detail: "No critical issues remain as of the latest scan.",
    });
  }

  // Performance regression.
  if (latest.performance != null && previous.performance != null) {
    const delta = latest.performance - previous.performance;
    if (delta <= -PERF_DELTA_THRESHOLD) {
      alerts.push({
        id: "perf-drop",
        tone: "warning",
        title: `Mobile performance dropped ${Math.abs(delta)} points`,
        detail: `PageSpeed mobile score fell from ${previous.performance} to ${latest.performance} — often caused by a new app, theme change, or heavier images.`,
      });
    }
  }

  // Catalog regressions.
  if (latest.catalog.brokenCompareAt > previous.catalog.brokenCompareAt) {
    alerts.push({
      id: "compare-at",
      tone: "warning",
      title: "More broken sale prices",
      detail: `Products with a compare-at price below the selling price rose from ${previous.catalog.brokenCompareAt} to ${latest.catalog.brokenCompareAt}.`,
    });
  }

  const inventoryDelta =
    latest.catalog.untrackedInventoryPct - previous.catalog.untrackedInventoryPct;
  if (inventoryDelta >= 10) {
    alerts.push({
      id: "inventory",
      tone: "warning",
      title: "More products without inventory tracking",
      detail: `Untracked inventory rose to ${latest.catalog.untrackedInventoryPct.toFixed(0)}% of variants — you risk overselling.`,
    });
  }

  const noImageDelta =
    latest.catalog.noImagePct - previous.catalog.noImagePct;
  if (noImageDelta >= 5) {
    alerts.push({
      id: "no-image",
      tone: "warning",
      title: "More products without an image",
      detail: `Products with no image rose to ${latest.catalog.noImagePct.toFixed(0)}% of your catalog — image-less products rarely convert and can be hidden by themes.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "stable",
      tone: "success",
      title: "No regressions detected",
      detail: "Your store health is stable since the last scan.",
    });
  }

  return alerts;
}

export interface CatalogMetricRow {
  label: string;
  value: string;
  /** True when this metric indicates a problem worth attention. */
  attention: boolean;
}

export function catalogMetricRows(snapshot: HealthSnapshot): CatalogMetricRow[] {
  const c = snapshot.catalog;
  const pct = (v: number) => `${v.toFixed(0)}%`;
  return [
    { label: "Broken sale prices", value: String(c.brokenCompareAt), attention: c.brokenCompareAt > 0 },
    { label: "Duplicate product pairs", value: String(c.duplicatePairs), attention: c.duplicatePairs > 0 },
    { label: "Missing SKUs", value: pct(c.missingSkuPct), attention: c.missingSkuPct > 25 },
    { label: "Untracked inventory", value: pct(c.untrackedInventoryPct), attention: c.untrackedInventoryPct > 50 },
    { label: "Thin descriptions", value: pct(c.thinDescriptionPct), attention: c.thinDescriptionPct > 25 },
    { label: "Products with no image", value: pct(c.noImagePct), attention: c.noImagePct > 5 },
    { label: "Images missing alt text", value: pct(c.missingAltPct), attention: c.missingAltPct > 25 },
    { label: "Oversized images", value: pct(c.heavyImagePct), attention: c.heavyImagePct > 25 },
    { label: "Missing product SEO", value: pct(c.missingSeoPct), attention: c.missingSeoPct > 25 },
  ];
}
