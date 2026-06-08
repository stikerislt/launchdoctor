import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const thmLowLighthouseRule: Rule = {
  id: 45,
  code: "THM_LOW_LIGHTHOUSE",
  category: Category.MOBILE_THEME,
  severity: Severity.HIGH,
  title: "Poor mobile performance score",
  description: "Google PageSpeed Insights mobile performance score under 50.",
  evaluate(snap) {
    const score = snap.mobile.lighthousePerformance;
    if (score === null) return null;
    if (score >= 50) return null;
    return createFinding({
      snap,
      ruleId: 45,
      ruleCode: "THM_LOW_LIGHTHOUSE",
      category: Category.MOBILE_THEME,
      severity: Severity.HIGH,
      title: "Poor mobile performance score",
      body: `Your mobile PageSpeed performance score is ${score}/100 (Google Lighthouse, mobile). Slow pages increase bounce rate and hurt Google rankings.`,
      fixSteps: getFixSteps("THM_LOW_LIGHTHOUSE"),
      fixDeepLink: themesLink(snap.shop.handle),
      evidence: { score },
    });
  },
};
