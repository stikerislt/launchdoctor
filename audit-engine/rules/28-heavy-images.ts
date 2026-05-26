import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const seoHeavyImagesRule: Rule = {
  id: 28,
  code: "SEO_HEAVY_IMAGES",
  category: Category.SEO_DISCOVERABILITY,
  severity: Severity.HIGH,
  title: "Too many oversized product images",
  description: ">25% product hero images exceed 500KB.",
  evaluate(snap) {
    if (snap.products.stats.heavyImagePct <= 25) return null;
    return createFinding({
      snap,
      ruleId: 28,
      ruleCode: "SEO_HEAVY_IMAGES",
      category: Category.SEO_DISCOVERABILITY,
      severity: Severity.HIGH,
      title: "Too many oversized product images",
      body: `${snap.products.stats.heavyImagePct.toFixed(0)}% of product hero images exceed 500KB. Large images slow page load and hurt Core Web Vitals.`,
      fixSteps: getFixSteps("SEO_HEAVY_IMAGES"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { heavyImagePct: snap.products.stats.heavyImagePct },
    });
  },
};
