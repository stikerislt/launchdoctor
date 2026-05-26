import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { marketsLink } from "../utils/deep-link";

export const chkNoLocalCurrencyRule: Rule = {
  id: 40,
  code: "CHK_NO_LOCAL_CURRENCY",
  category: Category.CHECKOUT_CONVERSION,
  severity: Severity.HIGH,
  title: "Single currency with international shipping",
  description: "Single-currency setup with international zones; Markets not enabled.",
  evaluate(snap) {
    const hasIntl = snap.delivery.profiles.some((p) =>
      p.zones.some((z) => z.isInternational),
    );
    if (!hasIntl || snap.shop.marketsEnabled) return null;
    return createFinding({
      snap,
      ruleId: 40,
      ruleCode: "CHK_NO_LOCAL_CURRENCY",
      category: Category.CHECKOUT_CONVERSION,
      severity: Severity.HIGH,
      title: "Single currency with international shipping",
      body: "You ship internationally but haven't enabled Shopify Markets for local currency display. Customers prefer seeing prices in their currency.",
      fixSteps: getFixSteps("CHK_NO_LOCAL_CURRENCY"),
      fixDeepLink: marketsLink(snap.shop.handle),
    });
  },
};
