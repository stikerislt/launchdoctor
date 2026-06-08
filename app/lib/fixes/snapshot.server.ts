import type { StoreSnapshot } from "../../../audit-engine/types";
import { homepageSeoNeedsImprovement } from "../../../audit-engine/utils/homepage-seo";
import type { SnapshotProduct, TrustPageKey } from "./types";
import { isGenericProductTitle } from "./product-naming";

export function parseAuditSnapshot(snapshot: unknown): StoreSnapshot | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  return snapshot as StoreSnapshot;
}

export function getSnapshotProducts(snapshot: StoreSnapshot | null): SnapshotProduct[] {
  if (!snapshot?.products?.sampled) return [];
  return snapshot.products.sampled as SnapshotProduct[];
}

export const HEAVY_IMAGE_BYTES = 500_000;
export const THIN_DESCRIPTION_CHARS = 50;

export function getMissingAltTargets(products: SnapshotProduct[]) {
  const targets: Array<{
    productId: string;
    productTitle: string;
    imageId: string;
    imageUrl: string;
    suggestedAlt: string;
  }> = [];

  for (const product of products) {
    const images = product.images ?? [];
    images.forEach((image, index) => {
      if (image.altText?.trim() || !image.url) return;
      targets.push({
        productId: product.id,
        productTitle: product.title,
        imageId: image.id,
        imageUrl: image.url,
        suggestedAlt: index === 0 ? product.title : `${product.title} — image ${index + 1}`,
      });
    });
  }

  return targets;
}

export function getHeavyImageTargets(products: SnapshotProduct[]) {
  return products
    .filter((product) => (product.heroImageBytes ?? 0) > HEAVY_IMAGE_BYTES)
    .map((product) => {
      const hero = product.images?.[0];
      return {
        productId: product.id,
        productTitle: product.title,
        imageId: hero?.id ?? null,
        imageUrl: hero?.url ?? null,
        bytes: product.heroImageBytes,
      };
    })
    .filter((target) => target.imageUrl && target.imageId);
}

export function getNoImageTargets(products: SnapshotProduct[]) {
  return products.filter((product) => (product.images?.length ?? 0) === 0);
}

export function getThinDescriptionTargets(products: SnapshotProduct[]) {
  return products.filter(
    (product) => (product.descriptionLength ?? 0) < THIN_DESCRIPTION_CHARS,
  );
}

export function getMissingProductSeoTargets(products: SnapshotProduct[]) {
  return products.filter((product) => {
    const title = product.seo?.title?.trim();
    const description = product.seo?.description?.trim();
    return !title || !description;
  });
}

export function getProductSeoFixTargets(products: SnapshotProduct[]) {
  return products.filter((product) => {
    const missingSeo = getMissingProductSeoTargets([product]).length > 0;
    return missingSeo || isGenericProductTitle(product.title);
  });
}

export function getMissingSkuTargets(products: SnapshotProduct[]) {
  const targets: Array<{
    productId: string;
    productTitle: string;
    variantId: string;
    variantLabel: string;
    suggestedSku: string;
  }> = [];

  for (const product of products) {
    const variants = product.variants ?? [];
    variants.forEach((variant, index) => {
      if (variant.sku?.trim() || !variant.id) return;
      targets.push({
        productId: product.id,
        productTitle: product.title,
        variantId: variant.id,
        variantLabel: variants.length > 1 ? `Variant ${index + 1}` : "Default variant",
        suggestedSku: suggestSku(product.handle, index),
      });
    });
  }

  return targets;
}

export function getInventoryOffTargets(products: SnapshotProduct[]) {
  const targets: Array<{
    productId: string;
    productTitle: string;
    variantId: string;
    inventoryItemId: string;
    variantLabel: string;
  }> = [];

  for (const product of products) {
    const variants = product.variants ?? [];
    variants.forEach((variant, index) => {
      if (variant.inventoryTracked || !variant.inventoryItemId || !variant.id) return;
      targets.push({
        productId: product.id,
        productTitle: product.title,
        variantId: variant.id,
        inventoryItemId: variant.inventoryItemId,
        variantLabel: variants.length > 1 ? `Variant ${index + 1}` : "Default variant",
      });
    });
  }

  return targets;
}

export function getMissingTrustPages(snapshot: StoreSnapshot | null): TrustPageKey[] {
  if (!snapshot?.pages) return [];
  const missing: TrustPageKey[] = [];
  if (!snapshot.pages.about) missing.push("about");
  if (!snapshot.pages.contact) missing.push("contact");
  if (!snapshot.pages.faq) missing.push("faq");
  return missing;
}

export function suggestHomepageTitles(shopName: string): string[] {
  return [
    `${shopName} — Official Online Store`,
    `Shop ${shopName} | Quality Products & Fast Shipping`,
    `${shopName} | Discover Our Collection`,
  ];
}

export function suggestHomepageDescriptions(shopName: string): string[] {
  return [
    `Shop ${shopName} for curated products, fast shipping, and easy returns. Discover what's new today.`,
    `${shopName} brings you quality products with secure checkout and reliable delivery. Browse our latest collection.`,
    `Welcome to ${shopName}. Explore our store, find your favorites, and enjoy a smooth shopping experience.`,
  ];
}

export function suggestProductSeoTitle(productTitle: string, shopName: string): string {
  const title = `${productTitle} | ${shopName}`;
  return title.length > 70 ? title.slice(0, 67) + "..." : title;
}

export function suggestProductSeoDescription(productTitle: string, shopName: string): string {
  const description = `Shop ${productTitle} at ${shopName}. See details, check availability, and order online with secure checkout.`;
  return description.length > 320 ? description.slice(0, 317) + "..." : description;
}

export function suggestProductDescription(productTitle: string, shopName: string): string {
  return `<p><strong>${escapeHtml(productTitle)}</strong> from ${escapeHtml(shopName)}.</p><p>Discover quality you can trust — browse features, check availability, and order with secure checkout. Questions? Our support team is here to help.</p>`;
}

export function suggestSku(handle: string, variantIndex: number): string {
  const cleaned = handle
    .replace(/-\d{5,}$/, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 24);
  const sku = `${cleaned || "SKU"}-${variantIndex + 1}`;
  return sku.slice(0, 50);
}

export function homepageSeoNeedsFix(snapshot: StoreSnapshot | null): boolean {
  if (!snapshot) return false;
  return homepageSeoNeedsImprovement(
    snapshot.theme.homepageSeo,
    snapshot.shop.name,
    snapshot.theme.name,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Image format detection ── */

export type ImageFormat = "png" | "jpeg" | "webp" | "svg" | "gif" | "other";

/** Detect image format from a Shopify CDN URL (falls back to path extension parsing). */
export function detectImageFormat(url: string): ImageFormat {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".webp")) return "webp";
    if (pathname.endsWith(".png")) return "png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "jpeg";
    if (pathname.endsWith(".svg")) return "svg";
    if (pathname.endsWith(".gif")) return "gif";

    // Shopify CDN often appends ?v=... — check before query params
    const base = pathname.split("?")[0];
    if (!base) return "other";
    if (base.endsWith(".webp")) return "webp";
    if (base.endsWith(".png")) return "png";
    if (base.endsWith(".jpg") || base.endsWith(".jpeg")) return "jpeg";
    if (base.endsWith(".svg")) return "svg";
    if (base.endsWith(".gif")) return "gif";
  } catch {
    // Not a valid URL
  }
  return "other";
}

export type FormatBreakdown = {
  png: number;
  jpeg: number;
  webp: number;
  svg: number;
  gif: number;
  other: number;
  total: number;
};

/** Compute format breakdown across all product images in the snapshot. */
export function getImageFormatBreakdown(products: SnapshotProduct[]): FormatBreakdown {
  const breakdown: FormatBreakdown = {
    png: 0,
    jpeg: 0,
    webp: 0,
    svg: 0,
    gif: 0,
    other: 0,
    total: 0,
  };

  for (const product of products) {
    for (const image of product.images ?? []) {
      if (!image.url) continue;
      const fmt = detectImageFormat(image.url);
      breakdown[fmt]++;
      breakdown.total++;
    }
  }

  return breakdown;
}

export type PngImageTarget = {
  productId: string;
  productTitle: string;
  imageId: string;
  imageUrl: string;
  bytes: number | null;
};

/** Find all PNG product images (regardless of size) that could be converted to WebP. */
export function getPngImageTargets(products: SnapshotProduct[]): PngImageTarget[] {
  const targets: PngImageTarget[] = [];

  for (const product of products) {
    for (const image of product.images ?? []) {
      if (!image.url || detectImageFormat(image.url) !== "png") continue;
      targets.push({
        productId: product.id,
        productTitle: product.title,
        imageId: image.id,
        imageUrl: image.url,
        bytes: image.bytes,
      });
    }
  }

  return targets;
}
