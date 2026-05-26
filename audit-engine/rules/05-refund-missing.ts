import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { policiesLink } from "../utils/deep-link";

export const polRefundMissingRule: Rule = {
  id: 5,
  code: "POL_REFUND_MISSING",
  category: Category.PAYMENTS_FRAUD,
  severity: Severity.CRITICAL,
  title: "Refund policy missing or too short",
  description: "Checks for a refund policy with at least 50 characters.",
  evaluate(snap) {
    const policy = snap.shop.policies.REFUND_POLICY;
    if (policy && policy.body.length >= 50) return null;
    return createFinding({
      snap,
      ruleId: 5,
      ruleCode: "POL_REFUND_MISSING",
      category: Category.PAYMENTS_FRAUD,
      severity: Severity.CRITICAL,
      title: "Refund policy missing or too short",
      body: "Your refund policy is missing or too short. Customers and payment providers expect a clear returns policy before purchasing.",
      fixSteps: getFixSteps("POL_REFUND_MISSING"),
      fixDeepLink: policiesLink(snap.shop.handle),
      evidence: { bodyLength: policy?.body.length ?? 0 },
    });
  },
};
