import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import sharp from "sharp";
import type { FixResult } from "./types";
import { adminGraphql } from "./graphql.server";
import {
  getHeavyImageTargets,
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

async function replaceHeavyHeroImage(
  admin: AdminApiContext,
  target: {
    productId: string;
    productTitle: string;
    imageId: string;
    imageUrl: string;
  },
): Promise<void> {
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

  try {
    await adminGraphql(admin, PRODUCT_DELETE_MEDIA, {
      productId: target.productId,
      mediaIds: [target.imageId],
    });
  } catch {
    await adminGraphql(admin, PRODUCT_REORDER_MEDIA, {
      id: target.productId,
      moves: [{ id: newMediaId, newPosition: "0" }],
    });

    await adminGraphql(admin, PRODUCT_DELETE_MEDIA, {
      productId: target.productId,
      mediaIds: [target.imageId],
    });
  }
}

export async function applyOptimizeImagesFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  limit = 25,
): Promise<FixResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  const targets = getHeavyImageTargets(getSnapshotProducts(snapshot)).slice(0, limit);

  if (targets.length === 0) {
    return {
      success: true,
      message: "No oversized product images found.",
      appliedCount: 0,
      errors: [],
    };
  }

  let appliedCount = 0;
  const errors: string[] = [];

  for (const target of targets) {
    if (!target.imageUrl || !target.imageId) continue;

    try {
      await replaceHeavyHeroImage(admin, {
        productId: target.productId,
        productTitle: target.productTitle,
        imageId: target.imageId,
        imageUrl: target.imageUrl,
      });
      appliedCount += 1;
    } catch (error) {
      errors.push(
        `${target.productTitle}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return {
    success: errors.length === 0,
    message:
      errors.length === 0
        ? `Optimized ${appliedCount} product image${appliedCount === 1 ? "" : "s"}.`
        : `Optimized ${appliedCount} product image${appliedCount === 1 ? "" : "s"} with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
    appliedCount,
    errors,
  };
}
