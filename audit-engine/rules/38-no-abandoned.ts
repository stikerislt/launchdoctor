import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { messagingLink } from "../utils/deep-link";

export const chkNoAbandonedRule: Rule = {
  id: 38,
  code: "CHK_NO_ABANDONED",
  category: Category.CHECKOUT_CONVERSION,
  severity: Severity.CRITICAL,
  title: "Abandoned cart recovery not active",
  description: "Abandoned cart recovery email/automation is off.",
  evaluate(snap) {
    if (snap.abandonedCartActive) return null;
    return createFinding({
      snap,
      ruleId: 38,
      ruleCode: "CHK_NO_ABANDONED",
      category: Category.CHECKOUT_CONVERSION,
      severity: Severity.CRITICAL,
      title: "Abandoned cart recovery not active",
      body: "Abandoned cart recovery is not enabled. You are leaving recovered revenue on the table — cart abandonment averages 70%.",
      fixSteps: getFixSteps("CHK_NO_ABANDONED"),
      fixDeepLink: messagingLink(snap.shop.handle),
    });
  },
};
