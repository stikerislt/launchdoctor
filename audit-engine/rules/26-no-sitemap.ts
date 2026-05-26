import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import {
  GOOGLE_SEARCH_CONSOLE_URL,
  onlineStorePreferencesLink,
} from "../utils/deep-link";
import { getFixSteps } from "../utils/finding-guidance";

export const seoNoSitemapRule: Rule = {
  id: 26,
  code: "SEO_NO_SITEMAP",
  category: Category.SEO_DISCOVERABILITY,
  severity: Severity.HIGH,
  title: "Sitemap missing or empty",
  description: "sitemap.xml returns non-200 or has 0 URLs.",
  evaluate(snap) {
    if (snap.storefront.sitemapStatus === 200 && snap.storefront.sitemapUrlCount > 0) {
      return null;
    }

    const passwordProtected = snap.storefront.storefrontPasswordProtected;
    const body = passwordProtected
      ? "Your sitemap.xml is missing or empty because the storefront is password-protected. Shopify generates sitemaps automatically once the store is publicly accessible."
      : "Your sitemap.xml is missing, returns an error, or contains no URLs. Shopify generates this file automatically — check that products and pages are published.";

    const fixSteps = passwordProtected
      ? [
          "Go to Online Store → Preferences",
          "In Password protection, remove the password or disable the password page",
          "Visit yourstore.com/sitemap.xml and confirm URLs appear",
          "Submit the sitemap in Google Search Console after launch",
        ]
      : getFixSteps("SEO_NO_SITEMAP");

    return createFinding({
      snap,
      ruleId: 26,
      ruleCode: "SEO_NO_SITEMAP",
      category: Category.SEO_DISCOVERABILITY,
      severity: Severity.HIGH,
      title: "Sitemap missing or empty",
      body,
      fixSteps,
      fixDeepLink: passwordProtected
        ? onlineStorePreferencesLink(snap.shop.handle)
        : GOOGLE_SEARCH_CONSOLE_URL,
      evidence: {
        status: snap.storefront.sitemapStatus,
        urlCount: snap.storefront.sitemapUrlCount,
        storefrontPasswordProtected: passwordProtected,
      },
    });
  },
};
