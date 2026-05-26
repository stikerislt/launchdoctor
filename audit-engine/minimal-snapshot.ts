import type { StoreSnapshot } from "./types";

export function createMinimalSnapshot(
  overrides: Partial<StoreSnapshot> = {},
): StoreSnapshot {
  const base: StoreSnapshot = {
    capturedAt: new Date().toISOString(),
    shop: {
      name: "Store",
      handle: "store",
      contactEmail: null,
      primaryDomain: { host: "store.myshopify.com", url: "https://store.myshopify.com", isCustom: false },
      countryCode: "US",
      paymentSettings: {
        acceptedCardBrands: [], supportedDigitalWallets: [], captureMode: "MANUAL",
        captureModeKnown: true, testMode: false, threeDSConfigured: true,
      },
      policies: {
        REFUND_POLICY: null, PRIVACY_POLICY: null, TERMS_OF_SERVICE: null, SHIPPING_POLICY: null,
      },
      marketsEnabled: false,
      checkoutSettings: { customerAccountsRequired: false, phoneRequired: false, discountFieldVisible: false },
    },
    delivery: { profiles: [] },
    locations: [],
    products: {
      total: 0, sampled: [],
      stats: {
        thinDescPct: 0, singleImagePct: 0, missingAltPct: 0, noSkuPct: 0,
        compareAtBrokenCount: 0, duplicatePairCount: 0, noWeightPct: 0,
        inventoryOffPct: 0, heavyImagePct: 0, handleNoisePct: 0, missingProductSeoPct: 0,
      },
    },
    theme: {
      name: "Default", themeStoreId: null, themeStoreLatestVersion: null, installedVersion: null,
      isOnlineStore20: true, homepageSeo: { title: null, description: null },
      sections: { productHasDeliveryDate: true, cartHasUpsell: true, pdpHasReviews: true, trustBadgesEmpty: false },
      socialLinks: [],
    },
    storefront: {
      robotsTxtBlocksAll: false,
      storefrontPasswordProtected: false,
      sitemapStatus: 200,
      sitemapUrlCount: 0,
      sitemapProductUrls: 0,
      sitemapCollectionUrls: 0,
      sitemapPageUrls: 0,
      gscVerified: false,
    },
    orders: { last30d: { count: 0, averageOrderValue: null }, hasRealOrder: false },
    reviewsAppInstalled: false, abandonedCartActive: true, activePriceRulesCount: 0,
    manualPaymentMethods: [], manualPaymentConfirmationCustomized: true,
    mobile: {
      lighthousePerformance: null, smallestTapTargetPx: null, heroImageBytes: null,
      heroImageLazy: null, pdpDescriptionFontPx: null, stickyAtcPresent: null,
    },
    pages: { about: false, aboutBodyLength: 0, contact: false, faq: false },
    installedApps: [],
  };
  return { ...base, ...overrides, shop: { ...base.shop, ...overrides.shop }, storefront: { ...base.storefront, ...overrides.storefront }, mobile: { ...base.mobile, ...overrides.mobile }, pages: { ...base.pages, ...overrides.pages }, products: overrides.products ? { ...base.products, ...overrides.products } : base.products };
}
