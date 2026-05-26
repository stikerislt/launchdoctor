import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { FixResult } from "./types";
import { adminGraphql } from "./graphql.server";
import { parseAuditSnapshot } from "./snapshot.server";

const SHOP_SEO_QUERY = `#graphql
  query ShopSeoMetafields {
    shop {
      id
      name
      titleTag: metafield(namespace: "global", key: "title_tag") { value }
      descriptionTag: metafield(namespace: "global", key: "description_tag") { value }
    }
  }
`;

const METAFIELDS_SET = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        key
        value
      }
      userErrors { field message }
    }
  }
`;

type ShopSeoQueryResult = {
  shop: {
    id: string;
    name: string;
    titleTag: { value: string } | null;
    descriptionTag: { value: string } | null;
  };
};

type MetafieldsSetResult = {
  metafieldsSet: {
    metafields: Array<{ key: string; value: string }> | null;
  };
};

export async function applyHomepageSeoFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
  input: { title: string; description: string },
): Promise<FixResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  const title = input.title.trim();
  const description = input.description.trim();

  if (!title || !description) {
    return {
      success: false,
      message: "Title and description are required.",
      appliedCount: 0,
      errors: ["Missing title or description"],
    };
  }

  const shopData = await adminGraphql<ShopSeoQueryResult>(admin, SHOP_SEO_QUERY);
  const shop = shopData.shop;

  const result = await adminGraphql<MetafieldsSetResult>(admin, METAFIELDS_SET, {
    metafields: [
      {
        ownerId: shop.id,
        namespace: "global",
        key: "title_tag",
        type: "single_line_text_field",
        value: title,
      },
      {
        ownerId: shop.id,
        namespace: "global",
        key: "description_tag",
        type: "single_line_text_field",
        value: description,
      },
    ],
  });

  const saved = Object.fromEntries(
    (result.metafieldsSet.metafields ?? []).map((field) => [field.key, field.value.trim()]),
  );

  if (saved.title_tag !== title || saved.description_tag !== description) {
    return {
      success: false,
      message: "Shopify did not persist the homepage SEO values.",
      appliedCount: 0,
      errors: ["Homepage SEO update could not be verified after save."],
    };
  }

  const verified = await adminGraphql<ShopSeoQueryResult>(admin, SHOP_SEO_QUERY);
  const readTitle = verified.shop.titleTag?.value?.trim() ?? "";
  const readDescription = verified.shop.descriptionTag?.value?.trim() ?? "";
  const readBackOk = readTitle === title && readDescription === description;

  return {
    success: true,
    message: snapshot
      ? readBackOk
        ? `Updated homepage SEO for ${snapshot.shop.name}.`
        : `Updated homepage SEO for ${snapshot.shop.name}. If Fix Center still shows this item after re-audit, wait a minute and run another audit.`
      : readBackOk
        ? "Updated homepage SEO."
        : "Updated homepage SEO. If Fix Center still shows this item after re-audit, wait a minute and run another audit.",
    appliedCount: 1,
    errors: [],
  };
}
