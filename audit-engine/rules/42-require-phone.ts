import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { checkoutLink } from "../utils/deep-link";

export const chkRequirePhoneRule: Rule = {
  id: 42,
  code: "CHK_REQUIRE_PHONE",
  category: Category.CHECKOUT_CONVERSION,
  severity: Severity.HIGH,
  title: "Phone number required at checkout",
  description: "Checkout requires phone but no carrier needs it.",
  evaluate(snap) {
    if (!snap.shop.checkoutSettings.phoneRequired) return null;
    return createFinding({
      snap,
      ruleId: 42,
      ruleCode: "CHK_REQUIRE_PHONE",
      category: Category.CHECKOUT_CONVERSION,
      severity: Severity.HIGH,
      title: "Phone number required at checkout",
      body: "Checkout requires a phone number but your shipping carriers don't need it. Required phone fields increase checkout abandonment.",
      fixSteps: getFixSteps("CHK_REQUIRE_PHONE"),
      fixDeepLink: checkoutLink(snap.shop.handle),
    });
  },
};
