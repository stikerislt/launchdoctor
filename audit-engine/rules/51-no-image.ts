import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodNoImageRule: Rule = {
  id: 51,
  code: "PROD_NO_IMAGE",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.HIGH,
  title: "Products published without an image",
  description: ">5% of active products have no image at all.",
  evaluate(snap) {
    if (snap.products.stats.noImagePct <= 5) return null;
    return createFinding({
      snap,
      ruleId: 51,
      ruleCode: "PROD_NO_IMAGE",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.HIGH,
      title: "Products published without an image",
      body: `${snap.products.stats.noImagePct.toFixed(0)}% of active products have no image at all. Image-less products rarely convert, are often hidden by themes, and are excluded from Google Shopping and most marketing channels.`,
      fixSteps: getFixSteps("PROD_NO_IMAGE"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { noImagePct: snap.products.stats.noImagePct },
    });
  },
};
