import type { SnapshotProduct } from "./types";
import { isGenericProductTitle, suggestProductTitle } from "./product-naming";
import { PRODUCT_SEO_EDIT_LIMIT, type ProductSeoDraft, type ProductSeoUpdate } from "./types";
import {
  getProductSeoFixTargets,
  getSnapshotProducts,
  parseAuditSnapshot,
  suggestProductSeoDescription,
  suggestProductSeoTitle,
} from "./snapshot.server";

export { PRODUCT_SEO_EDIT_LIMIT };

export function buildProductSeoDrafts(
  products: SnapshotProduct[],
  shopName: string,
  limit = PRODUCT_SEO_EDIT_LIMIT,
): ProductSeoDraft[] {
  return getProductSeoFixTargets(products)
    .slice(0, limit)
    .map((product) => {
      const missingTitle = !product.seo?.title?.trim();
      const missingDescription = !product.seo?.description?.trim();
      const hasBadProductTitle = isGenericProductTitle(product.title);
      const suggestedProductTitle = suggestProductTitle(product.title, product.handle);
      const namingBase = hasBadProductTitle ? suggestedProductTitle : product.title;
      const currentSeoTitle = product.seo?.title?.trim() ?? "";
      const currentSeoDescription = product.seo?.description?.trim() ?? "";
      const suggestedSeoTitle = suggestProductSeoTitle(namingBase, shopName);
      const suggestedSeoDescription = suggestProductSeoDescription(namingBase, shopName);

      return {
        productId: product.id,
        productTitle: product.title,
        suggestedProductTitle,
        hasBadProductTitle,
        currentSeoTitle,
        currentSeoDescription,
        suggestedSeoTitle,
        suggestedSeoDescription,
        seoTitle: suggestedSeoTitle,
        seoDescription: suggestedSeoDescription,
        missingTitle,
        missingDescription,
      };
    });
}

export function parseProductSeoUpdates(
  raw: string,
  allowedProductIds: Set<string>,
): ProductSeoUpdate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid product SEO data.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid product SEO data.");
  }

  const updates: ProductSeoUpdate[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;

    const record = entry as Record<string, unknown>;
    const productId = String(record.productId ?? "").trim();
    const productTitle = String(record.productTitle ?? "").trim();
    const seoTitle = String(record.seoTitle ?? record.title ?? "").trim();
    const seoDescription = String(record.seoDescription ?? record.description ?? "").trim();

    if (!productId || !allowedProductIds.has(productId)) continue;
    if (!seoTitle || !seoDescription) {
      throw new Error("Each product needs both an SEO title and meta description.");
    }
    if (productTitle && isGenericProductTitle(productTitle)) {
      throw new Error(`Choose a descriptive product name instead of "${productTitle}".`);
    }

    updates.push({
      productId,
      productTitle: productTitle || undefined,
      seoTitle,
      seoDescription,
    });
  }

  if (updates.length === 0) {
    throw new Error("Add SEO titles and descriptions for at least one product.");
  }

  return updates;
}

export function resolveProductSeoUpdatesFromForm(
  snapshotJson: unknown,
  rawProductSeo: string,
): ProductSeoUpdate[] {
  const snapshot = parseAuditSnapshot(snapshotJson);
  const allowedIds = new Set(
    buildProductSeoDrafts(
      getSnapshotProducts(snapshot),
      snapshot?.shop.name ?? "",
    ).map((draft) => draft.productId),
  );

  return parseProductSeoUpdates(rawProductSeo, allowedIds);
}
