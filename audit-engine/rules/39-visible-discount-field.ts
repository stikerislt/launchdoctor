import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { checkoutLink } from "../utils/deep-link";

export const chkVisibleDiscountFieldRule: Rule = {
  id: 39,
  code: "CHK_VISIBLE_DISCOUNT_FIELD",
  category: Category.CHECKOUT_CONVERSION,
  severity: Severity.MEDIUM,
  title: "Discount field visible with no active promotions",
  description: "Discount field visible at checkout with zero active price rules.",
  evaluate(snap) {
    if (
      !snap.shop.checkoutSettings.discountFieldVisible ||
      snap.activePriceRulesCount > 0
    ) {
      return null;
    }
    return createFinding({
      snap,
      ruleId: 39,
      ruleCode: "CHK_VISIBLE_DISCOUNT_FIELD",
      category: Category.CHECKOUT_CONVERSION,
      severity: Severity.MEDIUM,
      title: "Discount field visible with no active promotions",
      body: "The discount code field is visible at checkout but you have no active discount codes. This encourages customers to leave and search for codes elsewhere.",
      fixSteps: getFixSteps("CHK_VISIBLE_DISCOUNT_FIELD"),
      fixDeepLink: checkoutLink(snap.shop.handle),
      confidence: 0.6,
    });
  },
};
