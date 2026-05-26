import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { onlineStorePreferencesLink } from "../utils/deep-link";
import { isGenericHomepageTitle } from "../utils/homepage-seo";

export const seoDefaultTitleRule: Rule = {
  id: 23,
  code: "SEO_DEFAULT_TITLE",
  category: Category.SEO_DISCOVERABILITY,
  severity: Severity.HIGH,
  title: "Homepage SEO title is generic",
  description: "Homepage title matches Home, theme name, or shop name only.",
  evaluate(snap) {
    if (!isGenericHomepageTitle(
      snap.theme.homepageSeo.title,
      snap.shop.name,
      snap.theme.name,
    )) {
      return null;
    }
    return createFinding({
      snap,
      ruleId: 23,
      ruleCode: "SEO_DEFAULT_TITLE",
      category: Category.SEO_DISCOVERABILITY,
      severity: Severity.HIGH,
      title: "Homepage SEO title is generic",
      body: "Your homepage SEO title is generic (Home, theme name, or shop name only). A descriptive title improves search rankings and click-through rates.",
      fixSteps: getFixSteps("SEO_DEFAULT_TITLE"),
      fixDeepLink: onlineStorePreferencesLink(snap.shop.handle),
      evidence: { title: snap.theme.homepageSeo.title },
    });
  },
};
