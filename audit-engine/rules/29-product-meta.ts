import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const seoProductMetaRule: Rule = {
  id: 29,
  code: "SEO_PRODUCT_META",
  category: Category.SEO_DISCOVERABILITY,
  severity: Severity.HIGH,
  title: "Too many products missing SEO metadata",
  description: ">25% active products lack an SEO title or meta description.",
  evaluate(snap) {
    if (snap.products.stats.missingProductSeoPct <= 25) return null;
    return createFinding({
      snap,
      ruleId: 29,
      ruleCode: "SEO_PRODUCT_META",
      category: Category.SEO_DISCOVERABILITY,
      severity: Severity.HIGH,
      title: "Too many products missing SEO metadata",
      body: `${snap.products.stats.missingProductSeoPct.toFixed(0)}% of products are missing an SEO title or meta description. Product-level metadata helps individual pages rank in search.`,
      fixSteps: getFixSteps("SEO_PRODUCT_META"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { missingProductSeoPct: snap.products.stats.missingProductSeoPct },
    });
  },
};
