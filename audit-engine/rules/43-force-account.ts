import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { checkoutLink } from "../utils/deep-link";

export const chkForceAccountRule: Rule = {
  id: 43,
  code: "CHK_FORCE_ACCOUNT",
  category: Category.CHECKOUT_CONVERSION,
  severity: Severity.HIGH,
  title: "Customer accounts required at checkout",
  description: "customerAccountsV2.loginRequiredAtCheckout is true.",
  evaluate(snap) {
    if (!snap.shop.checkoutSettings.customerAccountsRequired) return null;
    return createFinding({
      snap,
      ruleId: 43,
      ruleCode: "CHK_FORCE_ACCOUNT",
      category: Category.CHECKOUT_CONVERSION,
      severity: Severity.HIGH,
      title: "Customer accounts required at checkout",
      body: "Customers must create an account to checkout. Forced account creation significantly increases cart abandonment.",
      fixSteps: getFixSteps("CHK_FORCE_ACCOUNT"),
      fixDeepLink: checkoutLink(snap.shop.handle),
    });
  },
};
