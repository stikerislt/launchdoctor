import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { paymentsLink } from "../utils/deep-link";

export const payWalletsDisabledRule: Rule = {
  id: 7,
  code: "PAY_WALLETS_DISABLED",
  category: Category.PAYMENTS_FRAUD,
  severity: Severity.HIGH,
  title: "Digital wallets not enabled",
  description: "Checks whether Apple Pay, Google Pay, or Shop Pay wallets are enabled.",
  evaluate(snap) {
    if (snap.shop.paymentSettings.supportedDigitalWallets.length > 0) {
      return null;
    }
    return createFinding({
      snap,
      ruleId: 7,
      ruleCode: "PAY_WALLETS_DISABLED",
      category: Category.PAYMENTS_FRAUD,
      severity: Severity.HIGH,
      title: "Digital wallets not enabled",
      body: "No digital wallets (Apple Pay, Google Pay, Shop Pay) are enabled. Wallets increase mobile conversion by reducing checkout friction.",
      fixSteps: getFixSteps("PAY_WALLETS_DISABLED"),
      fixDeepLink: paymentsLink(snap.shop.handle),
    });
  },
};
