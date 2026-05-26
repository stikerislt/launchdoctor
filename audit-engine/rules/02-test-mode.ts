import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { paymentsLink } from "../utils/deep-link";

export const payTestModeRule: Rule = {
  id: 2,
  code: "PAY_TEST_MODE",
  category: Category.PAYMENTS_FRAUD,
  severity: Severity.CRITICAL,
  title: "Payment gateway still in test mode",
  description: "Detects test mode enabled after the store has received real orders.",
  evaluate(snap) {
    if (!snap.shop.paymentSettings.testMode || !snap.orders.hasRealOrder) {
      return null;
    }
    return createFinding({
      snap,
      ruleId: 2,
      ruleCode: "PAY_TEST_MODE",
      category: Category.PAYMENTS_FRAUD,
      severity: Severity.CRITICAL,
      title: "Payment gateway still in test mode",
      body: "Your payment provider is in test mode but you have received real orders. Customers cannot be charged until test mode is disabled.",
      fixSteps: getFixSteps("PAY_TEST_MODE"),
      fixDeepLink: paymentsLink(snap.shop.handle),
      evidence: { testMode: true, hasRealOrder: snap.orders.hasRealOrder },
    });
  },
};
