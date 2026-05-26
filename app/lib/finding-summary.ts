import { SEO_SCORE_RULE_CODES } from "../../audit-engine/engine";
import { severityCounts } from "../components/SeverityBadge";

export function isSeoRuleCode(ruleCode: string): boolean {
  return SEO_SCORE_RULE_CODES.has(ruleCode);
}

export function partitionFindingsByPillar<
  T extends { ruleCode: string; severity: string },
>(findings: ReadonlyArray<T>) {
  const core: T[] = [];
  const seo: T[] = [];

  for (const finding of findings) {
    if (isSeoRuleCode(finding.ruleCode)) {
      seo.push(finding);
    } else {
      core.push(finding);
    }
  }

  return { core, seo };
}

export function pillarSeveritySummaries<
  T extends { ruleCode: string; severity: string },
>(findings: ReadonlyArray<T>) {
  const { core, seo } = partitionFindingsByPillar(findings);

  return {
    total: severityCounts([...findings]),
    core: severityCounts(core),
    seo: severityCounts(seo),
    coreCount: core.length,
    seoCount: seo.length,
    totalCount: findings.length,
  };
}

/** Free tier: up to 5 unlocked detail cards, preferring highest severity with some SEO representation. */
export function pickPreviewFindingIds<
  T extends { id: string; ruleCode: string; severity: string },
>(findings: ReadonlyArray<T>, limit = 5): string[] {
  if (findings.length <= limit) {
    return findings.map((f) => f.id);
  }

  const severityRank: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  const sorted = [...findings].sort(
    (a, b) =>
      (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9),
  );

  const picked: T[] = [];
  const pickedIds = new Set<string>();

  for (const finding of sorted) {
    if (picked.length >= limit) break;
    picked.push(finding);
    pickedIds.add(finding.id);
  }

  const seoCandidates = sorted.filter(
    (f) => isSeoRuleCode(f.ruleCode) && !pickedIds.has(f.id),
  );

  if (seoCandidates.length > 0 && !picked.some((f) => isSeoRuleCode(f.ruleCode))) {
    let swapIndex = -1;
    for (let i = picked.length - 1; i >= 0; i--) {
      if (picked[i]!.severity === "LOW") {
        swapIndex = i;
        break;
      }
    }
    if (swapIndex < 0) swapIndex = picked.length - 1;
    if (swapIndex >= 0) {
      pickedIds.delete(picked[swapIndex]!.id);
      picked[swapIndex] = seoCandidates[0]!;
      pickedIds.add(seoCandidates[0]!.id);
    }
  }

  return picked.slice(0, limit).map((f) => f.id);
}
