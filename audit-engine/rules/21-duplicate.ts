import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodDuplicateRule: Rule = {
  id: 21,
  code: "PROD_DUPLICATE",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.MEDIUM,
  title: "Duplicate product titles detected",
  description: "Two products with Levenshtein similarity < 0.2 on titles.",
  evaluate(snap) {
    if (snap.products.stats.duplicatePairCount === 0) return null;
    return createFinding({
      snap,
      ruleId: 21,
      ruleCode: "PROD_DUPLICATE",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.MEDIUM,
      title: "Duplicate product titles detected",
      body: `${snap.products.stats.duplicatePairCount} pair(s) of products have nearly identical titles. Duplicates confuse customers and split SEO authority.`,
      fixSteps: getFixSteps("PROD_DUPLICATE"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { duplicatePairCount: snap.products.stats.duplicatePairCount },
    });
  },
};
