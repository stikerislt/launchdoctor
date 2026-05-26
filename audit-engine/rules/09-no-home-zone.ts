import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { shippingLink } from "../utils/deep-link";

export const shipNoHomeZoneRule: Rule = {
  id: 9,
  code: "SHIP_NO_HOME_ZONE",
  category: Category.SHIPPING_FULFILLMENT,
  severity: Severity.CRITICAL,
  title: "Home country not in any shipping zone",
  description: "Shop billing country is not covered by any delivery zone.",
  evaluate(snap) {
    const hasHome = snap.delivery.profiles.some((p) =>
      p.zones.some((z) => z.isHome),
    );
    if (hasHome) return null;
    return createFinding({
      snap,
      ruleId: 9,
      ruleCode: "SHIP_NO_HOME_ZONE",
      category: Category.SHIPPING_FULFILLMENT,
      severity: Severity.CRITICAL,
      title: "Home country not in any shipping zone",
      body: `Your store's home country (${snap.shop.countryCode}) is not included in any shipping zone. Domestic customers cannot checkout.`,
      fixSteps: getFixSteps("SHIP_NO_HOME_ZONE"),
      fixDeepLink: shippingLink(snap.shop.handle),
    });
  },
};
