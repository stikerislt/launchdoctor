import { allRules } from "../rules";
import { runRules, computeLaunchScore, computeSeoScore, computeCoreScore } from "../engine";
import { createBaseSnapshot } from "./fixtures/base-snapshot";
import { ruleFixtures } from "./fixtures/rule-fixtures";

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
    sections: {
      productHasDeliveryDate: false,
      cartHasUpsell: false,
      pdpHasReviews: false,
      trustBadgesEmpty: true,
    },
  },
  products: {
    stats: {
      thinDescPct: 30, singleImagePct: 30, noImagePct: 0, missingAltPct: 0, noSkuPct: 0,
      compareAtBrokenCount: 0, duplicatePairCount: 0, noWeightPct: 0,
      inventoryOffPct: 0, heavyImagePct: 0, handleNoisePct: 0, missingProductSeoPct: 0,
    },
  },
  mobile: {
    lighthousePerformance: 35,
    smallestTapTargetPx: 32,
    heroImageBytes: 2_000_000,
    heroImageLazy: false,
    pdpDescriptionFontPx: 12,
    stickyAtcPresent: false,
  },
  reviewsAppInstalled: false,
  activePriceRulesCount: 0,
};

describe("audit engine", () => {
  describe("runRules", () => {
    it("returns no findings for a clean snapshot", () => {
      const findings = runRules(createBaseSnapshot());
      expect(findings).toHaveLength(0);
    });

    it("sorts findings by severity", () => {
      const snap = createBaseSnapshot({
        shop: {
          paymentSettings: { captureMode: "AUTOMATIC", captureModeKnown: true },
          policies: { REFUND_POLICY: null },
        },
        abandonedCartActive: false,
      });
      const findings = runRules(snap);
      expect(findings.length).toBeGreaterThan(0);
      const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
      for (let i = 1; i < findings.length; i++) {
        const prev = severityOrder.indexOf(findings[i - 1]!.severity);
        const curr = severityOrder.indexOf(findings[i]!.severity);
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });
  });

  describe("computeLaunchScore", () => {
    it("returns 100 for no findings", () => {
      expect(computeLaunchScore([])).toBe(100);
    });

    it("weights SEO findings into a separate pillar", () => {
      const seoOnly = runRules(
        createBaseSnapshot({
          theme: {
            homepageSeo: { title: "Home", description: "Shop our curated collection." },
          },
        }),
      );
      const seoScore = computeSeoScore(seoOnly);
      const coreScore = computeCoreScore(seoOnly);
      const launchScore = computeLaunchScore(seoOnly);

      expect(seoScore).toBeLessThan(100);
      expect(coreScore).toBe(100);
      expect(launchScore).toBeLessThan(100);
      expect(launchScore).toBeGreaterThan(seoScore * 0.35);
    });

    it("returns a meaningful score for messy stores instead of flooring at 0", () => {
      const findings = runRules(createBaseSnapshot(MESSY_STORE_OVERRIDES));
      const launchScore = computeLaunchScore(findings);
      const seoScore = computeSeoScore(findings);

      expect(findings.length).toBeGreaterThanOrEqual(14);
      expect(launchScore).toBeGreaterThan(0);
      expect(seoScore).toBeGreaterThan(0);
    });

    it("raises SEO score when homepage SEO findings are cleared", () => {
      const before = runRules(createBaseSnapshot(MESSY_STORE_OVERRIDES));
      const after = runRules(
        createBaseSnapshot({
          ...MESSY_STORE_OVERRIDES,
          theme: {
            homepageSeo: {
              title: "Northward Systems — Premium Gear",
              description: "Shop curated outdoor equipment with fast shipping.",
            },
          },
          storefront: {
            robotsTxtBlocksAll: false,
            storefrontPasswordProtected: false,
            sitemapStatus: 200,
            sitemapUrlCount: 50,
            gscVerified: false,
          },
        }),
      );

      expect(computeSeoScore(after)).toBeGreaterThan(computeSeoScore(before));
      expect(computeLaunchScore(after)).toBeGreaterThan(computeLaunchScore(before));
    });

    it("deducts correctly for severities", () => {
      const findings = runRules(
        createBaseSnapshot({
          shop: {
            paymentSettings: { captureMode: "AUTOMATIC", captureModeKnown: true },
            policies: { REFUND_POLICY: null },
          },
          abandonedCartActive: false,
          locations: [],
        }),
      );
      const score = computeLaunchScore(findings);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe.each(allRules.map((r) => [r.code, r]))("%s", (code, rule) => {
    const fixtures = ruleFixtures[code];

    it("has fixtures defined", () => {
      expect(fixtures).toBeDefined();
    });

    it("triggers on trigger fixture", () => {
      const result = rule.evaluate(fixtures!.trigger);
      expect(result).not.toBeNull();
      expect(result!.ruleCode).toBe(code);
      expect(result!.fixSteps.length).toBeGreaterThan(0);
    });

    it("passes on pass fixture", () => {
      const result = rule.evaluate(fixtures!.pass);
      expect(result).toBeNull();
    });

    it("has stable id and metadata", () => {
      expect(rule.id).toBeGreaterThanOrEqual(1);
      expect(rule.id).toBeLessThanOrEqual(51);
      expect(rule.title).toBeTruthy();
      expect(rule.description).toBeTruthy();
    });
  });

  describe("rule uniqueness", () => {
    it("has 51 rules with unique ids and codes", () => {
      expect(allRules).toHaveLength(51);
      const ids = new Set(allRules.map((r) => r.id));
      const codes = new Set(allRules.map((r) => r.code));
      expect(ids.size).toBe(51);
      expect(codes.size).toBe(51);
    });
  });
});
