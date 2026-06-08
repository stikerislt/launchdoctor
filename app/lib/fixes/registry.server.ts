import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

import type { FixId, FixResult, ProductSeoUpdate } from "./types";

import { applyAltTextFix } from "./apply-alt-text.server";

import { applyAssignSkusFix } from "./apply-assign-skus.server";

import { applyEnableInventoryFix } from "./apply-enable-inventory.server";

import { applyHomepageSeoFix } from "./apply-homepage-seo.server";

import { applyOptimizeImagesFix } from "./apply-optimize-images.server";
import { applyConvertPngToWebpFix } from "./apply-optimize-images.server";

import { applyProductSeoFix } from "./apply-product-seo.server";

import { applyThinDescriptionsFix } from "./apply-thin-descriptions.server";

import { applyTrustPagesFix } from "./apply-trust-pages.server";



export const FIX_IDS: FixId[] = [

  "alt-text",

  "optimize-images",

  "convert-png-to-webp",

  "homepage-seo",

  "product-seo",

  "thin-descriptions",

  "assign-skus",

  "enable-inventory",

  "trust-pages",

  "add-product-images",

];



export async function applyFix(

  admin: AdminApiContext,

  fixId: FixId,

  snapshotJson: unknown,

  options?: {
    title?: string;
    description?: string;
    productSeoUpdates?: ProductSeoUpdate[];
  },

): Promise<FixResult> {

  switch (fixId) {

    case "alt-text":

      return applyAltTextFix(admin, snapshotJson);

    case "optimize-images":

      return applyOptimizeImagesFix(admin, snapshotJson);

    case "convert-png-to-webp":

      return applyConvertPngToWebpFix(admin, snapshotJson);

    case "homepage-seo":

      return applyHomepageSeoFix(admin, snapshotJson, {

        title: options?.title ?? "",

        description: options?.description ?? "",

      });

    case "product-seo":

      return applyProductSeoFix(admin, snapshotJson, options?.productSeoUpdates);

    case "thin-descriptions":

      return applyThinDescriptionsFix(admin, snapshotJson);

    case "assign-skus":

      return applyAssignSkusFix(admin, snapshotJson);

    case "enable-inventory":

      return applyEnableInventoryFix(admin, snapshotJson);

    case "trust-pages":

      return applyTrustPagesFix(admin, snapshotJson);

    case "add-product-images":

      // Guided-only: photos can't be generated. Surfaced as deep links in the UI;
      // there's nothing to auto-apply.
      return {
        success: false,
        message:
          "Adding product photos is a guided fix — use the links to upload images in Shopify.",
        appliedCount: 0,
        errors: [],
      };

    default:

      return {

        success: false,

        message: "Unknown fix type.",

        appliedCount: 0,

        errors: ["Unknown fix type"],

      };

  }

}

