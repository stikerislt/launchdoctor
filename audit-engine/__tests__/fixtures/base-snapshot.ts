import type { StoreSnapshot } from "../../types";

export function createBaseSnapshot(
  overrides: Record<string, unknown> = {},
): StoreSnapshot {
  const base: StoreSnapshot = {
    capturedAt: "2025-01-15T12:00:00.000Z",
    shop: {
      name: "Test Store",
      handle: "test-store",
      contactEmail: "support@teststore.com",
      primaryDomain: {
        host: "www.teststore.com",
        url: "https://www.teststore.com",
        isCustom: true,
      },
      countryCode: "US",
      paymentSettings: {
        acceptedCardBrands: ["VISA", "MASTERCARD"],
        supportedDigitalWallets: ["APPLE_PAY", "GOOGLE_PAY"],
        captureMode: "MANUAL",
        captureModeKnown: true,
        testMode: false,
        threeDSConfigured: true,
      },
      policies: {
        REFUND_POLICY: {
          body: "Our refund policy allows returns within 30 days of purchase with original receipt. Items must be unused and in original packaging. Refunds are processed within 5-7 business days after we receive your return. Shipping costs for returns are the responsibility of the customer unless the item was defective or we made an error.",
          url: "https://www.teststore.com/policies/refund-policy",
        },
        PRIVACY_POLICY: {
          body: "We respect your privacy and protect your personal information according to applicable laws.",
          url: "https://www.teststore.com/policies/privacy-policy",
        },
        TERMS_OF_SERVICE: {
          body: "By using this site you agree to our terms of service and conditions of sale.",
          url: "https://www.teststore.com/policies/terms-of-service",
        },
        SHIPPING_POLICY: {
          body: "We ship domestically within 3-5 business days and internationally within 7-14 days.",
          url: "https://www.teststore.com/policies/shipping-policy",
        },
      },
      marketsEnabled: true,
      checkoutSettings: {
        customerAccountsRequired: false,
        phoneRequired: false,
        discountFieldVisible: false,
      },
    },
    delivery: {
      profiles: [
        {
          name: "General",
          zones: [
            {
              name: "Domestic",
              countries: ["US"],
              isInternational: false,
              isHome: true,
              cheapestRate: 5.99,
              hasFreeShippingThreshold: true,
              freeShippingThreshold: 75,
              methods: [
                { name: "Standard", price: 5.99, weightBased: false },
                { name: "Free over $75", price: 0, weightBased: false },
              ],
            },
            {
              name: "Rest of World",
              countries: ["*"],
              isInternational: true,
              isHome: false,
              cheapestRate: 15.0,
              hasFreeShippingThreshold: false,
              freeShippingThreshold: null,
              methods: [{ name: "International", price: 15.0, weightBased: false }],
            },
          ],
        },
      ],
    },
    locations: [
      {
        name: "Main Warehouse",
        address: { country: "US", city: "Austin", zip: "78701" },
        fulfillsOnlineOrders: true,
      },
    ],
    products: {
      total: 10,
      sampled: [
        {
          id: "1",
          title: "Classic T-Shirt",
          handle: "classic-t-shirt",
          status: "ACTIVE",
          descriptionLength: 200,
          imageCount: 4,
          missingAltCount: 0,
          heroImageBytes: 120000,
          variants: [
            {
              sku: "TSH-001",
              price: 29.99,
              compareAtPrice: 39.99,
              weight: 0.3,
              inventoryTracked: true,
            },
          ],
          seo: { title: "Classic T-Shirt", description: "Premium cotton tee" },
        },
      ],
      stats: {
        thinDescPct: 0,
        singleImagePct: 0,
        noImagePct: 0,
        missingAltPct: 0,
        noSkuPct: 0,
        compareAtBrokenCount: 0,
        duplicatePairCount: 0,
        noWeightPct: 0,
        inventoryOffPct: 0,
        heavyImagePct: 0,
        handleNoisePct: 0,
        missingProductSeoPct: 0,
      },
    },
    theme: {
      name: "Dawn",
      themeStoreId: null,
      themeStoreLatestVersion: null,
      installedVersion: null,
      isOnlineStore20: true,
      homepageSeo: {
        title: "Test Store — Premium Apparel",
        description: "Shop our curated collection of premium apparel.",
      },
      sections: {
        productHasDeliveryDate: true,
        cartHasUpsell: true,
        pdpHasReviews: true,
        trustBadgesEmpty: false,
      },
      socialLinks: [
        { platform: "instagram", url: "https://instagram.com/teststore", reachable: true },
      ],
    },
    storefront: {
      robotsTxtBlocksAll: false,
      storefrontPasswordProtected: false,
      sitemapStatus: 200,
      sitemapUrlCount: 50,
      sitemapProductUrls: 30,
      sitemapCollectionUrls: 10,
      sitemapPageUrls: 10,
      gscVerified: true,
    },
    orders: {
      last30d: { count: 25, averageOrderValue: 65.0 },
      hasRealOrder: true,
    },
    reviewsAppInstalled: true,
    abandonedCartActive: true,
    activePriceRulesCount: 1,
    manualPaymentMethods: [],
    manualPaymentConfirmationCustomized: true,
    mobile: {
      lighthousePerformance: 75,
      smallestTapTargetPx: 48,
      heroImageBytes: 250000,
      heroImageLazy: true,
      pdpDescriptionFontPx: 16,
      stickyAtcPresent: true,
    },
    pages: {
      about: true,
      aboutBodyLength: 500,
      contact: true,
      faq: true,
    },
    installedApps: [{ handle: "judge-me", title: "Judge.me Reviews" }],
  };

  return deepMerge(base, overrides) as StoreSnapshot;
}

function deepMerge(base: unknown, overrides: unknown): unknown {
  if (!overrides || typeof overrides !== "object" || overrides === null) return base;
  if (!base || typeof base !== "object" || base === null) return overrides;
  const result = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(overrides as Record<string, unknown>)) {
    const overrideVal = (overrides as Record<string, unknown>)[key];
    const baseVal = (base as Record<string, unknown>)[key];
    if (
      overrideVal &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal) &&
      baseVal &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result;
}
