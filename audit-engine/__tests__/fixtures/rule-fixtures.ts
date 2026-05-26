import { createBaseSnapshot } from "./base-snapshot";
import type { StoreSnapshot } from "../../types";

export const payAutoCaptureTrigger = createBaseSnapshot({
  shop: {
    paymentSettings: {
      captureMode: "AUTOMATIC",
      captureModeKnown: true,
    },
  },
});

export const payAutoCapturePass = createBaseSnapshot({
  shop: {
    paymentSettings: {
      captureMode: "MANUAL",
      captureModeKnown: true,
    },
  },
});

export const payAutoCaptureEdge = createBaseSnapshot({
  shop: {
    paymentSettings: {
      captureMode: "AUTOMATIC",
      captureModeKnown: false,
    },
  },
});

export const payTestModeTrigger = createBaseSnapshot({
  shop: { paymentSettings: { testMode: true } },
  orders: { hasRealOrder: true, last30d: { count: 5, averageOrderValue: 50 } },
});

export const payTestModePass = createBaseSnapshot({
  shop: { paymentSettings: { testMode: false } },
  orders: { hasRealOrder: true, last30d: { count: 5, averageOrderValue: 50 } },
});

export const payTestModeEdge = createBaseSnapshot({
  shop: { paymentSettings: { testMode: true } },
  orders: { hasRealOrder: false, last30d: { count: 0, averageOrderValue: null } },
});

export const prodPriceOutlierTrigger = createBaseSnapshot({
  products: {
    total: 1,
    sampled: [{
      id: "1", title: "Shirt", handle: "shirt", status: "ACTIVE",
      descriptionLength: 100, imageCount: 3, missingAltCount: 0, heroImageBytes: 100000,
      variants: [
        { sku: "A1", price: 10, compareAtPrice: null, weight: 0.3, inventoryTracked: true },
        { sku: "A2", price: 10, compareAtPrice: null, weight: 0.3, inventoryTracked: true },
        { sku: "A3", price: 10, compareAtPrice: null, weight: 0.3, inventoryTracked: true },
        { sku: "OUT", price: 500, compareAtPrice: null, weight: 0.3, inventoryTracked: true },
      ],
      seo: { title: null, description: null },
    }],
    stats: {
      thinDescPct: 0, singleImagePct: 0, missingAltPct: 0, noSkuPct: 0,
      compareAtBrokenCount: 0, duplicatePairCount: 0, noWeightPct: 0,
      inventoryOffPct: 0, heavyImagePct: 0, handleNoisePct: 0, missingProductSeoPct: 0,
    },
  },
});

export const prodPriceOutlierPass = createBaseSnapshot();
export const prodPriceOutlierEdge = createBaseSnapshot();

export const ruleFixtures: Record<
  string,
  { trigger: StoreSnapshot; pass: StoreSnapshot; edge: StoreSnapshot }
> = {
  PAY_AUTO_CAPTURE: {
    trigger: payAutoCaptureTrigger,
    pass: payAutoCapturePass,
    edge: payAutoCaptureEdge,
  },
  PAY_TEST_MODE: {
    trigger: payTestModeTrigger,
    pass: payTestModePass,
    edge: payTestModeEdge,
  },
  PROD_PRICE_OUTLIER: {
    trigger: prodPriceOutlierTrigger,
    pass: prodPriceOutlierPass,
    edge: prodPriceOutlierEdge,
  },
};

export function buildRuleFixtures(
  code: string,
  triggerOverrides: Record<string, unknown>,
  passOverrides: Record<string, unknown> = {},
  edgeOverrides: Record<string, unknown> = {},
) {
  ruleFixtures[code] = {
    trigger: createBaseSnapshot(triggerOverrides as Partial<StoreSnapshot>),
    pass: createBaseSnapshot(passOverrides as Partial<StoreSnapshot>),
    edge: createBaseSnapshot(edgeOverrides as Partial<StoreSnapshot>),
  };
}

buildRuleFixtures("PAY_NO_3DS_EU", {
  delivery: {
    profiles: [{
      name: "General",
      zones: [{
        name: "EU", countries: ["DE"], isInternational: true, isHome: false,
        cheapestRate: 10, hasFreeShippingThreshold: false, freeShippingThreshold: null,
        methods: [{ name: "Standard", price: 10, weightBased: false }],
      }],
    }],
  },
  shop: { paymentSettings: { threeDSConfigured: false } },
}, {
  shop: { paymentSettings: { threeDSConfigured: true } },
});

buildRuleFixtures("PAY_MANUAL_METHODS_RAW", {
  manualPaymentMethods: ["COD"],
  manualPaymentConfirmationCustomized: false,
}, {
  manualPaymentMethods: [],
});

buildRuleFixtures("POL_REFUND_MISSING", {
  shop: { policies: { REFUND_POLICY: null } },
});

buildRuleFixtures("POL_ALL_MISSING", {
  shop: { policies: { PRIVACY_POLICY: null } },
});

buildRuleFixtures("PAY_WALLETS_DISABLED", {
  shop: { paymentSettings: { supportedDigitalWallets: [] } },
});

buildRuleFixtures("SHIP_LOW_INTL_RATE", {
  delivery: {
    profiles: [{
      name: "General",
      zones: [{
        name: "Intl", countries: ["GB"], isInternational: true, isHome: false,
        cheapestRate: 2, hasFreeShippingThreshold: false, freeShippingThreshold: null,
        methods: [{ name: "Economy", price: 2, weightBased: false }],
      }],
    }],
  },
});

buildRuleFixtures("SHIP_NO_HOME_ZONE", {
  delivery: {
    profiles: [{
      name: "General",
      zones: [{
        name: "Intl Only", countries: ["GB"], isInternational: true, isHome: false,
        cheapestRate: 10, hasFreeShippingThreshold: false, freeShippingThreshold: null,
        methods: [{ name: "Standard", price: 10, weightBased: false }],
      }],
    }],
  },
});

buildRuleFixtures("SHIP_NO_ROW", {
  delivery: {
    profiles: [{
      name: "General",
      zones: [{
        name: "US Only", countries: ["US"], isInternational: false, isHome: true,
        cheapestRate: 5, hasFreeShippingThreshold: true, freeShippingThreshold: 50,
        methods: [{ name: "Standard", price: 5, weightBased: false }],
      }],
    }],
  },
});

buildRuleFixtures("SHIP_NO_FREE_THRESHOLD", {
  delivery: {
    profiles: [{
      name: "General",
      zones: [{
        name: "Domestic", countries: ["US"], isInternational: false, isHome: true,
        cheapestRate: 5, hasFreeShippingThreshold: false, freeShippingThreshold: null,
        methods: [{ name: "Standard", price: 5, weightBased: false }],
      }],
    }],
  },
});

buildRuleFixtures("PROD_NO_WEIGHT", {
  products: { stats: { noWeightPct: 25 } },
  delivery: {
    profiles: [{
      name: "General",
      zones: [{
        name: "Domestic", countries: ["US"], isInternational: false, isHome: true,
        cheapestRate: 5, hasFreeShippingThreshold: false, freeShippingThreshold: null,
        methods: [{ name: "Weight", price: null, weightBased: true }],
      }],
    }],
  },
});

buildRuleFixtures("LOC_MISSING", {
  locations: [],
});

buildRuleFixtures("PDP_NO_DELIVERY_DATE", {
  theme: { sections: { productHasDeliveryDate: false } },
});

buildRuleFixtures("PROD_THIN_DESC", {
  products: { stats: { thinDescPct: 30 } },
});

buildRuleFixtures("PROD_SINGLE_IMAGE", {
  products: { stats: { singleImagePct: 30 } },
});

buildRuleFixtures("PROD_MISSING_ALT", {
  products: { stats: { missingAltPct: 30 } },
});

buildRuleFixtures("PROD_NO_SKU", {
  products: { stats: { noSkuPct: 30 } },
});

buildRuleFixtures("PROD_BROKEN_COMPARE_AT", {
  products: { stats: { compareAtBrokenCount: 2 } },
});

buildRuleFixtures("PROD_DUPLICATE", {
  products: { stats: { duplicatePairCount: 1 } },
});

buildRuleFixtures("PROD_INVENTORY_OFF", {
  products: { stats: { inventoryOffPct: 60 } },
});

buildRuleFixtures("SEO_DEFAULT_TITLE", {
  theme: { homepageSeo: { title: "Home", description: "desc" } },
});

buildRuleFixtures("SEO_NO_META_DESC", {
  theme: { homepageSeo: { title: "Good Title", description: "" } },
});

buildRuleFixtures("SEO_ROBOTS_BLOCKED", {
  storefront: { robotsTxtBlocksAll: true, storefrontPasswordProtected: true },
});

buildRuleFixtures("SEO_NO_SITEMAP", {
  storefront: { sitemapStatus: 404, sitemapUrlCount: 0 },
});

buildRuleFixtures("SEO_NO_CUSTOM_DOMAIN", {
  shop: {
    primaryDomain: { host: "test.myshopify.com", url: "https://test.myshopify.com", isCustom: false },
  },
});

buildRuleFixtures("SEO_HEAVY_IMAGES", {
  products: { stats: { heavyImagePct: 30 } },
});

buildRuleFixtures("SEO_PRODUCT_META", {
  products: { stats: { missingProductSeoPct: 30 } },
});

buildRuleFixtures("SEO_HANDLE_NOISE", {
  products: { stats: { handleNoisePct: 15 } },
});

buildRuleFixtures("TRUST_NO_REVIEWS", {
  reviewsAppInstalled: false,
  theme: { sections: { pdpHasReviews: false } },
});

buildRuleFixtures("TRUST_NO_ABOUT", {
  pages: { about: false, aboutBodyLength: 0 },
});

buildRuleFixtures("TRUST_NO_CONTACT", {
  pages: { contact: false },
  shop: { contactEmail: null },
});

buildRuleFixtures("TRUST_VAGUE_RETURNS", {
  shop: {
    policies: {
      REFUND_POLICY: { body: "Returns allowed.", url: "https://example.com/refund" },
    },
  },
}, {
  shop: {
    policies: {
      REFUND_POLICY: {
        body: "Our refund policy allows returns within 30 days of purchase with original receipt. Items must be unused and in original packaging. Refunds are processed within 5-7 business days after we receive your return. Shipping costs for returns are the responsibility of the customer unless the item was defective or we made an error.",
        url: "https://example.com/refund",
      },
    },
  },
});

buildRuleFixtures("TRUST_NO_FAQ", {
  pages: { faq: false },
});

buildRuleFixtures("TRUST_BROKEN_SOCIAL", {
  theme: {
    socialLinks: [{ platform: "twitter", url: "https://twitter.com/broken", reachable: false }],
  },
});

buildRuleFixtures("TRUST_EMPTY_BADGES", {
  theme: { sections: { trustBadgesEmpty: true } },
});

buildRuleFixtures("CHK_NO_ABANDONED", {
  abandonedCartActive: false,
});

buildRuleFixtures("CHK_VISIBLE_DISCOUNT_FIELD", {
  shop: { checkoutSettings: { discountFieldVisible: true } },
  activePriceRulesCount: 0,
});

buildRuleFixtures("CHK_NO_LOCAL_CURRENCY", {
  shop: { marketsEnabled: false },
});

buildRuleFixtures("CHK_NO_UPSELL", {
  theme: { sections: { cartHasUpsell: false } },
  installedApps: [],
});

buildRuleFixtures("CHK_REQUIRE_PHONE", {
  shop: { checkoutSettings: { phoneRequired: true } },
});

buildRuleFixtures("CHK_FORCE_ACCOUNT", {
  shop: { checkoutSettings: { customerAccountsRequired: true } },
});

buildRuleFixtures("THM_NOT_OS20", {
  theme: { isOnlineStore20: false },
});

buildRuleFixtures("THM_LOW_LIGHTHOUSE", {
  mobile: { lighthousePerformance: 35 },
});

buildRuleFixtures("THM_TINY_TAPS", {
  mobile: { smallestTapTargetPx: 32 },
});

buildRuleFixtures("THM_HEAVY_HERO", {
  mobile: { heroImageBytes: 2_000_000, heroImageLazy: false },
});

buildRuleFixtures("THM_SMALL_FONT", {
  mobile: { pdpDescriptionFontPx: 12 },
});

buildRuleFixtures("THM_NO_STICKY_ATC", {
  mobile: { stickyAtcPresent: false },
});

buildRuleFixtures("THM_OUTDATED", {
  theme: {
    themeStoreId: 887,
    themeStoreLatestVersion: 15,
    installedVersion: 10,
  },
});
