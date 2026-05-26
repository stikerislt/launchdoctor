import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { notificationsLink, paymentsLink } from "../utils/deep-link";

export const payManualMethodsRawRule: Rule = {
  id: 4,
  code: "PAY_MANUAL_METHODS_RAW",
  category: Category.PAYMENTS_FRAUD,
  severity: Severity.MEDIUM,
  title: "Manual payment methods without customized confirmation",
  description: "COD or bank transfer enabled without custom order confirmation email.",
  evaluate(snap) {
    if (
      snap.manualPaymentMethods.length === 0 ||
      snap.manualPaymentConfirmationCustomized
    ) {
      return null;
    }
    return createFinding({
      snap,
      ruleId: 4,
      ruleCode: "PAY_MANUAL_METHODS_RAW",
      category: Category.PAYMENTS_FRAUD,
      severity: Severity.MEDIUM,
      title: "Manual payment methods without customized confirmation",
      body: "You accept manual payment methods (COD or bank transfer) but haven't customized the order confirmation email with payment instructions.",
      fixSteps: getFixSteps("PAY_MANUAL_METHODS_RAW"),
      fixDeepLink: notificationsLink(snap.shop.handle),
      evidence: { methods: snap.manualPaymentMethods },
    });
  },
};
