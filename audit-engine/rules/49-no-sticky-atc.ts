import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const thmNoStickyAtcRule: Rule = {
  id: 49,
  code: "THM_NO_STICKY_ATC",
  category: Category.MOBILE_THEME,
  severity: Severity.LOW,
  title: "No sticky add-to-cart on mobile",
  description: "No sticky add-to-cart bar on mobile PDP.",
  evaluate(snap) {
    if (snap.mobile.stickyAtcPresent === null) return null;
    if (snap.mobile.stickyAtcPresent) return null;
    return createFinding({
      snap,
      ruleId: 49,
      ruleCode: "THM_NO_STICKY_ATC",
      category: Category.MOBILE_THEME,
      severity: Severity.LOW,
      title: "No sticky add-to-cart on mobile",
      body: "Your product page has no sticky add-to-cart bar on mobile. Sticky ATC buttons improve conversion on long product pages.",
      fixSteps: getFixSteps("THM_NO_STICKY_ATC"),
      fixDeepLink: themesLink(snap.shop.handle),
    });
  },
};
