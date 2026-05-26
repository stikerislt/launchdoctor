import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const chkNoUpsellRule: Rule = {
  id: 41,
  code: "CHK_NO_UPSELL",
  category: Category.CHECKOUT_CONVERSION,
  severity: Severity.MEDIUM,
  title: "No cart or checkout upsell configured",
  description: "No upsell app and no theme cart-upsell block.",
  evaluate(snap) {
    const upsellApps = ["reconvert", "zipify", "bold-upsell", "in-cart-upsell"];
    const hasApp = snap.installedApps.some((a) =>
      upsellApps.some((u) => a.handle.includes(u)),
    );
    if (hasApp || snap.theme.sections.cartHasUpsell) return null;
    return createFinding({
      snap,
      ruleId: 41,
      ruleCode: "CHK_NO_UPSELL",
      category: Category.CHECKOUT_CONVERSION,
      severity: Severity.MEDIUM,
      title: "No cart or checkout upsell configured",
      body: "Your store has no cart upsell or cross-sell configured. Upsells can increase average order value by 10–30%.",
      fixSteps: getFixSteps("CHK_NO_UPSELL"),
      fixDeepLink: themesLink(snap.shop.handle),
    });
  },
};
