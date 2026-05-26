import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { pagesLink } from "../utils/deep-link";

export const trustNoFaqRule: Rule = {
  id: 35,
  code: "TRUST_NO_FAQ",
  category: Category.TRUST_SIGNALS,
  severity: Severity.MEDIUM,
  title: "No FAQ page found",
  description: "No FAQ page detected.",
  evaluate(snap) {
    if (snap.pages.faq) return null;
    return createFinding({
      snap,
      ruleId: 35,
      ruleCode: "TRUST_NO_FAQ",
      category: Category.TRUST_SIGNALS,
      severity: Severity.MEDIUM,
      title: "No FAQ page found",
      body: "Your store has no FAQ page. FAQs reduce support tickets and address common purchase objections.",
      fixSteps: getFixSteps("TRUST_NO_FAQ"),
      fixDeepLink: pagesLink(snap.shop.handle),
    });
  },
};
