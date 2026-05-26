import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { domainsLink } from "../utils/deep-link";

export const seoNoCustomDomainRule: Rule = {
  id: 27,
  code: "SEO_NO_CUSTOM_DOMAIN",
  category: Category.SEO_DISCOVERABILITY,
  severity: Severity.MEDIUM,
  title: "No custom domain configured",
  description: "Primary domain ends with myshopify.com.",
  evaluate(snap) {
    if (snap.shop.primaryDomain.isCustom) return null;
    return createFinding({
      snap,
      ruleId: 27,
      ruleCode: "SEO_NO_CUSTOM_DOMAIN",
      category: Category.SEO_DISCOVERABILITY,
      severity: Severity.MEDIUM,
      title: "No custom domain configured",
      body: "Your store uses the default myshopify.com domain. A custom domain builds brand trust and is expected by customers.",
      fixSteps: getFixSteps("SEO_NO_CUSTOM_DOMAIN"),
      fixDeepLink: domainsLink(snap.shop.handle),
      evidence: { host: snap.shop.primaryDomain.host },
    });
  },
};
