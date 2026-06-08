/**
 * Shopify admin deep links for admin.shopify.com/store/{handle}/...
 *
 * Verified paths (2025–2026 admin):
 * - Policies: /settings/legal (not /settings/policies)
 * - Online Store SEO: /online_store/preferences
 * - Abandoned cart automations: /apps/shopify-messaging (Apps → Messaging)
 */

export const ADMIN_PATHS = {
  legal: "/settings/legal",
  payments: "/settings/payments",
  shipping: "/settings/shipping",
  checkout: "/settings/checkout",
  notifications: "/settings/notifications",
  domains: "/settings/domains",
  locations: "/settings/locations",
  markets: "/settings/markets",
  general: "/settings/general",
  onlineStorePreferences: "/online_store/preferences",
  themes: "/themes",
  products: "/products",
  pages: "/pages",
  messaging: "/apps/shopify-messaging",
  // URL redirects live under Content → Menus → "View URL Redirects".
  redirects: "/content/redirects",
} as const;

/** @deprecated Use legalLink — /settings/policies is not a valid admin route */
export const LEGACY_PATH_REWRITES: Record<string, string> = {
  "/settings/policies": ADMIN_PATHS.legal,
};

export function buildDeepLink(shopHandle: string, path: string): string {
  const normalized = normalizeAdminPath(path.startsWith("/") ? path : `/${path}`);
  return `https://admin.shopify.com/store/${shopHandle}${normalized}`;
}

export function normalizeAdminPath(path: string): string {
  for (const [legacy, current] of Object.entries(LEGACY_PATH_REWRITES)) {
    if (path === legacy || path.startsWith(`${legacy}/`)) {
      return path.replace(legacy, current);
    }
  }
  return path;
}

export function legalLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.legal);
}

/** @deprecated Alias for legalLink */
export function policiesLink(handle: string) {
  return legalLink(handle);
}

export function paymentsLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.payments);
}

export function shippingLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.shipping);
}

export function themesLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.themes);
}

export function checkoutLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.checkout);
}

export function marketsLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.markets);
}

export function notificationsLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.notifications);
}

export function productsLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.products);
}

/**
 * Deep link to a single product's admin page. `productId` may be a Shopify GID
 * (gid://shopify/Product/123) or a bare numeric id; falls back to the products
 * list when no numeric id can be resolved.
 */
export function productAdminLink(handle: string, productId: string) {
  const numeric = String(productId).match(/\d+$/)?.[0];
  return buildDeepLink(
    handle,
    numeric ? `${ADMIN_PATHS.products}/${numeric}` : ADMIN_PATHS.products,
  );
}

export function locationsLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.locations);
}

export function domainsLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.domains);
}

export function generalLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.general);
}

export function onlineStorePreferencesLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.onlineStorePreferences);
}

export function pagesLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.pages);
}

export function redirectsLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.redirects);
}

export function messagingLink(handle: string) {
  return buildDeepLink(handle, ADMIN_PATHS.messaging);
}

/** @deprecated Use messagingLink — marketing automations moved to Shopify Messaging */
export function marketingLink(handle: string) {
  return messagingLink(handle);
}

export const GOOGLE_SEARCH_CONSOLE_URL = "https://search.google.com/search-console/welcome";

export const SHOPIFY_APP_STORE_REVIEWS_URL =
  "https://apps.shopify.com/search?q=product+reviews";

type LinkBuilder = (handle: string) => string;

export const RULE_DEEP_LINKS: Record<string, LinkBuilder> = {
  PAY_AUTO_CAPTURE: paymentsLink,
  PAY_TEST_MODE: paymentsLink,
  PAY_NO_3DS_EU: paymentsLink,
  PAY_MANUAL_METHODS_RAW: notificationsLink,
  POL_REFUND_MISSING: legalLink,
  POL_ALL_MISSING: legalLink,
  PAY_WALLETS_DISABLED: paymentsLink,
  SHIP_LOW_INTL_RATE: shippingLink,
  SHIP_NO_HOME_ZONE: shippingLink,
  SHIP_NO_ROW: shippingLink,
  SHIP_NO_FREE_THRESHOLD: shippingLink,
  PROD_NO_WEIGHT: productsLink,
  LOC_MISSING: locationsLink,
  PDP_NO_DELIVERY_DATE: themesLink,
  PROD_THIN_DESC: productsLink,
  PROD_SINGLE_IMAGE: productsLink,
  PROD_NO_IMAGE: productsLink,
  PROD_MISSING_ALT: productsLink,
  PROD_NO_SKU: productsLink,
  PROD_PRICE_OUTLIER: productsLink,
  PROD_BROKEN_COMPARE_AT: productsLink,
  PROD_DUPLICATE: productsLink,
  PROD_INVENTORY_OFF: productsLink,
  SEO_DEFAULT_TITLE: onlineStorePreferencesLink,
  SEO_NO_META_DESC: onlineStorePreferencesLink,
  SEO_ROBOTS_BLOCKED: onlineStorePreferencesLink,
  SEO_NO_CUSTOM_DOMAIN: domainsLink,
  SEO_HEAVY_IMAGES: productsLink,
  SEO_PRODUCT_META: productsLink,
  SEO_HANDLE_NOISE: productsLink,
  TRUST_NO_ABOUT: pagesLink,
  TRUST_NO_CONTACT: generalLink,
  TRUST_VAGUE_RETURNS: legalLink,
  TRUST_NO_FAQ: pagesLink,
  TRUST_BROKEN_SOCIAL: themesLink,
  TRUST_EMPTY_BADGES: themesLink,
  CHK_NO_ABANDONED: messagingLink,
  CHK_VISIBLE_DISCOUNT_FIELD: checkoutLink,
  CHK_NO_LOCAL_CURRENCY: marketsLink,
  CHK_NO_UPSELL: themesLink,
  CHK_REQUIRE_PHONE: checkoutLink,
  CHK_FORCE_ACCOUNT: checkoutLink,
  THM_NOT_OS20: themesLink,
  THM_LOW_LIGHTHOUSE: themesLink,
  THM_TINY_TAPS: themesLink,
  THM_HEAVY_HERO: themesLink,
  THM_SMALL_FONT: themesLink,
  THM_NO_STICKY_ATC: themesLink,
  THM_OUTDATED: themesLink,
};

export function getRuleDeepLink(ruleCode: string, shopHandle: string): string | null {
  if (ruleCode === "TRUST_NO_REVIEWS") {
    return SHOPIFY_APP_STORE_REVIEWS_URL;
  }

  const builder = RULE_DEEP_LINKS[ruleCode];
  return builder ? builder(shopHandle) : null;
}

export function resolveAdminDeepLink(
  storedUrl: string | null | undefined,
  ruleCode: string,
  shopHandle: string,
): string | null {
  const fromRule = getRuleDeepLink(ruleCode, shopHandle);
  if (fromRule) return fromRule;

  if (!storedUrl) return null;

  try {
    const url = new URL(storedUrl);
    const match = url.pathname.match(/\/store\/[^/]+(\/.*)?$/);
    if (match && shopHandle) {
      const path = normalizeAdminPath(match[1] ?? "");
      return buildDeepLink(shopHandle, path || "/");
    }
  } catch {
    // fall through
  }

  return storedUrl;
}
