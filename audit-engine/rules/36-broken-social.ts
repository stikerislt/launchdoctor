import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const trustBrokenSocialRule: Rule = {
  id: 36,
  code: "TRUST_BROKEN_SOCIAL",
  category: Category.TRUST_SIGNALS,
  severity: Severity.MEDIUM,
  title: "Broken social media links",
  description: "Theme social URLs return non-200 on HEAD request.",
  evaluate(snap) {
    const broken = snap.theme.socialLinks.filter((l) => !l.reachable);
    if (broken.length === 0) return null;
    return createFinding({
      snap,
      ruleId: 36,
      ruleCode: "TRUST_BROKEN_SOCIAL",
      category: Category.TRUST_SIGNALS,
      severity: Severity.MEDIUM,
      title: "Broken social media links",
      body: `${broken.length} social media link(s) in your theme are broken or unreachable. Broken links erode customer trust.`,
      fixSteps: getFixSteps("TRUST_BROKEN_SOCIAL"),
      fixDeepLink: themesLink(snap.shop.handle),
      evidence: { broken: broken.map((l) => l.platform) },
    });
  },
};
