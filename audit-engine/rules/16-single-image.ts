import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodSingleImageRule: Rule = {
  id: 16,
  code: "PROD_SINGLE_IMAGE",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.HIGH,
  title: "Too many products with fewer than 3 images",
  description: ">25% active products have fewer than 3 images.",
  evaluate(snap) {
    if (snap.products.stats.singleImagePct <= 25) return null;
    return createFinding({
      snap,
      ruleId: 16,
      ruleCode: "PROD_SINGLE_IMAGE",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.HIGH,
      title: "Too many products with fewer than 3 images",
      body: `${snap.products.stats.singleImagePct.toFixed(0)}% of products have fewer than 3 images. Multiple angles and lifestyle shots increase conversion.`,
      fixSteps: getFixSteps("PROD_SINGLE_IMAGE"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { singleImagePct: snap.products.stats.singleImagePct },
    });
  },
};
