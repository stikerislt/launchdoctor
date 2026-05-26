export const PREVIEW_FINDING_COUNT = 5;

const LOCKED_BODY =
  "Unlock the full report to see what we detected and step-by-step fix instructions.";

export type SerializableFinding = {
  id: string;
  ruleId: number;
  ruleCode: string;
  severity: string;
  category: string;
  title: string;
  body: string;
  fixSteps: unknown;
  fixDeepLink: string | null;
  evidence: unknown;
  confidence: number;
};

export type SerializedFinding = {
  id: string;
  ruleId: number;
  ruleCode: string;
  severity: string;
  category: string;
  title: string;
  body: string;
  fixSteps: string[];
  fixDeepLink: string | null;
  evidence: Record<string, unknown> | null;
  confidence: number;
  locked: boolean;
};

function parseFixSteps(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function parseEvidence(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function serializeFindingForClient(
  finding: SerializableFinding,
  contentUnlocked: boolean,
  previewUnlockedIds?: ReadonlySet<string> | null,
  indexFallback = 0,
): SerializedFinding {
  const previewUnlocked =
    contentUnlocked ||
    (previewUnlockedIds
      ? previewUnlockedIds.has(finding.id)
      : indexFallback < PREVIEW_FINDING_COUNT);

  if (!previewUnlocked) {
    return {
      id: finding.id,
      ruleId: finding.ruleId,
      ruleCode: "LOCKED",
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      body: LOCKED_BODY,
      fixSteps: [],
      fixDeepLink: null,
      evidence: null,
      confidence: finding.confidence,
      locked: true,
    };
  }

  return {
    id: finding.id,
    ruleId: finding.ruleId,
    ruleCode: finding.ruleCode,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    body: finding.body,
    fixSteps: parseFixSteps(finding.fixSteps),
    fixDeepLink: finding.fixDeepLink,
    evidence: parseEvidence(finding.evidence),
    confidence: finding.confidence,
    locked: false,
  };
}
