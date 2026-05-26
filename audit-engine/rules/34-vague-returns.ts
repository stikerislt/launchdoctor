import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { policiesLink } from "../utils/deep-link";

export const trustVagueReturnsRule: Rule = {
  id: 34,
  code: "TRUST_VAGUE_RETURNS",
  category: Category.TRUST_SIGNALS,
  severity: Severity.HIGH,
  title: "Refund policy too vague",
  description: "Refund policy body has fewer than 50 words.",
  evaluate(snap) {
    const policy = snap.shop.policies.REFUND_POLICY;
    if (!policy) return null;
    const wordCount = policy.body.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 50) return null;
    return createFinding({
      snap,
      ruleId: 34,
      ruleCode: "TRUST_VAGUE_RETURNS",
      category: Category.TRUST_SIGNALS,
      severity: Severity.HIGH,
      title: "Refund policy too vague",
      body: `Your refund policy is only ${wordCount} words. Customers need clear return windows, conditions, and refund timelines.`,
      fixSteps: getFixSteps("TRUST_VAGUE_RETURNS"),
      fixDeepLink: policiesLink(snap.shop.handle),
      evidence: { wordCount },
    });
  },
};
