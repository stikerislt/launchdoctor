export enum Severity {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum Category {
  PAYMENTS_FRAUD = "PAYMENTS_FRAUD",
  SHIPPING_FULFILLMENT = "SHIPPING_FULFILLMENT",
  PRODUCT_CATALOG = "PRODUCT_CATALOG",
  SEO_DISCOVERABILITY = "SEO_DISCOVERABILITY",
  TRUST_SIGNALS = "TRUST_SIGNALS",
  CHECKOUT_CONVERSION = "CHECKOUT_CONVERSION",
  MOBILE_THEME = "MOBILE_THEME",
}

export type PolicyType =
  | "REFUND_POLICY"
  | "PRIVACY_POLICY"
  | "TERMS_OF_SERVICE"
  | "SHIPPING_POLICY";

export interface StoreSnapshot {
  capturedAt: string;
  shop: {
    id?: string;
    name: string;
    handle: string;
    contactEmail: string | null;
    primaryDomain: { host: string; url: string; isCustom: boolean };
    countryCode: string;
    paymentSettings: {
      acceptedCardBrands: string[];
      supportedDigitalWallets: string[];
      captureMode: "AUTOMATIC" | "MANUAL";
      /** False when capture mode could not be read from the Admin API or recent orders. */
      captureModeKnown: boolean;
      testMode: boolean;
      threeDSConfigured: boolean;
    };
    policies: Record<
      PolicyType,
      { body: string; url: string } | null
    >;
    marketsEnabled: boolean;
    checkoutSettings: {
      customerAccountsRequired: boolean;
      phoneRequired: boolean;
      discountFieldVisible: boolean;
    };
  };
  delivery: {
    profiles: Array<{
      name: string;
      zones: Array<{
        name: string;
        countries: string[];
        isInternational: boolean;
        isHome: boolean;
        cheapestRate: number | null;
        hasFreeShippingThreshold: boolean;
        freeShippingThreshold: number | null;
        methods: Array<{
          name: string;
          price: number | null;
          weightBased: boolean;
        }>;
      }>;
    }>;
  };
  locations: Array<{
    name: string;
    address: {
      country: string | null;
      city: string | null;
      zip: string | null;
    };
    fulfillsOnlineOrders: boolean;
  }>;
  products: {
    total: number;
    sampled: Array<{
      id: string;
      title: string;
      handle: string;
      status: string;
      descriptionLength: number;
      imageCount: number;
      missingAltCount: number;
      images?: Array<{
        id: string;
        url: string;
        altText: string | null;
        bytes: number | null;
      }>;
      heroImageBytes: number | null;
      variants: Array<{
        id?: string;
        sku: string | null;
        price: number;
        compareAtPrice: number | null;
        weight: number;
        inventoryItemId?: string | null;
        inventoryTracked: boolean;
      }>;
      seo: { title: string | null; description: string | null };
    }>;
    stats: {
      thinDescPct: number;
      singleImagePct: number;
      missingAltPct: number;
      noSkuPct: number;
      compareAtBrokenCount: number;
      duplicatePairCount: number;
      noWeightPct: number;
      inventoryOffPct: number;
      heavyImagePct: number;
      handleNoisePct: number;
      missingProductSeoPct: number;
    };
  };
  theme: {
    name: string;
    themeStoreId: number | null;
    themeStoreLatestVersion: number | null;
    installedVersion: number | null;
    isOnlineStore20: boolean;
    homepageSeo: { title: string | null; description: string | null };
    sections: {
      productHasDeliveryDate: boolean;
      cartHasUpsell: boolean;
      pdpHasReviews: boolean;
      trustBadgesEmpty: boolean;
    };
    socialLinks: Array<{ platform: string; url: string; reachable: boolean }>;
  };
  storefront: {
    robotsTxtBlocksAll: boolean;
    storefrontPasswordProtected: boolean;
    sitemapStatus: number;
    sitemapUrlCount: number;
    sitemapProductUrls: number;
    sitemapCollectionUrls: number;
    sitemapPageUrls: number;
    gscVerified: boolean;
  };
  orders: {
    last30d: { count: number; averageOrderValue: number | null };
    hasRealOrder: boolean;
  };
  reviewsAppInstalled: boolean;
  abandonedCartActive: boolean;
  activePriceRulesCount: number;
  manualPaymentMethods: string[];
  manualPaymentConfirmationCustomized: boolean;
  mobile: {
    lighthousePerformance: number | null;
    smallestTapTargetPx: number | null;
    heroImageBytes: number | null;
    heroImageLazy: boolean | null;
    pdpDescriptionFontPx: number | null;
    stickyAtcPresent: boolean | null;
  };
  pages: {
    about: boolean;
    aboutBodyLength: number;
    contact: boolean;
    faq: boolean;
  };
  installedApps: Array<{ handle: string; title: string }>;
}

export interface Finding {
  ruleId: number;
  ruleCode: string;
  severity: Severity;
  category: Category;
  title: string;
  body: string;
  fixSteps: string[];
  fixDeepLink: string | null;
  evidence: Record<string, unknown> | null;
  confidence: number;
}

export interface Rule {
  id: number;
  code: string;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  evaluate: (snap: StoreSnapshot) => Finding | null;
}
