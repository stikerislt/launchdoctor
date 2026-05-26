import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodThinDescRule: Rule = {
  id: 15,
  code: "PROD_THIN_DESC",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.HIGH,
  title: "Too many products with thin descriptions",
  description: ">25% active products have descriptions under 50 characters.",
  evaluate(snap) {
    if (snap.products.stats.thinDescPct <= 25) return null;
    return createFinding({
      snap,
      ruleId: 15,
      ruleCode: "PROD_THIN_DESC",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.HIGH,
      title: "Too many products with thin descriptions",
      body: `${snap.products.stats.thinDescPct.toFixed(0)}% of products have descriptions under 50 characters. Thin descriptions hurt SEO and conversion.`,
      fixSteps: getFixSteps("PROD_THIN_DESC"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { thinDescPct: snap.products.stats.thinDescPct },
    });
  },
};
