import { createMinimalSnapshot } from "../audit-engine/minimal-snapshot";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { StoreSnapshot, PolicyType } from "../audit-engine/types";
import { graphqlWithRetry } from "./graphql";
import { fetchPublicData, headCheck } from "./public-fetch";
import { collectMobileInsights } from "./mobile-insights";
import { resolveStorefrontUrl } from "./storefront-url";
import { resolveHomepageSeo as resolveHomepageSeoFields } from "../audit-engine/utils/homepage-seo";
import { normalizedLevenshtein } from "../audit-engine/utils/levenshtein";
import {
  SHOP_QUERY,
  DELIVERY_QUERY,
  PRODUCTS_QUERY,
  THEMES_QUERY,
  LOCATIONS_QUERY,
  ORDERS_STATS_QUERY,
  ORDERS_CAPTURE_HINT_QUERY,
} from "./queries/shop";

interface ShopQueryResult {
  shop: {
    id: string;
    name: string;
    contactEmail: string | null;
    billingAddress: { countryCodeV2: string } | null;
    primaryDomain: { host: string; url: string; sslEnabled: boolean };
    paymentSettings: { supportedDigitalWallets: string[] };
    shopPolicies: Array<{ type: string; body: string; url: string }>;
    titleTag: { value: string } | null;
    descriptionTag: { value: string } | null;
    description: string | null;
  };
}

/**
 * Logs an optional collector failure and returns null so the audit can continue
 * with degraded data instead of silently swallowing the error.
 */
function logOptionalFailure<T>(label: string): (err: unknown) => T | null {
  return (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[collector] optional data "${label}" unavailable: ${message}`);
    return null;
  };
}

export async function buildSnapshot(
  admin: AdminApiContext,
  shopDomain: string,
): Promise<StoreSnapshot> {
  const handle = shopDomain.replace(".myshopify.com", "");
  const shopUrl = `https://${shopDomain}`;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const isoDate = thirtyDaysAgo.toISOString().split("T")[0];

  const [
    shopData,
    deliveryData,
    productsData,
    themeData,
    locationsData,
    ordersData,
    publicData,
  ] = await Promise.all([
    graphqlWithRetry<ShopQueryResult>(admin, SHOP_QUERY),
    graphqlWithRetry<DeliveryQueryResult>(admin, DELIVERY_QUERY).catch(
      logOptionalFailure<DeliveryQueryResult>("delivery profiles"),
    ),
    collectProducts(admin),
    graphqlWithRetry<ThemeQueryResult>(admin, THEMES_QUERY).catch(
      logOptionalFailure<ThemeQueryResult>("themes"),
    ),
    graphqlWithRetry<LocationQueryResult>(admin, LOCATIONS_QUERY).catch(
      logOptionalFailure<LocationQueryResult>("locations"),
    ),
    collectOrders(admin, isoDate!),
    fetchPublicData(shopDomain),
  ]);

  const storefrontUrl = resolveStorefrontUrl(
    shopData.shop.primaryDomain,
    shopDomain,
  );
  const mobileData = await collectMobileInsights(storefrontUrl);

  const policies = normalizePolicies(shopData.shop.shopPolicies);
  const products = productsData;
  const captureHintOrders = await loadCaptureHintOrders(admin);
  const paymentCapture = resolvePaymentCapture(null, captureHintOrders);
  const homeCountry = shopData.shop.billingAddress?.countryCodeV2 ?? "US";
  const delivery = normalizeDelivery(deliveryData, homeCountry);
  const theme = normalizeTheme(themeData);
  const locations = normalizeLocations(locationsData);

  const socialLinks = theme.socialLinks.map(async (link) => ({
    ...link,
    reachable: await headCheck(link.url),
  }));
  const resolvedSocial = await Promise.all(socialLinks);

  return {
    capturedAt: new Date().toISOString(),
    shop: {
      id: shopData.shop.id,
      name: shopData.shop.name,
      handle,
      contactEmail: shopData.shop.contactEmail,
      primaryDomain: {
        host: shopData.shop.primaryDomain.host,
        url: shopData.shop.primaryDomain.url,
        isCustom: !shopData.shop.primaryDomain.host.endsWith("myshopify.com"),
      },
      countryCode: homeCountry,
      paymentSettings: {
        acceptedCardBrands: ["VISA", "MASTERCARD"],
        supportedDigitalWallets: shopData.shop.paymentSettings.supportedDigitalWallets ?? [],
        captureMode: paymentCapture.captureMode,
        captureModeKnown: paymentCapture.captureModeKnown,
        testMode: false,
        threeDSConfigured: false,
      },
      policies,
      marketsEnabled: false,
      checkoutSettings: {
        customerAccountsRequired: false,
        phoneRequired: false,
        discountFieldVisible: false,
      },
    },
    delivery,
    locations,
    products,
    theme: {
      ...theme,
      homepageSeo: resolveHomepageSeo(shopData.shop, publicData.homepageSeo, theme.name),
      socialLinks: resolvedSocial,
    },
    storefront: {
      robotsTxtBlocksAll: publicData.robotsTxtBlocksAll,
      storefrontPasswordProtected: publicData.storefrontPasswordProtected,
      sitemapStatus: publicData.sitemapStatus,
      sitemapUrlCount: publicData.sitemapUrlCount,
      sitemapProductUrls: publicData.sitemap.products,
      sitemapCollectionUrls: publicData.sitemap.collections,
      sitemapPageUrls: publicData.sitemap.pages,
      gscVerified: publicData.gscVerified,
    },
    orders: ordersData,
    reviewsAppInstalled: false,
    abandonedCartActive: true,
    activePriceRulesCount: 0,
    manualPaymentMethods: [],
    manualPaymentConfirmationCustomized: true,
    mobile: mobileData,
    pages: publicData.pages,
    installedApps: [],
  };
}

function resolveHomepageSeo(
  shop: ShopQueryResult["shop"],
  publicSeo: { title: string | null; description: string | null },
  themeName: string,
): { title: string | null; description: string | null } {
  return resolveHomepageSeoFields({
    titleTag: shop.titleTag?.value,
    descriptionTag: shop.descriptionTag?.value,
    shopDescription: shop.description,
    publicSeo,
    shopName: shop.name,
    themeName,
  });
}

function normalizePolicies(
  policies: Array<{ type: string; body: string; url: string }>,
): StoreSnapshot["shop"]["policies"] {
  const result: StoreSnapshot["shop"]["policies"] = {
    REFUND_POLICY: null,
    PRIVACY_POLICY: null,
    TERMS_OF_SERVICE: null,
    SHIPPING_POLICY: null,
  };
  for (const p of policies) {
    const key = p.type as PolicyType;
    if (key in result) {
      result[key] = { body: p.body, url: p.url };
    }
  }
  return result;
}

interface DeliveryQueryResult {
  deliveryProfiles: {
    edges: Array<{
      node: {
        name: string;
        profileLocationGroups: Array<{
          locationGroupZones: {
            edges: Array<{
              node: {
                zone: { name: string; countries: Array<{ code: { countryCode: string } }> };
                methodDefinitions: {
                  edges: Array<{
                    node: {
                      name: string;
                      rateProvider: { price?: { amount: string } } | null;
                    };
                  }>;
                };
              };
            }>;
          };
        }>;
      };
    }>;
  };
}

function normalizeDelivery(
  data: DeliveryQueryResult | null,
  homeCountry: string,
): StoreSnapshot["delivery"] {
  if (!data) {
    return { profiles: [] };
  }

  const profiles = data.deliveryProfiles.edges.map(({ node }) => ({
    name: node.name,
    zones: node.profileLocationGroups.flatMap((g) =>
      g.locationGroupZones.edges.map(({ node: zoneNode }) => {
        const countries = zoneNode.zone.countries.map((c) => c.code.countryCode);
        const methods = zoneNode.methodDefinitions.edges.map(({ node: m }) => ({
          name: m.name,
          price: m.rateProvider?.price ? parseFloat(m.rateProvider.price.amount) : null,
          weightBased: false,
        }));
        const prices = methods.map((m) => m.price).filter((p): p is number => p !== null);
        const cheapestRate = prices.length ? Math.min(...prices) : null;
        const freeMethod = methods.find((m) => m.price === 0);
        return {
          name: zoneNode.zone.name,
          countries,
          isInternational: !countries.includes(homeCountry),
          isHome: countries.includes(homeCountry),
          cheapestRate,
          hasFreeShippingThreshold: !!freeMethod,
          freeShippingThreshold: freeMethod ? 0 : null,
          methods,
        };
      }),
    ),
  }));

  return { profiles };
}

interface ThemeQueryResult {
  themes: {
    edges: Array<{
      node: { id: string; name: string; role: string; themeStoreId: number | null };
    }>;
  };
}

function normalizeTheme(data: ThemeQueryResult | null): StoreSnapshot["theme"] {
  const main = data?.themes.edges[0]?.node;
  return {
    name: main?.name ?? "Unknown",
    themeStoreId: main?.themeStoreId ?? null,
    themeStoreLatestVersion: null,
    installedVersion: null,
    isOnlineStore20: true,
    homepageSeo: { title: null, description: null },
    sections: {
      productHasDeliveryDate: false,
      cartHasUpsell: false,
      pdpHasReviews: false,
      trustBadgesEmpty: false,
    },
    socialLinks: [],
  };
}

interface LocationQueryResult {
  locations: {
    edges: Array<{
      node: {
        name: string;
        fulfillsOnlineOrders: boolean;
        address: { country: string | null; city: string | null; zip: string | null };
      };
    }>;
  };
}

function normalizeLocations(data: LocationQueryResult | null): StoreSnapshot["locations"] {
  if (!data) return [];
  return data.locations.edges.map(({ node }) => ({
    name: node.name,
    address: node.address,
    fulfillsOnlineOrders: node.fulfillsOnlineOrders,
  }));
}

interface ProductNode {
  id: string;
  title: string;
  handle: string;
  status: string;
  description: string;
  seo: { title: string | null; description: string | null };
  media?: {
    edges: Array<{
      node: {
        id?: string;
        alt?: string | null;
        image?: { url?: string | null } | null;
      };
    }>;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        sku: string | null;
        price: string;
        compareAtPrice: string | null;
        inventoryItem: { id: string; tracked: boolean } | null;
      };
    }>;
  };
}

const MAX_CATALOG_PRODUCTS = 10_000;
const FIX_DETAIL_SAMPLE_SIZE = 100;
const IMAGE_BYTE_SAMPLE_SIZE = 50;

function mapProductNode(p: ProductNode): StoreSnapshot["products"]["sampled"][number] {
  const mediaImages =
    p.media?.edges
      .map(({ node }) => {
        const id = node.id;
        const url = node.image?.url;
        if (!id || !url) return null;
        return {
          id,
          url,
          altText: node.alt ?? null,
          bytes: null as number | null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null) ?? [];

  const images = mediaImages;
  const variants = p.variants.edges.map(({ node: v }) => ({
    id: v.id,
    sku: v.sku,
    price: parseFloat(v.price),
    compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
    weight: 0,
    inventoryItemId: v.inventoryItem?.id ?? null,
    inventoryTracked: v.inventoryItem?.tracked ?? false,
  }));

  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    descriptionLength: (p.description ?? "").replace(/<[^>]*>/g, "").length,
    imageCount: images.length,
    missingAltCount: images.filter((i) => !i.altText).length,
    images,
    heroImageBytes: null as number | null,
    variants,
    seo: p.seo,
  };
}

async function collectProducts(admin: AdminApiContext): Promise<StoreSnapshot["products"]> {
  const allProducts: ProductNode[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext && allProducts.length < MAX_CATALOG_PRODUCTS) {
    const data: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: Array<{ node: ProductNode }>;
      };
    } = await graphqlWithRetry(admin, PRODUCTS_QUERY, { cursor });

    allProducts.push(...data.products.edges.map((e: { node: ProductNode }) => e.node));
    hasNext = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  const active = allProducts.filter((p) => p.status === "ACTIVE");
  const catalog = active.map(mapProductNode);
  const sampled = catalog.slice(0, Math.min(catalog.length, FIX_DETAIL_SAMPLE_SIZE));

  await enrichProductImageBytes(sampled.slice(0, IMAGE_BYTE_SAMPLE_SIZE));

  const stats = computeProductStats(catalog, active.length);

  return { total: active.length, sampled, stats };
}

const HEAVY_IMAGE_BYTES = 500_000;

async function enrichProductImageBytes(
  products: StoreSnapshot["products"]["sampled"],
): Promise<void> {
  await Promise.all(
    products.map(async (product) => {
      const hero = product.images?.[0];
      if (!hero) return;
      hero.bytes = await fetchImageBytes(hero.url);
      product.heroImageBytes = hero.bytes;
    }),
  );
}

async function fetchImageBytes(url: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const head = await fetch(url, { method: "HEAD", signal: controller.signal });
    const headLength = head.headers.get("content-length");
    if (headLength) return parseInt(headLength, 10);

    const res = await fetch(url, { method: "GET", signal: controller.signal });
    if (!res.ok) return null;

    const contentLength = res.headers.get("content-length");
    if (contentLength) return parseInt(contentLength, 10);

    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.byteLength;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function computeProductStats(
  sampled: StoreSnapshot["products"]["sampled"],
  total: number,
): StoreSnapshot["products"]["stats"] {
  if (sampled.length === 0) {
    return {
      thinDescPct: 0, singleImagePct: 0, noImagePct: 0, missingAltPct: 0, noSkuPct: 0,
      compareAtBrokenCount: 0, duplicatePairCount: 0, noWeightPct: 0,
      inventoryOffPct: 0, heavyImagePct: 0, handleNoisePct: 0, missingProductSeoPct: 0,
    };
  }

  const thinDesc = sampled.filter((p) => p.descriptionLength < 50).length;
  const noImage = sampled.filter((p) => p.imageCount === 0).length;
  const singleImage = sampled.filter((p) => p.imageCount < 3).length;
  const missingAlt = sampled.filter((p) => p.missingAltCount > 0).length;
  const allVariants = sampled.flatMap((p) => p.variants);
  const noSku = allVariants.filter((v) => !v.sku).length;
  const compareAtBroken = allVariants.filter(
    (v) => v.compareAtPrice !== null && v.compareAtPrice <= v.price,
  ).length;
  const noWeight = allVariants.filter((v) => v.weight === 0).length;
  const inventoryOff = allVariants.filter((v) => !v.inventoryTracked).length;
  const handleNoise = sampled.filter((p) => /-\d{5,}$/.test(p.handle)).length;
  const heavy = sampled.filter((p) => (p.heroImageBytes ?? 0) > HEAVY_IMAGE_BYTES).length;
  const missingProductSeo = sampled.filter(
    (p) => !p.seo?.title?.trim() || !p.seo?.description?.trim(),
  ).length;

  let duplicatePairs = 0;
  for (let i = 0; i < sampled.length; i++) {
    for (let j = i + 1; j < sampled.length; j++) {
      if (normalizedLevenshtein(sampled[i]!.title, sampled[j]!.title) < 0.2) {
        duplicatePairs++;
      }
    }
  }

  return {
    thinDescPct: (thinDesc / sampled.length) * 100,
    singleImagePct: (singleImage / sampled.length) * 100,
    noImagePct: (noImage / sampled.length) * 100,
    missingAltPct: (missingAlt / sampled.length) * 100,
    noSkuPct: allVariants.length ? (noSku / allVariants.length) * 100 : 0,
    compareAtBrokenCount: compareAtBroken,
    duplicatePairCount: duplicatePairs,
    noWeightPct: allVariants.length ? (noWeight / allVariants.length) * 100 : 0,
    inventoryOffPct: allVariants.length ? (inventoryOff / allVariants.length) * 100 : 0,
    heavyImagePct: (heavy / sampled.length) * 100,
    handleNoisePct: (handleNoise / sampled.length) * 100,
    missingProductSeoPct: (missingProductSeo / sampled.length) * 100,
  };
}

async function collectOrders(
  admin: AdminApiContext,
  isoDate: string,
): Promise<StoreSnapshot["orders"]> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Orders query timeout")), 10_000),
    );
    const data = await Promise.race([
      graphqlWithRetry<{
        orders: {
          edges: Array<{
            node: { totalPriceSet: { shopMoney: { amount: string } }; test: boolean };
          }>;
        };
      }>(admin, ORDERS_STATS_QUERY, { query: `created_at:>=${isoDate}` }),
      timeout,
    ]);

    const realOrders = data.orders.edges.filter(({ node }) => !node.test);
    const totals = realOrders.map(({ node }) =>
      parseFloat(node.totalPriceSet.shopMoney.amount),
    );
    const aov = totals.length
      ? totals.reduce((a, b) => a + b, 0) / totals.length
      : null;

    return {
      last30d: { count: realOrders.length, averageOrderValue: aov },
      hasRealOrder: realOrders.length > 0,
    };
  } catch {
    return { last30d: { count: 0, averageOrderValue: null }, hasRealOrder: false };
  }
}

export async function buildPublicSnapshot(
  shopDomain: string,
): Promise<StoreSnapshot> {
  const handle = shopDomain.replace(".myshopify.com", "");
  const shopUrl = `https://${shopDomain}`;

  const publicData = await fetchPublicData(shopDomain);
  const mobileData = await collectMobileInsights(shopUrl);

  return createMinimalSnapshot({
    shop: {
      handle,
      contactEmail: null,
      primaryDomain: {
        host: shopDomain,
        url: shopUrl,
        isCustom: !shopDomain.includes("myshopify.com"),
      },
    } as StoreSnapshot["shop"],
    theme: {
      homepageSeo: publicData.homepageSeo,
    } as StoreSnapshot["theme"],
    storefront: {
      robotsTxtBlocksAll: publicData.robotsTxtBlocksAll,
      storefrontPasswordProtected: publicData.storefrontPasswordProtected,
      sitemapStatus: publicData.sitemapStatus,
      sitemapUrlCount: publicData.sitemapUrlCount,
      sitemapProductUrls: publicData.sitemap.products,
      sitemapCollectionUrls: publicData.sitemap.collections,
      sitemapPageUrls: publicData.sitemap.pages,
      gscVerified: publicData.gscVerified,
    },
    mobile: mobileData,
    pages: publicData.pages,
    products: {
      stats: {
        thinDescPct: 0, singleImagePct: 0, noImagePct: 0, missingAltPct: 0, noSkuPct: 0,
        compareAtBrokenCount: 0, duplicatePairCount: 0, noWeightPct: 0,
        inventoryOffPct: 0,
        heavyImagePct: mobileData.heroImageBytes && mobileData.heroImageBytes > 500_000 ? 100 : 0,
        handleNoisePct: 0,
        missingProductSeoPct: 0,
      },
    } as StoreSnapshot["products"],
  });
}

type CaptureHintOrder = { test: boolean; displayFinancialStatus: string };

async function loadCaptureHintOrders(admin: AdminApiContext): Promise<CaptureHintOrder[]> {
  try {
    const data = await graphqlWithRetry<{
      orders: { edges: Array<{ node: CaptureHintOrder }> };
    }>(admin, ORDERS_CAPTURE_HINT_QUERY);
    return data.orders.edges.map(({ node }) => node);
  } catch {
    return [];
  }
}

export function resolvePaymentCapture(
  autoCapture: boolean | null,
  orders: CaptureHintOrder[],
): { captureMode: "AUTOMATIC" | "MANUAL"; captureModeKnown: boolean } {
  if (autoCapture === true) {
    return { captureMode: "AUTOMATIC", captureModeKnown: true };
  }
  if (autoCapture === false) {
    return { captureMode: "MANUAL", captureModeKnown: true };
  }

  const real = orders.filter((o) => !o.test);
  if (real.some((o) => o.displayFinancialStatus === "AUTHORIZED")) {
    return { captureMode: "MANUAL", captureModeKnown: true };
  }
  if (
    real.length >= 2 &&
    real.every(
      (o) =>
        o.displayFinancialStatus === "PAID" ||
        o.displayFinancialStatus === "PARTIALLY_PAID",
    )
  ) {
    return { captureMode: "AUTOMATIC", captureModeKnown: true };
  }

  return { captureMode: "MANUAL", captureModeKnown: false };
}
