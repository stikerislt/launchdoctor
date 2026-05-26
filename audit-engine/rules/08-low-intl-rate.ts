import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { shippingLink } from "../utils/deep-link";

export const shipLowIntlRateRule: Rule = {
  id: 8,
  code: "SHIP_LOW_INTL_RATE",
  category: Category.SHIPPING_FULFILLMENT,
  severity: Severity.CRITICAL,
  title: "International shipping rate dangerously low",
  description: "Non-domestic zone with cheapest rate under $5.",
  evaluate(snap) {
    const lowZones = snap.delivery.profiles.flatMap((p) =>
      p.zones.filter(
        (z) => z.isInternational && z.cheapestRate !== null && z.cheapestRate < 5,
      ),
    );
    if (lowZones.length === 0) return null;
    return createFinding({
      snap,
      ruleId: 8,
      ruleCode: "SHIP_LOW_INTL_RATE",
      category: Category.SHIPPING_FULFILLMENT,
      severity: Severity.CRITICAL,
      title: "International shipping rate dangerously low",
      body: "One or more international shipping zones have rates below $5. You will lose money on every international order.",
      fixSteps: getFixSteps("SHIP_LOW_INTL_RATE"),
      fixDeepLink: shippingLink(snap.shop.handle),
      evidence: { zones: lowZones.map((z) => z.name) },
    });
  },
};
