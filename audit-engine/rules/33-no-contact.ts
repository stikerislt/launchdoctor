import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { generalLink } from "../utils/deep-link";

export const trustNoContactRule: Rule = {
  id: 33,
  code: "TRUST_NO_CONTACT",
  category: Category.TRUST_SIGNALS,
  severity: Severity.CRITICAL,
  title: "No contact information available",
  description: "No contact page and shop.contactEmail is empty.",
  evaluate(snap) {
    if (snap.pages.contact || snap.shop.contactEmail) return null;
    return createFinding({
      snap,
      ruleId: 33,
      ruleCode: "TRUST_NO_CONTACT",
      category: Category.TRUST_SIGNALS,
      severity: Severity.CRITICAL,
      title: "No contact information available",
      body: "Customers cannot reach you — no contact page and no contact email set. This is a major trust red flag.",
      fixSteps: getFixSteps("TRUST_NO_CONTACT"),
      fixDeepLink: generalLink(snap.shop.handle),
    });
  },
};
