import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { shippingLink } from "../utils/deep-link";

export const shipNoRowRule: Rule = {
  id: 10,
  code: "SHIP_NO_ROW",
  category: Category.SHIPPING_FULFILLMENT,
  severity: Severity.HIGH,
  title: "No Rest of World shipping zone",
  description: "Checks for a catch-all international shipping zone.",
  evaluate(snap) {
    const hasRow = snap.delivery.profiles.some((p) =>
      p.zones.some(
        (z) =>
          z.isInternational &&
          (z.countries.includes("*") || z.name.toLowerCase().includes("rest of world")),
      ),
    );
    if (hasRow) return null;
    return createFinding({
      snap,
      ruleId: 10,
      ruleCode: "SHIP_NO_ROW",
      category: Category.SHIPPING_FULFILLMENT,
      severity: Severity.HIGH,
      title: "No Rest of World shipping zone",
      body: "You have no catch-all international shipping zone. Customers outside your defined zones cannot complete checkout.",
      fixSteps: getFixSteps("SHIP_NO_ROW"),
      fixDeepLink: shippingLink(snap.shop.handle),
    });
  },
};
