import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodNoSkuRule: Rule = {
  id: 18,
  code: "PROD_NO_SKU",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.MEDIUM,
  title: "Too many variants missing SKU",
  description: ">25% variants have empty SKU.",
  evaluate(snap) {
    if (snap.products.stats.noSkuPct <= 25) return null;
    return createFinding({
      snap,
      ruleId: 18,
      ruleCode: "PROD_NO_SKU",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.MEDIUM,
      title: "Too many variants missing SKU",
      body: `${snap.products.stats.noSkuPct.toFixed(0)}% of variants have no SKU. SKUs are essential for inventory management and fulfillment.`,
      fixSteps: getFixSteps("PROD_NO_SKU"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { noSkuPct: snap.products.stats.noSkuPct },
    });
  },
};
