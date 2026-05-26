import type { Finding, StoreSnapshot } from "./types";
import { Severity } from "./types";
import { allRules } from "./rules";

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  [Severity.CRITICAL]: 15,
  [Severity.HIGH]: 6,
  [Severity.MEDIUM]: 2,
  [Severity.LOW]: 0.5,
};

/** Findings that affect search visibility — weighted into the SEO pillar of Launch Score. */
export const SEO_SCORE_RULE_CODES = new Set<string>([
  "SEO_DEFAULT_TITLE",
  "SEO_NO_META_DESC",
  "SEO_ROBOTS_BLOCKED",
  "SEO_NO_SITEMAP",
  "SEO_NO_CUSTOM_DOMAIN",
  "SEO_HEAVY_IMAGES",
  "SEO_PRODUCT_META",
  "SEO_HANDLE_NOISE",
  "PROD_MISSING_ALT",
  "PROD_THIN_DESC",
]);

const CORE_SCORE_WEIGHT = 0.65;
const SEO_SCORE_WEIGHT = 0.35;

export function runRules(snapshot: StoreSnapshot): Finding[] {
  const findings: Finding[] = [];

  for (const rule of allRules) {
    const result = rule.evaluate(snapshot);
    if (result && result.confidence > 0) {
      findings.push(result);
    }
  }

  return findings.sort((a, b) => {
    const severityOrder = {
      [Severity.CRITICAL]: 0,
      [Severity.HIGH]: 1,
      [Severity.MEDIUM]: 2,
      [Severity.LOW]: 3,
    };
    const diff = severityOrder[a.severity] - severityOrder[b.severity];
    if (diff !== 0) return diff;
    return a.ruleId - b.ruleId;
  });
}

export type ScoreFinding = {
  ruleCode: string;
  severity: Severity | `${Severity}`;
};

function pillarRules(seoPillar: boolean) {
  return allRules.filter((rule) =>
    seoPillar
      ? SEO_SCORE_RULE_CODES.has(rule.code)
      : !SEO_SCORE_RULE_CODES.has(rule.code),
  );
}

/** Share of weighted checks passed in a pillar — avoids flat 0 scores on messy stores. */
function scorePillar(findings: ReadonlyArray<ScoreFinding>, rules: typeof allRules): number {
  const failed = new Set(findings.map((finding) => finding.ruleCode));
  let failedWeight = 0;
  let totalWeight = 0;

  for (const rule of rules) {
    const weight = SEVERITY_WEIGHTS[rule.severity as Severity];
    totalWeight += weight;
    if (failed.has(rule.code)) {
      failedWeight += weight;
    }
  }

  if (totalWeight === 0) return 100;
  return Math.round(100 * (1 - failedWeight / totalWeight));
}

export function computeSeoScore(findings: ReadonlyArray<ScoreFinding>): number {
  return scorePillar(findings, pillarRules(true));
}

export function computeCoreScore(findings: ReadonlyArray<ScoreFinding>): number {
  return scorePillar(findings, pillarRules(false));
}

export function computeLaunchScore(findings: ReadonlyArray<ScoreFinding>): number {
  const coreScore = computeCoreScore(findings);
  const seoScore = computeSeoScore(findings);

  return Math.max(
    0,
    Math.round(coreScore * CORE_SCORE_WEIGHT + seoScore * SEO_SCORE_WEIGHT),
  );
}

export function computeAllScores(findings: ReadonlyArray<ScoreFinding>) {
  const coreScore = computeCoreScore(findings);
  const seoScore = computeSeoScore(findings);
  const launchScore = Math.max(
    0,
    Math.round(coreScore * CORE_SCORE_WEIGHT + seoScore * SEO_SCORE_WEIGHT),
  );

  return { launchScore, coreScore, seoScore };
}

export function runAllowlistedRules(
  snapshot: StoreSnapshot,
  allowedCodes: string[],
): Finding[] {
  const allowed = new Set(allowedCodes);
  return runRules(snapshot).filter((f) => allowed.has(f.ruleCode));
}

export { SEVERITY_WEIGHTS };
