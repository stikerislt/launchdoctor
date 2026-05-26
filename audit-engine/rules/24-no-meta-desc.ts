import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { onlineStorePreferencesLink } from "../utils/deep-link";

export const seoNoMetaDescRule: Rule = {
  id: 24,
  code: "SEO_NO_META_DESC",
  category: Category.SEO_DISCOVERABILITY,
  severity: Severity.HIGH,
  title: "Homepage meta description missing",
  description: "Homepage seo.description is empty.",
  evaluate(snap) {
    const desc = snap.theme.homepageSeo.description?.trim();
    if (desc) return null;
    return createFinding({
      snap,
      ruleId: 24,
      ruleCode: "SEO_NO_META_DESC",
      category: Category.SEO_DISCOVERABILITY,
      severity: Severity.HIGH,
      title: "Homepage meta description missing",
      body: "Your homepage has no meta description. Search engines use this for snippets — missing descriptions reduce click-through rates.",
      fixSteps: getFixSteps("SEO_NO_META_DESC"),
      fixDeepLink: onlineStorePreferencesLink(snap.shop.handle),
    });
  },
};
