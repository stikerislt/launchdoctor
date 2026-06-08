import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { FixResult } from "./types";
import { formatInventoryFixError } from "../fix-access-errors.server";
import { adminGraphql } from "./graphql.server";
import {
  getInventoryOffTargets,
  getSnapshotProducts,
  parseAuditSnapshot,
} from "./snapshot.server";

const INVENTORY_ITEM_UPDATE = `#graphql
  mutation InventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
    inventoryItemUpdate(id: $id, input: $input) {
      inventoryItem { id tracked }
      userErrors { field message }
    }
  }
`;

export async function applyEnableInventoryFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 50,
): Promise<FixResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  if (!snapshot) {
    return { success: false, message: "Invalid audit snapshot.", appliedCount: 0, errors: ["Invalid snapshot"] };
  }

  const targets = getInventoryOffTargets(getSnapshotProducts(snapshot)).slice(0, limit);
  if (targets.length === 0) {
    return {
      success: true,
      message: "Inventory tracking is already enabled on sampled variants.",
      appliedCount: 0,
      errors: [],
    };
  }

  let appliedCount = 0;
  const errors: string[] = [];

  for (const target of targets) {
    try {
      await adminGraphql(admin, INVENTORY_ITEM_UPDATE, {
        id: target.inventoryItemId,
        input: { tracked: true },
      });
      appliedCount += 1;
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unknown error";
      errors.push(
        `${target.productTitle} (${target.variantLabel}): ${formatInventoryFixError(raw)}`,
      );
    }
  }

  return {
    success: errors.length === 0,
    message:
      errors.length === 0
        ? `Enabled inventory tracking on ${appliedCount} variant${appliedCount === 1 ? "" : "s"}.`
        : `Updated ${appliedCount} variant${appliedCount === 1 ? "" : "s"} with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
    appliedCount,
    errors,
  };
}
