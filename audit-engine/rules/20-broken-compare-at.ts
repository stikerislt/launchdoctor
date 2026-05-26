import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodBrokenCompareAtRule: Rule = {
  id: 20,
  code: "PROD_BROKEN_COMPARE_AT",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.MEDIUM,
  title: "Fake sale pricing detected",
  description: "Variant with compareAtPrice <= price.",
  evaluate(snap) {
    if (snap.products.stats.compareAtBrokenCount === 0) return null;
    return createFinding({
      snap,
      ruleId: 20,
      ruleCode: "PROD_BROKEN_COMPARE_AT",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.MEDIUM,
      title: "Fake sale pricing detected",
      body: `${snap.products.stats.compareAtBrokenCount} variant(s) have a compare-at price less than or equal to the sale price. This looks like a fake discount to customers.`,
      fixSteps: getFixSteps("PROD_BROKEN_COMPARE_AT"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { count: snap.products.stats.compareAtBrokenCount },
    });
  },
};
