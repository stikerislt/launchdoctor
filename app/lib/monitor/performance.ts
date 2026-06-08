import type { HealthSnapshot } from "./health";

export interface PageSpeedScanLike {
  score: number | null;
  measuredUrl: string | null;
  completedAt: Date | string | null;
}

export interface MonitorPerformanceView {
  score: number | null;
  source: "pagespeed" | null;
  measuredUrl: string | null;
  measuredAt: string | null;
}

/**
 * Store Monitor prefers the latest dedicated PageSpeed scan over audit snapshot
 * data (full audits no longer run PSI inline).
 */
export function resolveMonitorPerformance(
  latestHealth: HealthSnapshot | null,
  pageSpeed: PageSpeedScanLike | null,
): MonitorPerformanceView {
  if (pageSpeed?.score != null) {
    return {
      score: pageSpeed.score,
      source: "pagespeed",
      measuredUrl: pageSpeed.measuredUrl,
      measuredAt: formatMeasuredAt(pageSpeed.completedAt),
    };
  }

  if (latestHealth?.performance != null) {
    return {
      score: latestHealth.performance,
      source: latestHealth.performanceSource,
      measuredUrl: null,
      measuredAt: latestHealth.capturedAt,
    };
  }

  return {
    score: null,
    source: null,
    measuredUrl: null,
    measuredAt: null,
  };
}

function formatMeasuredAt(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
