import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { FixResult } from "./types";
import { adminGraphql } from "./graphql.server";
import {
  getMissingAltTargets,
  getSnapshotProducts,
  parseAuditSnapshot,
} from "./snapshot.server";

const PRODUCT_UPDATE_MEDIA = `#graphql
  mutation ProductUpdateMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      media { id alt }
      mediaUserErrors { field message }
    }
  }
`;

export async function applyAltTextFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 25,
): Promise<FixResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  const targets = getMissingAltTargets(getSnapshotProducts(snapshot)).slice(0, limit);

  if (targets.length === 0) {
    return {
      success: true,
      message: "No missing alt text found.",
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
      await adminGraphql(admin, PRODUCT_UPDATE_MEDIA, {
        productId,
        media: productTargets.map((target) => ({
          id: target.imageId,
          alt: target.suggestedAlt,
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
        ? `Updated alt text on ${appliedCount} image${appliedCount === 1 ? "" : "s"}.`
        : `Updated ${appliedCount} image${appliedCount === 1 ? "" : "s"} with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
    appliedCount,
    errors,
  };
}
