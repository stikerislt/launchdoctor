import { Category, Severity } from "../types";
import type { Rule, StoreSnapshot } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

function hasPriceOutlier(snap: StoreSnapshot): boolean {
  for (const product of snap.products.sampled) {
    const prices = product.variants.map((v) => v.price);
    if (prices.length < 2) continue;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min > 0 && max / min >= 10) return true;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance =
      prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) continue;
    for (const price of prices) {
      const zScore = Math.abs((price - mean) / stdDev);
      if (zScore > 3) return true;
    }
  }
  return false;
}

export const prodPriceOutlierRule: Rule = {
  id: 19,
  code: "PROD_PRICE_OUTLIER",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.HIGH,
  title: "Variant price outlier detected",
  description: "Z-score > 3 within same product variants (typo detection).",
  evaluate(snap) {
    if (!hasPriceOutlier(snap)) return null;
    return createFinding({
      snap,
      ruleId: 19,
      ruleCode: "PROD_PRICE_OUTLIER",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.HIGH,
      title: "Variant price outlier detected",
      body: "At least one product has a variant price that is a statistical outlier compared to other variants. This often indicates a pricing typo.",
      fixSteps: getFixSteps("PROD_PRICE_OUTLIER"),
      fixDeepLink: productsLink(snap.shop.handle),
    });
  },
};
