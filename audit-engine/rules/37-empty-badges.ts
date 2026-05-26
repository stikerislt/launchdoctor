import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const trustEmptyBadgesRule: Rule = {
  id: 37,
  code: "TRUST_EMPTY_BADGES",
  category: Category.TRUST_SIGNALS,
  severity: Severity.LOW,
  title: "Trust badges section is empty",
  description: "Trust badges section present but no enabled blocks.",
  evaluate(snap) {
    if (!snap.theme.sections.trustBadgesEmpty) return null;
    return createFinding({
      snap,
      ruleId: 37,
      ruleCode: "TRUST_EMPTY_BADGES",
      category: Category.TRUST_SIGNALS,
      severity: Severity.LOW,
      title: "Trust badges section is empty",
      body: "Your theme has a trust badges section but no badges are configured. Empty sections look unfinished.",
      fixSteps: getFixSteps("TRUST_EMPTY_BADGES"),
      fixDeepLink: themesLink(snap.shop.handle),
    });
  },
};
