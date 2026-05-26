import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodNoWeightRule: Rule = {
  id: 12,
  code: "PROD_NO_WEIGHT",
  category: Category.SHIPPING_FULFILLMENT,
  severity: Severity.HIGH,
  title: "Too many products missing weight",
  description: ">10% variants have zero weight with weight-based shipping.",
  evaluate(snap) {
    const usesWeight = snap.delivery.profiles.some((p) =>
      p.zones.some((z) => z.methods.some((m) => m.weightBased)),
    );
    if (!usesWeight || snap.products.stats.noWeightPct <= 10) return null;
    return createFinding({
      snap,
      ruleId: 12,
      ruleCode: "PROD_NO_WEIGHT",
      category: Category.SHIPPING_FULFILLMENT,
      severity: Severity.HIGH,
      title: "Too many products missing weight",
      body: `${snap.products.stats.noWeightPct.toFixed(0)}% of variants have no weight set. Weight-based shipping rates will be incorrect.`,
      fixSteps: getFixSteps("PROD_NO_WEIGHT"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { noWeightPct: snap.products.stats.noWeightPct },
    });
  },
};
