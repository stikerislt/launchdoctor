import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { shippingLink } from "../utils/deep-link";

export const shipNoFreeThresholdRule: Rule = {
  id: 11,
  code: "SHIP_NO_FREE_THRESHOLD",
  category: Category.SHIPPING_FULFILLMENT,
  severity: Severity.MEDIUM,
  title: "Free shipping threshold missing or too high",
  description: "No free shipping threshold or threshold exceeds 2× AOV.",
  evaluate(snap) {
    const hasThreshold = snap.delivery.profiles.some((p) =>
      p.zones.some((z) => z.hasFreeShippingThreshold),
    );
    const aov = snap.orders.last30d.averageOrderValue;
    const thresholdTooHigh = snap.delivery.profiles.some((p) =>
      p.zones.some(
        (z) =>
          z.freeShippingThreshold !== null &&
          aov !== null &&
          z.freeShippingThreshold > aov * 2,
      ),
    );
    if (hasThreshold && !thresholdTooHigh) return null;
    return createFinding({
      snap,
      ruleId: 11,
      ruleCode: "SHIP_NO_FREE_THRESHOLD",
      category: Category.SHIPPING_FULFILLMENT,
      severity: Severity.MEDIUM,
      title: "Free shipping threshold missing or too high",
      body: hasThreshold
        ? "Your free shipping threshold is more than 2× your average order value, making it unreachable for most customers."
        : "You have no free shipping threshold. Free shipping thresholds increase average order value.",
      fixSteps: getFixSteps("SHIP_NO_FREE_THRESHOLD"),
      fixDeepLink: shippingLink(snap.shop.handle),
      evidence: { hasThreshold, aov },
    });
  },
};
