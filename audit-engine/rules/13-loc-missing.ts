import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { locationsLink } from "../utils/deep-link";

export const locMissingRule: Rule = {
  id: 13,
  code: "LOC_MISSING",
  category: Category.SHIPPING_FULFILLMENT,
  severity: Severity.CRITICAL,
  title: "Fulfillment location missing or incomplete",
  description: "Zero locations or primary location has empty address.",
  evaluate(snap) {
    if (snap.locations.length === 0) {
      return createFinding({
        snap,
        ruleId: 13,
        ruleCode: "LOC_MISSING",
        category: Category.SHIPPING_FULFILLMENT,
        severity: Severity.CRITICAL,
        title: "No fulfillment locations configured",
        body: "Your store has no fulfillment locations. You cannot fulfill orders without at least one location.",
        fixSteps: getFixSteps("LOC_MISSING"),
        fixDeepLink: locationsLink(snap.shop.handle),
      });
    }
    const primary = snap.locations.find((l) => l.fulfillsOnlineOrders) ?? snap.locations[0];
    const addr = primary!.address;
    if (addr.country && addr.city && addr.zip) return null;
    return createFinding({
      snap,
      ruleId: 13,
      ruleCode: "LOC_MISSING",
      category: Category.SHIPPING_FULFILLMENT,
      severity: Severity.CRITICAL,
      title: "Fulfillment location address incomplete",
      body: "Your primary fulfillment location has an incomplete address. Shipping rates and tax calculations may be wrong.",
      fixSteps: getFixSteps("LOC_INCOMPLETE"),
      fixDeepLink: locationsLink(snap.shop.handle),
      evidence: { location: primary!.name },
    });
  },
};
