import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { FixResult } from "./types";
import { adminGraphql } from "./graphql.server";
import {
  getMissingSkuTargets,
  getSnapshotProducts,
  parseAuditSnapshot,
} from "./snapshot.server";

const VARIANTS_BULK_UPDATE = `#graphql
  mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id sku }
      userErrors { field message }
    }
  }
`;

export async function applyAssignSkusFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 50,
): Promise<FixResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  if (!snapshot) {
    return { success: false, message: "Invalid audit snapshot.", appliedCount: 0, errors: ["Invalid snapshot"] };
  }

  const targets = getMissingSkuTargets(getSnapshotProducts(snapshot)).slice(0, limit);
  if (targets.length === 0) {
    return {
      success: true,
      message: "No missing SKUs found. Re-run an audit if you recently changed products.",
      appliedCount: 0,
      errors: [],
    };
  }

  const byProduct = new Map<string, typeof targets>();
  for (const target of targets) {
    const group = byProduct.get(target.productId) ?? [];
    group.push(target);
    byProduct.set(target.productId, group);
  }

  let appliedCount = 0;
  const errors: string[] = [];

  for (const [productId, productTargets] of byProduct) {
    try {
      await adminGraphql(admin, VARIANTS_BULK_UPDATE, {
        productId,
        variants: productTargets.map((target) => ({
          id: target.variantId,
          sku: target.suggestedSku,
        })),
      });
      appliedCount += productTargets.length;
    } catch (error) {
      errors.push(
        `${productTargets[0]?.productTitle ?? productId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  return {
    success: errors.length === 0,
    message:
      errors.length === 0
        ? `Assigned SKUs to ${appliedCount} variant${appliedCount === 1 ? "" : "s"}.`
        : `Assigned ${appliedCount} SKU${appliedCount === 1 ? "" : "s"} with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
    appliedCount,
    errors,
  };
}
