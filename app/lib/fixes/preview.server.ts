import type { StoreSnapshot } from "../../../audit-engine/types";
import type { FixId, FixPreview } from "./types";
import {
  getHeavyImageTargets,
  getInventoryOffTargets,
  getMissingAltTargets,
  getMissingProductSeoTargets,
  getMissingSkuTargets,
  getMissingTrustPages,
  getNoImageTargets,
  getPngImageTargets,
  getSnapshotProducts,
  getThinDescriptionTargets,
  homepageSeoNeedsFix,
  parseAuditSnapshot,
  suggestHomepageDescriptions,
  suggestHomepageTitles,
} from "./snapshot.server";
import { productAdminLink, productsLink } from "../../../audit-engine/utils/deep-link";
import { buildProductSeoDrafts } from "./product-seo.server";
import { getProductSeoFixTargets } from "./snapshot.server";

export function buildFixPreviews(
  snapshotJson: unknown,
  dismissedFixIds?: ReadonlySet<FixId>,
): FixPreview[] {
  const snapshot = parseAuditSnapshot(snapshotJson);
  if (!snapshot) return [];

  const products = getSnapshotProducts(snapshot);
  const previews: FixPreview[] = [];
  const shopName = snapshot.shop.name;

  const pushIfActive = (preview: FixPreview) => {
    if (dismissedFixIds?.has(preview.id)) return;
    previews.push(preview);
  };

  const altTargets = getMissingAltTargets(products);
  if (altTargets.length > 0) {
    pushIfActive({
      id: "alt-text",
      ruleCodes: ["PROD_MISSING_ALT"],
      title: "Fill missing image alt text",
      description:
        "Adds descriptive alt text to product images that are missing it. Improves accessibility and image SEO.",
      itemCount: altTargets.length,
      items: altTargets.slice(0, 8).map((target) => ({
        id: target.imageId,
        label: target.productTitle,
        detail: target.suggestedAlt,
      })),
    });
  }

  const heavyTargets = getHeavyImageTargets(products);
  if (heavyTargets.length > 0) {
    pushIfActive({
      id: "optimize-images",
      ruleCodes: ["SEO_HEAVY_IMAGES"],
      title: "Optimize oversized product images",
      description:
        "Compresses large hero images and converts them to WebP. Adds optimized copies to affected products.",
      itemCount: heavyTargets.length,
      items: heavyTargets.slice(0, 8).map((target) => ({
        id: target.productId,
        label: target.productTitle,
        detail: target.bytes
          ? `${Math.round(target.bytes / 1024)} KB hero image`
          : "Large hero image",
        meta: { bytes: target.bytes },
      })),
    });
  }

  const pngTargets = getPngImageTargets(products);
  if (pngTargets.length > 0) {
    pushIfActive({
      id: "convert-png-to-webp",
      ruleCodes: ["PROD_PNG_FORMAT"],
      title: "Convert PNG images to WebP",
      description:
        "Converts all PNG product images to WebP format for smaller file sizes at the same visual quality. Improves page load speed.",
      itemCount: pngTargets.length,
      items: pngTargets.slice(0, 8).map((target) => ({
        id: target.imageId,
        label: target.productTitle,
        detail: target.bytes
          ? `${Math.round(target.bytes / 1024)} KB PNG`
          : "PNG format",
        meta: { bytes: target.bytes },
      })),
    });
  }

  if (homepageSeoNeedsFix(snapshot)) {
    pushIfActive(buildHomepageSeoPreview(snapshot));
  }

  const seoTargets = getProductSeoFixTargets(products);
  if (seoTargets.length > 0) {
    const productSeoDrafts = buildProductSeoDrafts(products, shopName);
    pushIfActive({
      id: "product-seo",
      ruleCodes: ["SEO_PRODUCT_META"],
      title: "Fill missing product SEO titles & descriptions",
      description:
        "Review suggested product names and SEO copy, fill fields with one click, edit if needed, then save to Shopify.",
      itemCount: seoTargets.length,
      productSeoDrafts,
      items: productSeoDrafts.slice(0, 8).map((draft) => ({
        id: draft.productId,
        label: draft.productTitle,
        detail: [
          draft.hasBadProductTitle ? "Generic product name" : null,
          draft.missingTitle ? "Missing SEO title" : null,
          draft.missingDescription ? "Missing meta description" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Needs SEO review",
      })),
    });
  }

  const noImageTargets = getNoImageTargets(products);
  if (noImageTargets.length > 0) {
    const handle = snapshot.shop.handle;
    pushIfActive({
      id: "add-product-images",
      ruleCodes: ["PROD_NO_IMAGE"],
      title: "Add images to products with no photo",
      description:
        "These products have no image at all. We can't generate photos for you, but here's a direct link to each one's Media section so you can upload images fast.",
      itemCount: noImageTargets.length,
      guided: true,
      guidedActionUrl: productsLink(handle),
      guidedActionLabel: "Open Products in Shopify",
      items: noImageTargets.slice(0, 12).map((product) => ({
        id: product.id,
        label: product.title,
        detail: "No image",
        adminUrl: productAdminLink(handle, product.id),
      })),
    });
  }

  const thinTargets = getThinDescriptionTargets(products);
  if (thinTargets.length > 0) {
    pushIfActive({
      id: "thin-descriptions",
      ruleCodes: ["PROD_THIN_DESC"],
      title: "Expand thin product descriptions",
      description:
        "Replaces very short descriptions with a stronger starter template you can refine later in the product editor.",
      itemCount: thinTargets.length,
      items: thinTargets.slice(0, 8).map((product) => ({
        id: product.id,
        label: product.title,
        detail: `${product.descriptionLength ?? 0} characters today`,
      })),
    });
  }

  const skuTargets = getMissingSkuTargets(products);
  if (skuTargets.length > 0) {
    pushIfActive({
      id: "assign-skus",
      ruleCodes: ["PROD_NO_SKU"],
      title: "Assign missing variant SKUs",
      description:
        "Generates readable SKUs from product handles so inventory and fulfillment systems can track variants.",
      itemCount: skuTargets.length,
      items: skuTargets.slice(0, 8).map((target) => ({
        id: target.variantId,
        label: `${target.productTitle} — ${target.variantLabel}`,
        detail: target.suggestedSku,
      })),
    });
  }

  const inventoryTargets = getInventoryOffTargets(products);
  if (inventoryTargets.length > 0) {
    pushIfActive({
      id: "enable-inventory",
      ruleCodes: ["PROD_INVENTORY_OFF"],
      title: "Enable inventory tracking",
      description:
        "Turns on inventory tracking for variants that are currently untracked, reducing overselling risk.",
      itemCount: inventoryTargets.length,
      items: inventoryTargets.slice(0, 8).map((target) => ({
        id: target.variantId,
        label: `${target.productTitle} — ${target.variantLabel}`,
        detail: "Tracking disabled",
      })),
    });
  }

  const missingPages = getMissingTrustPages(snapshot);
  if (missingPages.length > 0) {
    pushIfActive({
      id: "trust-pages",
      ruleCodes: ["TRUST_NO_ABOUT", "TRUST_NO_CONTACT", "TRUST_NO_FAQ"],
      title: "Create missing trust pages",
      description:
        "Publishes starter About, Contact, and FAQ pages so shoppers can learn about your store and get help.",
      itemCount: missingPages.length,
      items: missingPages.map((pageKey) => ({
        id: pageKey,
        label:
          pageKey === "about"
            ? "About us page"
            : pageKey === "contact"
              ? "Contact us page"
              : "FAQ page",
        detail: "Not published yet",
      })),
    });
  }

  return previews;
}

function buildHomepageSeoPreview(snapshot: StoreSnapshot): FixPreview {
  const shopName = snapshot.shop.name;
  const currentTitle = snapshot.theme.homepageSeo.title;
  const currentDescription = snapshot.theme.homepageSeo.description;

  return {
    id: "homepage-seo",
    ruleCodes: ["SEO_DEFAULT_TITLE", "SEO_NO_META_DESC"],
    title: "Improve homepage SEO title & description",
    description:
      "Updates your storefront homepage search listing with a stronger title and meta description.",
    itemCount: 1,
    items: [
      {
        id: "homepage-seo",
        label: "Homepage search listing",
        detail: currentTitle || "Generic or missing title",
      },
    ],
    suggestions: {
      title: suggestHomepageTitles(shopName),
      description: suggestHomepageDescriptions(shopName),
      currentTitle,
      currentDescription,
    },
  };
}
