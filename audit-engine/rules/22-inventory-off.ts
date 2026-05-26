import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

export const prodInventoryOffRule: Rule = {
  id: 22,
  code: "PROD_INVENTORY_OFF",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.HIGH,
  title: "Inventory tracking disabled on most variants",
  description: ">50% variants have inventory tracking off.",
  evaluate(snap) {
    if (snap.products.stats.inventoryOffPct <= 50) return null;
    return createFinding({
      snap,
      ruleId: 22,
      ruleCode: "PROD_INVENTORY_OFF",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.HIGH,
      title: "Inventory tracking disabled on most variants",
      body: `${snap.products.stats.inventoryOffPct.toFixed(0)}% of variants have inventory tracking disabled. You risk overselling without tracking.`,
      fixSteps: getFixSteps("PROD_INVENTORY_OFF"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { inventoryOffPct: snap.products.stats.inventoryOffPct },
    });
  },
};
