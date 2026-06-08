import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import sharp from "sharp";
import type { FixResult } from "./types";
import { adminGraphql } from "./graphql.server";
import { resolveProductMediaId } from "./product-media.server";
import {
  getHeavyImageTargets,
  getPngImageTargets,
  getSnapshotProducts,
  parseAuditSnapshot,
} from "./snapshot.server";

const STAGED_UPLOADS = `#graphql
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const PRODUCT_CREATE_MEDIA = `#graphql
  mutation ProductCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media { id }
      mediaUserErrors { field message }
    }
  }
`;

const PRODUCT_DELETE_MEDIA = `#graphql
  mutation ProductDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
    productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
      deletedMediaIds
      mediaUserErrors { field message }
    }
  }
`;

const PRODUCT_REORDER_MEDIA = `#graphql
  mutation ProductReorderMedia($id: ID!, $moves: [MoveInput!]!) {
    productReorderMedia(id: $id, moves: $moves) {
      job { id }
      mediaUserErrors { field message }
    }
  }
`;

type StagedUploadResult = {
  stagedUploadsCreate: {
    stagedTargets: Array<{
      url: string;
      resourceUrl: string;
      parameters: Array<{ name: string; value: string }>;
    }>;
  };
};

type CreateMediaResult = {
  productCreateMedia: {
    media: Array<{ id: string }> | null;
  };
};

async function optimizeImage(sourceUrl: string): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
}> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status})`);
  }

  const input = Buffer.from(await response.arrayBuffer());
  let pipeline = sharp(input);
  const meta = await pipeline.metadata();

  if (meta.width && meta.width > 2048) {
    pipeline = pipeline.resize(2048, null, { withoutEnlargement: true });
  }

  const buffer = await pipeline.webp({ quality: 82 }).toBuffer();
  return {
    buffer,
    filename: "launch-doctor-optimized.webp",
    mimeType: "image/webp",
  };
}

async function uploadOptimizedImage(
  admin: AdminApiContext,
  optimized: { buffer: Buffer; filename: string; mimeType: string },
): Promise<string> {
  const staged = await adminGraphql<StagedUploadResult>(admin, STAGED_UPLOADS, {
    input: [
      {
        filename: optimized.filename,
        mimeType: optimized.mimeType,
        resource: "IMAGE",
        httpMethod: "POST",
        fileSize: optimized.buffer.length.toString(),
      },
    ],
  });

  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target) {
    throw new Error("Shopify did not return a staged upload target.");
  }

  const form = new FormData();
  for (const param of target.parameters) {
    form.append(param.name, param.value);
  }
  form.append(
    "file",
    new Blob([new Uint8Array(optimized.buffer)], { type: optimized.mimeType }),
    optimized.filename,
  );

  const uploadResponse = await fetch(target.url, { method: "POST", body: form });
  if (!uploadResponse.ok) {
    throw new Error(`Staged upload failed (${uploadResponse.status})`);
  }

  return target.resourceUrl;
}

/** Replaces a product's hero image with an optimized WebP version. Returns the optimized byte count. */
async function replaceHeavyHeroImage(
  admin: AdminApiContext,
  target: {
    productId: string;
    productTitle: string;
    imageId: string;
    imageUrl: string;
  },
): Promise<number> {
  const optimized = await optimizeImage(target.imageUrl);
  const resourceUrl = await uploadOptimizedImage(admin, optimized);

  const created = await adminGraphql<CreateMediaResult>(admin, PRODUCT_CREATE_MEDIA, {
    productId: target.productId,
    media: [
      {
        originalSource: resourceUrl,
        mediaContentType: "IMAGE",
        alt: `${target.productTitle} product image`,
      },
    ],
  });

  const newMediaId = created.productCreateMedia.media?.[0]?.id;
  if (!newMediaId) {
    throw new Error("Optimized image upload did not return media.");
  }

  const heroMediaId = await resolveProductMediaId(
    admin,
    target.productId,
    target.imageUrl,
    target.imageId,
  );
  if (!heroMediaId) {
    throw new Error(
      "Could not match hero image to product media. Re-run the audit and try again.",
    );
  }

  await adminGraphql(admin, PRODUCT_REORDER_MEDIA, {
    id: target.productId,
    moves: [{ id: newMediaId, newPosition: "0" }],
  });

  if (heroMediaId !== newMediaId) {
    await adminGraphql(admin, PRODUCT_DELETE_MEDIA, {
      productId: target.productId,
      mediaIds: [heroMediaId],
    });
  }

  return optimized.buffer.length;
}

/** Simple fix-center compatible wrapper. */
export async function applyOptimizeImagesFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 25,
): Promise<FixResult> {
  const result = await optimizeImagesWithStats(admin, snapshotJson, limit);
  return {
    success: result.failCount === 0,
    message:
      result.failCount === 0
        ? `Optimized ${result.successCount} product image${result.successCount === 1 ? "" : "s"}.`
        : `Optimized ${result.successCount} product image${result.successCount === 1 ? "" : "s"} with ${result.failCount} error${result.failCount === 1 ? "" : "s"}.`,
    appliedCount: result.successCount,
    errors: result.results.filter((r) => r.error).map((r) => `${r.productTitle}: ${r.error}`),
  };
}

export type PerImageResult = {
  productId: string;
  productTitle: string;
  originalBytes: number;
  optimizedBytes: number;
  originalKB: number;
  optimizedKB: number;
  savedKB: number;
  success: boolean;
  error?: string;
};

export type BatchOptimizeResult = {
  results: PerImageResult[];
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  totalOriginalKB: number;
  totalOptimizedKB: number;
  totalSavedKB: number;
  successCount: number;
  failCount: number;
};

/** Runs image optimization on all heavy images from a snapshot and returns per-image before/after stats for the status bar. */
export async function optimizeImagesWithStats(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 25,
): Promise<BatchOptimizeResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  const targets = getHeavyImageTargets(getSnapshotProducts(snapshot)).slice(0, limit);

  const results: PerImageResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const target of targets) {
    if (!target.imageUrl || !target.imageId) continue;

    const originalBytes = target.bytes ?? 0;

    try {
      const optimizedBytes = await replaceHeavyHeroImage(admin, {
        productId: target.productId,
        productTitle: target.productTitle,
        imageId: target.imageId,
        imageUrl: target.imageUrl,
      });

      successCount += 1;
      results.push({
        productId: target.productId,
        productTitle: target.productTitle,
        originalBytes,
        optimizedBytes,
        originalKB: Math.round(originalBytes / 1024),
        optimizedKB: Math.round(optimizedBytes / 1024),
        savedKB: Math.round((originalBytes - optimizedBytes) / 1024),
        success: true,
      });
    } catch (error) {
      failCount += 1;
      results.push({
        productId: target.productId,
        productTitle: target.productTitle,
        originalBytes,
        optimizedBytes: originalBytes,
        originalKB: Math.round(originalBytes / 1024),
        optimizedKB: Math.round(originalBytes / 1024),
        savedKB: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const totalOriginalBytes = results.reduce((sum, r) => sum + r.originalBytes, 0);
  const totalOptimizedBytes = results.reduce((sum, r) => sum + r.optimizedBytes, 0);

  return {
    results,
    totalOriginalBytes,
    totalOptimizedBytes,
    totalOriginalKB: Math.round(totalOriginalBytes / 1024),
    totalOptimizedKB: Math.round(totalOptimizedBytes / 1024),
    totalSavedKB: Math.round((totalOriginalBytes - totalOptimizedBytes) / 1024),
    successCount,
    failCount,
  };
}

/** Simple fix-center compatible wrapper for PNG→WebP conversion. */
export async function applyConvertPngToWebpFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 25,
): Promise<FixResult> {
  const result = await convertPngImagesWithStats(admin, snapshotJson, limit);
  return {
    success: result.failCount === 0,
    message:
      result.failCount === 0
        ? `Converted ${result.successCount} PNG image${result.successCount === 1 ? "" : "s"} to WebP.`
        : `Converted ${result.successCount} PNG image${result.successCount === 1 ? "" : "s"} with ${result.failCount} error${result.failCount === 1 ? "" : "s"}.`,
    appliedCount: result.successCount,
    errors: result.results
      .filter((r) => r.error)
      .map((r) => `${r.productTitle}: ${r.error}`),
  };
}

export type PngConvertResult = {
  results: PerImageResult[];
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  totalOriginalKB: number;
  totalOptimizedKB: number;
  totalSavedKB: number;
  successCount: number;
  failCount: number;
};

/** Converts all PNG product images to WebP (regardless of file size). Returns per-image before/after stats. */
export async function convertPngImagesWithStats(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 25,
): Promise<PngConvertResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  const targets = getPngImageTargets(getSnapshotProducts(snapshot)).slice(0, limit);

  const results: PerImageResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const target of targets) {
    const originalBytes = target.bytes ?? 0;

    try {
      const optimizedBytes = await replaceHeavyHeroImage(admin, {
        productId: target.productId,
        productTitle: target.productTitle,
        imageId: target.imageId,
        imageUrl: target.imageUrl,
      });

      successCount += 1;
      results.push({
        productId: target.productId,
        productTitle: target.productTitle,
        originalBytes,
        optimizedBytes,
        originalKB: Math.round(originalBytes / 1024),
        optimizedKB: Math.round(optimizedBytes / 1024),
        savedKB: Math.round((originalBytes - optimizedBytes) / 1024),
        success: true,
      });
    } catch (error) {
      failCount += 1;
      results.push({
        productId: target.productId,
        productTitle: target.productTitle,
        originalBytes,
        optimizedBytes: originalBytes,
        originalKB: Math.round(originalBytes / 1024),
        optimizedKB: Math.round(originalBytes / 1024),
        savedKB: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const totalOriginalBytes = results.reduce((sum, r) => sum + r.originalBytes, 0);
  const totalOptimizedBytes = results.reduce((sum, r) => sum + r.optimizedBytes, 0);

  return {
    results,
    totalOriginalBytes,
    totalOptimizedBytes,
    totalOriginalKB: Math.round(totalOriginalBytes / 1024),
    totalOptimizedKB: Math.round(totalOptimizedBytes / 1024),
    totalSavedKB: Math.round((totalOriginalBytes - totalOptimizedBytes) / 1024),
    successCount,
    failCount,
  };
}
