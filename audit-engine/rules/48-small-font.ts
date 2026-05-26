import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const thmSmallFontRule: Rule = {
  id: 48,
  code: "THM_SMALL_FONT",
  category: Category.MOBILE_THEME,
  severity: Severity.MEDIUM,
  title: "Product description font too small on mobile",
  description: "Product description computed font-size under 14px on mobile.",
  evaluate(snap) {
    const fontPx = snap.mobile.pdpDescriptionFontPx;
    if (fontPx === null || fontPx >= 14) return null;
    return createFinding({
      snap,
      ruleId: 48,
      ruleCode: "THM_SMALL_FONT",
      category: Category.MOBILE_THEME,
      severity: Severity.MEDIUM,
      title: "Product description font too small on mobile",
      body: `Product description text is ${fontPx}px on mobile. Text under 14px is hard to read and fails accessibility guidelines.`,
      fixSteps: getFixSteps("THM_SMALL_FONT"),
      fixDeepLink: themesLink(snap.shop.handle),
      evidence: { pdpDescriptionFontPx: fontPx },
    });
  },
};
