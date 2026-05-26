import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { paymentsLink } from "../utils/deep-link";

export const payAutoCaptureRule: Rule = {
  id: 1,
  code: "PAY_AUTO_CAPTURE",
  category: Category.PAYMENTS_FRAUD,
  severity: Severity.CRITICAL,
  title: "Automatic payment capture on a new store",
  description:
    "Checks whether payments are set to capture automatically before the merchant can review orders.",
  evaluate(snap) {
    const { captureMode, captureModeKnown, supportedDigitalWallets } =
      snap.shop.paymentSettings;
    if (!captureModeKnown || captureMode !== "AUTOMATIC") {
      return null;
    }
    const shopPayEnabled = supportedDigitalWallets.some(
      (w) => w === "SHOPIFY_PAY" || w === "SHOP_PAY",
    );
    return createFinding({
      snap,
      ruleId: 1,
      ruleCode: "PAY_AUTO_CAPTURE",
      category: Category.PAYMENTS_FRAUD,
      severity: Severity.CRITICAL,
      title: "Automatic payment capture on a new store",
      body: "Your store captures card payments automatically at checkout. On a new store, that leaves less time to review suspicious orders before you ship — which increases chargeback and fulfillment loss risk.",
      fixSteps: getFixSteps("PAY_AUTO_CAPTURE"),
      fixDeepLink: paymentsLink(snap.shop.handle),
      evidence: { captureMode, captureModeKnown, shopPayEnabled },
    });
  },
};
