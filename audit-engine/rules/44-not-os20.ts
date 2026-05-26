import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const thmNotOs20Rule: Rule = {
  id: 44,
  code: "THM_NOT_OS20",
  category: Category.MOBILE_THEME,
  severity: Severity.HIGH,
  title: "Theme is not Online Store 2.0",
  description: "Main theme has no templates/*.json (legacy Liquid only).",
  evaluate(snap) {
    if (snap.theme.isOnlineStore20) return null;
    return createFinding({
      snap,
      ruleId: 44,
      ruleCode: "THM_NOT_OS20",
      category: Category.MOBILE_THEME,
      severity: Severity.HIGH,
      title: "Theme is not Online Store 2.0",
      body: "Your theme uses legacy Liquid sections without JSON templates. Online Store 2.0 themes offer better performance, customization, and app block support.",
      fixSteps: getFixSteps("THM_NOT_OS20"),
      fixDeepLink: themesLink(snap.shop.handle),
    });
  },
};
