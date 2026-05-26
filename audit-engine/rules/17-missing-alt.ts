import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodMissingAltRule: Rule = {
  id: 17,
  code: "PROD_MISSING_ALT",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.MEDIUM,
  title: "Product images missing alt text",
  description: ">25% product images have empty alt text.",
  evaluate(snap) {
    if (snap.products.stats.missingAltPct <= 25) return null;
    return createFinding({
      snap,
      ruleId: 17,
      ruleCode: "PROD_MISSING_ALT",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.MEDIUM,
      title: "Product images missing alt text",
      body: `${snap.products.stats.missingAltPct.toFixed(0)}% of product images lack alt text, hurting accessibility and image SEO.`,
      fixSteps: getFixSteps("PROD_MISSING_ALT"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { missingAltPct: snap.products.stats.missingAltPct },
    });
  },
};
