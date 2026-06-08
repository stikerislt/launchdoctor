import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { adminGraphql } from "./graphql.server";

const PRODUCT_MEDIA_QUERY = `#graphql
  query ProductMediaForFix($id: ID!) {
    product(id: $id) {
      media(first: 25) {
        edges {
          node {
            ... on MediaImage {
              id
              alt
              image {
                url
              }
            }
          }
        }
      }
    }
  }
`;

type ProductMediaQueryResult = {
  product: {
    media: {
      edges: Array<{
        node: {
          id?: string;
          alt?: string | null;
          image?: { url?: string | null } | null;
        };
      }>;
    } | null;
  } | null;
};

export type ProductMediaImage = {
  id: string;
  url: string;
  alt: string | null;
};

/** Compare CDN URLs without query params or fragments. */
export function normalizeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0]?.split("#")[0] ?? url;
  }
}

export function isMediaImageGid(id: string): boolean {
  return (
    id.includes("/MediaImage/") ||
    id.includes("/Video/") ||
    id.includes("/ExternalVideo/")
  );
}

export function isLegacyProductImageGid(id: string): boolean {
  return id.includes("/ProductImage/");
}

export async function fetchProductMediaImages(
  admin: AdminApiContext,
  productId: string,
): Promise<ProductMediaImage[]> {
  const data = await adminGraphql<ProductMediaQueryResult>(admin, PRODUCT_MEDIA_QUERY, {
    id: productId,
  });

  const images: ProductMediaImage[] = [];
  for (const { node } of data.product?.media?.edges ?? []) {
    const id = node.id;
    const url = node.image?.url;
    if (!id || !url) continue;
    images.push({ id, url, alt: node.alt ?? null });
  }
  return images;
}

/**
 * productDeleteMedia / productUpdateMedia require Media GIDs, not legacy ProductImage IDs.
 */
export async function resolveProductMediaId(
  admin: AdminApiContext,
  productId: string,
  imageUrl: string,
  snapshotImageId?: string | null,
): Promise<string | null> {
  if (snapshotImageId && isMediaImageGid(snapshotImageId)) {
    return snapshotImageId;
  }

  const normalizedTarget = normalizeImageUrl(imageUrl);
  const media = await fetchProductMediaImages(admin, productId);
  const match = media.find((m) => normalizeImageUrl(m.url) === normalizedTarget);
  if (match) return match.id;

  // Single-image product: legacy ProductImage audits often map to the only MediaImage.
  if (media.length === 1) return media[0]?.id ?? null;

  return null;
}
