import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { FixResult, ProductSeoUpdate } from "./types";
import { PRODUCT_SEO_EDIT_LIMIT } from "./types";
import { adminGraphql } from "./graphql.server";
import { buildProductSeoDrafts } from "./product-seo.server";
import {
  getProductSeoFixTargets,
  getSnapshotProducts,
  parseAuditSnapshot,
} from "./snapshot.server";

const PRODUCT_UPDATE = `#graphql
  mutation ProductUpdateSeo($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id title }
      userErrors { field message }
    }
  }
`;

export async function applyProductSeoFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  updates?: ProductSeoUpdate[],
  limit = PRODUCT_SEO_EDIT_LIMIT,
): Promise<FixResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  if (!snapshot) {
    return {
      success: false,
      message: "Invalid audit snapshot.",
      appliedCount: 0,
      errors: ["Invalid snapshot"],
    };
  }

  const products = getSnapshotProducts(snapshot);
  const allowedIds = new Set(
    getProductSeoFixTargets(products).slice(0, limit).map((product) => product.id),
  );

  const payloads =
    updates ??
    buildProductSeoDrafts(products, snapshot.shop.name, limit).map((draft) => ({
      productId: draft.productId,
      productTitle: draft.hasBadProductTitle ? draft.suggestedProductTitle : undefined,
      seoTitle: draft.seoTitle,
      seoDescription: draft.seoDescription,
    }));

  const targets = payloads.filter((entry) => allowedIds.has(entry.productId));

  if (targets.length === 0) {
    return {
      success: true,
      message: "All sampled products already have strong names and SEO metadata.",
      appliedCount: 0,
      errors: [],
    };
  }

  let appliedCount = 0;
  const errors: string[] = [];

  for (const target of targets) {
    const seoTitle = target.seoTitle.trim();
    const seoDescription = target.seoDescription.trim();
    const productTitle = target.productTitle?.trim();

    if (!seoTitle || !seoDescription) {
      errors.push(`${target.productId}: SEO title and description are required.`);
      continue;
    }

    try {
      const input: {
        id: string;
        title?: string;
        seo: { title: string; description: string };
      } = {
        id: target.productId,
        seo: { title: seoTitle, description: seoDescription },
      };

      if (productTitle) {
        input.title = productTitle;
      }

      await adminGraphql(admin, PRODUCT_UPDATE, { input });
      appliedCount += 1;
    } catch (error) {
      const label =
        products.find((product) => product.id === target.productId)?.title ??
        target.productId;
      errors.push(`${label}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return {
    success: errors.length === 0,
    message:
      errors.length === 0
        ? `Saved product names and SEO for ${appliedCount} product${appliedCount === 1 ? "" : "s"}.`
        : `Saved ${appliedCount} product${appliedCount === 1 ? "" : "s"} with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
    appliedCount,
    errors,
  };
}
