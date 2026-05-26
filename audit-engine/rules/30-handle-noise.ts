import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const seoHandleNoiseRule: Rule = {
  id: 30,
  code: "SEO_HANDLE_NOISE",
  category: Category.SEO_DISCOVERABILITY,
  severity: Severity.LOW,
  title: "Product handles contain import noise",
  description: ">10% handles match /-\\d{5,}$/ CSV import pattern.",
  evaluate(snap) {
    if (snap.products.stats.handleNoisePct <= 10) return null;
    return createFinding({
      snap,
      ruleId: 30,
      ruleCode: "SEO_HANDLE_NOISE",
      category: Category.SEO_DISCOVERABILITY,
      severity: Severity.LOW,
      title: "Product handles contain import noise",
      body: `${snap.products.stats.handleNoisePct.toFixed(0)}% of product handles end with long numeric suffixes from CSV imports. Clean handles improve SEO and readability.`,
      fixSteps: getFixSteps("SEO_HANDLE_NOISE"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { handleNoisePct: snap.products.stats.handleNoisePct },
    });
  },
};
