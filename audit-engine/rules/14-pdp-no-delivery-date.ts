import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const pdpNoDeliveryDateRule: Rule = {
  id: 14,
  code: "PDP_NO_DELIVERY_DATE",
  category: Category.SHIPPING_FULFILLMENT,
  severity: Severity.HIGH,
  title: "No delivery date on product page",
  description: "Product template lacks delivery date or ship-in element.",
  evaluate(snap) {
    if (snap.theme.sections.productHasDeliveryDate) return null;
    return createFinding({
      snap,
      ruleId: 14,
      ruleCode: "PDP_NO_DELIVERY_DATE",
      category: Category.SHIPPING_FULFILLMENT,
      severity: Severity.HIGH,
      title: "No delivery date on product page",
      body: "Your product page does not show estimated delivery or ship-by dates. This increases cart abandonment for gift and time-sensitive purchases.",
      fixSteps: getFixSteps("PDP_NO_DELIVERY_DATE"),
      fixDeepLink: themesLink(snap.shop.handle),
    });
  },
};
