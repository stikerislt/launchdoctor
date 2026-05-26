import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { onlineStorePreferencesLink } from "../utils/deep-link";
import { getFixSteps } from "../utils/finding-guidance";

export const seoRobotsBlockedRule: Rule = {
  id: 25,
  code: "SEO_ROBOTS_BLOCKED",
  category: Category.SEO_DISCOVERABILITY,
  severity: Severity.CRITICAL,
  title: "robots.txt blocks all crawlers",
  description: "robots.txt contains Disallow: / for User-agent: *.",
  evaluate(snap) {
    if (!snap.storefront.robotsTxtBlocksAll) return null;

    const passwordProtected = snap.storefront.storefrontPasswordProtected;
    const body = passwordProtected
      ? "Your store is password-protected, so Shopify serves a robots.txt that blocks all crawlers. Search engines cannot index your storefront until you remove the password."
      : "Your robots.txt file blocks all search engine crawlers. Your store will not appear in Google or other search results.";

    const fixSteps = passwordProtected
      ? getFixSteps("SEO_ROBOTS_BLOCKED")
      : [
          "Visit yourstore.com/robots.txt and confirm it contains Disallow: /",
          "If you added a custom robots.txt.liquid template, go to Online Store → Themes → Edit code and remove Disallow: /",
          "If no custom template exists, check Online Store → Preferences and disable password protection",
          "Delete robots.txt.liquid to restore Shopify's default robots.txt if you no longer need custom rules",
        ];

    return createFinding({
      snap,
      ruleId: 25,
      ruleCode: "SEO_ROBOTS_BLOCKED",
      category: Category.SEO_DISCOVERABILITY,
      severity: Severity.CRITICAL,
      title: "robots.txt blocks all crawlers",
      body,
      fixSteps,
      fixDeepLink: onlineStorePreferencesLink(snap.shop.handle),
      evidence: {
        robotsTxtBlocksAll: true,
        storefrontPasswordProtected: passwordProtected,
      },
    });
  },
};
