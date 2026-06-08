import { describe, it, expect } from "vitest";
import { runRules } from "../../audit-engine/engine";
import { createBaseSnapshot } from "../../audit-engine/__tests__/fixtures/base-snapshot";

const MESSY_STORE_OVERRIDES = {
  shop: {
    paymentSettings: {
      captureMode: "AUTOMATIC" as const,
      captureModeKnown: true,
      supportedDigitalWallets: [],
    },
    policies: {
      REFUND_POLICY: null,
      PRIVACY_POLICY: null,
      TERMS_OF_SERVICE: null,
      SHIPPING_POLICY: null,
    },
    checkoutSettings: {
      customerAccountsRequired: true,
      phoneRequired: true,
      discountFieldVisible: true,
    },
    contactEmail: null,
    marketsEnabled: false,
  },
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
  locations: [],
  abandonedCartActive: false,
  storefront: {
    robotsTxtBlocksAll: true,
    storefrontPasswordProtected: true,
    sitemapStatus: 404,
    sitemapUrlCount: 0,
    sitemapProductUrls: 0,
    sitemapCollectionUrls: 0,
    sitemapPageUrls: 0,
    gscVerified: false,
  },
  pages: { about: false, aboutBodyLength: 0, contact: false, faq: false },
  theme: {
    homepageSeo: { title: "Home", description: "" },
    isOnlineStore20: false,
    sections: { productHasDeliveryDate: false, cartHasUpsell: false, pdpHasReviews: false, trustBadgesEmpty: true },
  },
  products: {
    stats: {
      thinDescPct: 30, singleImagePct: 30, noImagePct: 0, missingAltPct: 0, noSkuPct: 0,
      compareAtBrokenCount: 0, duplicatePairCount: 0, noWeightPct: 0,
      inventoryOffPct: 0, heavyImagePct: 0, handleNoisePct: 0, missingProductSeoPct: 0,
    },
  },
  mobile: { lighthousePerformance: 35, smallestTapTargetPx: 32, heroImageBytes: 2_000_000, heroImageLazy: false, pdpDescriptionFontPx: 12, stickyAtcPresent: false },
  reviewsAppInstalled: false,
  activePriceRulesCount: 0,
};

const EXPECTED_CODES = [
  "PAY_AUTO_CAPTURE",
  "POL_REFUND_MISSING",
  "POL_ALL_MISSING",
  "PAY_WALLETS_DISABLED",
  "SHIP_LOW_INTL_RATE",
  "SHIP_NO_HOME_ZONE",
  "LOC_MISSING",
  "SEO_DEFAULT_TITLE",
  "SEO_NO_META_DESC",
  "SEO_ROBOTS_BLOCKED",
  "SEO_NO_SITEMAP",
  "TRUST_NO_ABOUT",
  "TRUST_NO_CONTACT",
  "CHK_NO_ABANDONED",
];

describe("integration: messy dev store", () => {
  it("returns expected finding codes", () => {
    const snapshot = createBaseSnapshot(MESSY_STORE_OVERRIDES as Record<string, unknown>);
    const findings = runRules(snapshot);
    const codes = findings.map((f) => f.ruleCode);

    for (const expected of EXPECTED_CODES) {
      expect(codes).toContain(expected);
    }

    expect(findings.length).toBeGreaterThanOrEqual(14);
  });
});
