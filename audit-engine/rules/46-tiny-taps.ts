import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const thmTinyTapsRule: Rule = {
  id: 46,
  code: "THM_TINY_TAPS",
  category: Category.MOBILE_THEME,
  severity: Severity.HIGH,
  title: "Tap targets too small on mobile",
  description: "PDP add-to-cart or variant button smaller than 44×44px.",
  evaluate(snap) {
    const size = snap.mobile.smallestTapTargetPx;
    if (size === null || size >= 44) return null;
    return createFinding({
      snap,
      ruleId: 46,
      ruleCode: "THM_TINY_TAPS",
      category: Category.MOBILE_THEME,
      severity: Severity.HIGH,
      title: "Tap targets too small on mobile",
      body: `Your smallest tap target on the product page is ${size}px. Apple and Google recommend minimum 44×44px for touch targets.`,
      fixSteps: getFixSteps("THM_TINY_TAPS"),
      fixDeepLink: themesLink(snap.shop.handle),
      evidence: { smallestTapTargetPx: size },
    });
  },
};
