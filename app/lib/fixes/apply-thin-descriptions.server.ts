import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { FixResult } from "./types";
import { adminGraphql } from "./graphql.server";
import {
  getSnapshotProducts,
  getThinDescriptionTargets,
  parseAuditSnapshot,
  suggestProductDescription,
} from "./snapshot.server";

const PRODUCT_UPDATE = `#graphql
  mutation ProductUpdateDescription($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id }
      userErrors { field message }
    }
  }
`;

export async function applyThinDescriptionsFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 25,
): Promise<FixResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  if (!snapshot) {
    return { success: false, message: "Invalid audit snapshot.", appliedCount: 0, errors: ["Invalid snapshot"] };
  }

  const targets = getThinDescriptionTargets(getSnapshotProducts(snapshot)).slice(0, limit);
  if (targets.length === 0) {
    return {
      success: true,
      message: "No thin product descriptions found in the latest audit sample.",
      appliedCount: 0,
      errors: [],
    };
  }

  let appliedCount = 0;
  const errors: string[] = [];
  const shopName = snapshot.shop.name;

  for (const product of targets) {
    try {
      await adminGraphql(admin, PRODUCT_UPDATE, {
        input: {
          id: product.id,
          descriptionHtml: suggestProductDescription(product.title, shopName),
        },
      });
      appliedCount += 1;
    } catch (error) {
      errors.push(
        `${product.title}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return {
    success: errors.length === 0,
    message:
      errors.length === 0
        ? `Expanded descriptions on ${appliedCount} product${appliedCount === 1 ? "" : "s"}.`
        : `Updated ${appliedCount} product${appliedCount === 1 ? "" : "s"} with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
    appliedCount,
    errors,
  };
}
