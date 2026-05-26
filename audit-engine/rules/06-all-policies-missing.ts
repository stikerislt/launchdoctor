import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { policiesLink } from "../utils/deep-link";

const REQUIRED_POLICIES = [
  "REFUND_POLICY",
  "PRIVACY_POLICY",
  "TERMS_OF_SERVICE",
  "SHIPPING_POLICY",
] as const;

export const polAllMissingRule: Rule = {
  id: 6,
  code: "POL_ALL_MISSING",
  category: Category.PAYMENTS_FRAUD,
  severity: Severity.CRITICAL,
  title: "Required legal policies missing",
  description: "Checks that refund, privacy, terms, and shipping policies exist.",
  evaluate(snap) {
    const missing = REQUIRED_POLICIES.filter((p) => !snap.shop.policies[p]);
    if (missing.length === 0) return null;
    return createFinding({
      snap,
      ruleId: 6,
      ruleCode: "POL_ALL_MISSING",
      category: Category.PAYMENTS_FRAUD,
      severity: Severity.CRITICAL,
      title: "Required legal policies missing",
      body: `Your store is missing required policies: ${missing.join(", ").replace(/_/g, " ")}. These are legally required in most jurisdictions.`,
      fixSteps: getFixSteps("POL_ALL_MISSING"),
      fixDeepLink: policiesLink(snap.shop.handle),
      evidence: { missing },
    });
  },
};
