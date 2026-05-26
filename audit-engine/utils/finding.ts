import type { Category, Finding, Severity, StoreSnapshot } from "../types";

interface FindingInput {
  snap: StoreSnapshot;
  ruleId: number;
  ruleCode: string;
  category: Category;
  severity: Severity;
  title: string;
  body: string;
  fixSteps: string[];
  fixDeepLink: string | null;
  evidence?: Record<string, unknown> | null;
  confidence?: number;
}

export function createFinding(input: FindingInput): Finding {
  return {
    ruleId: input.ruleId,
    ruleCode: input.ruleCode,
    severity: input.severity,
    category: input.category,
    title: input.title,
    body: input.body,
    fixSteps: input.fixSteps,
    fixDeepLink: input.fixDeepLink,
    evidence: input.evidence ?? null,
    confidence: input.confidence ?? 1.0,
  };
}
