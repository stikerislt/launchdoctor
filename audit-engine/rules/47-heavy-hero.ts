import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const thmHeavyHeroRule: Rule = {
  id: 47,
  code: "THM_HEAVY_HERO",
  category: Category.MOBILE_THEME,
  severity: Severity.HIGH,
  title: "Homepage hero image too large or not lazy-loaded",
  description: "Hero image over 1MB or missing lazy loading.",
  evaluate(snap) {
    const bytes = snap.mobile.heroImageBytes;
    const lazy = snap.mobile.heroImageLazy;
    if (bytes === null) return null;
    if (bytes <= 1_000_000 && lazy === true) return null;
    return createFinding({
      snap,
      ruleId: 47,
      ruleCode: "THM_HEAVY_HERO",
      category: Category.MOBILE_THEME,
      severity: Severity.HIGH,
      title: "Homepage hero image too large or not lazy-loaded",
      body:
        bytes > 1_000_000
          ? `Your homepage hero image is ${(bytes / 1_000_000).toFixed(1)}MB. Large hero images are the #1 cause of slow mobile load times.`
          : "Your homepage hero image is not lazy-loaded, causing unnecessary initial page weight.",
      fixSteps: getFixSteps("THM_HEAVY_HERO"),
      fixDeepLink: themesLink(snap.shop.handle),
      evidence: { heroImageBytes: bytes, heroImageLazy: lazy },
    });
  },
};
