import {
  buildProductSeoDrafts,
  parseProductSeoUpdates,
} from "../../app/lib/fixes/product-seo.server";
import {
  humanizeProductHandle,
  isGenericProductTitle,
  suggestProductTitle,
} from "../../app/lib/fixes/product-naming";
import type { SnapshotProduct } from "../../app/lib/fixes/types";

const products: SnapshotProduct[] = [
  {
    id: "gid://shopify/Product/1",
    title: "Product 2",
    handle: "trail-pack",
    heroImageBytes: null,
    seo: { title: null, description: null },
  },
  {
    id: "gid://shopify/Product/2",
    title: "Summit Bottle",
    handle: "summit-bottle",
    heroImageBytes: null,
    seo: { title: "Summit Bottle", description: null },
  },
];

describe("product-seo fix helpers", () => {
  it("builds editable drafts with suggested copy for missing fields", () => {
    const drafts = buildProductSeoDrafts(products, "Northward Systems");

    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.hasBadProductTitle).toBe(true);
    expect(drafts[0]?.suggestedProductTitle).toBe("Trail Pack");
    expect(drafts[0]?.seoTitle).toContain("Trail Pack");
    expect(drafts[1]?.missingTitle).toBe(false);
    expect(drafts[1]?.missingDescription).toBe(true);
  });

  it("parses submitted product SEO updates for allowed products", () => {
    const allowed = new Set(["gid://shopify/Product/1"]);
    const updates = parseProductSeoUpdates(
      JSON.stringify([
        {
          productId: "gid://shopify/Product/1",
          productTitle: "Trail Pack",
          seoTitle: "Trail Pack | Northward Systems",
          seoDescription: "Shop the Trail Pack at Northward Systems.",
        },
      ]),
      allowed,
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]?.productTitle).toBe("Trail Pack");
    expect(updates[0]?.seoTitle).toContain("Trail Pack");
  });

  it("rejects incomplete product SEO payloads", () => {
    expect(() =>
      parseProductSeoUpdates(
        JSON.stringify([
          {
            productId: "gid://shopify/Product/1",
            seoTitle: "Only title",
            seoDescription: "",
          },
        ]),
        new Set(["gid://shopify/Product/1"]),
      ),
    ).toThrow("Each product needs both an SEO title and meta description.");
  });

  it("rejects generic renamed product titles", () => {
    expect(() =>
      parseProductSeoUpdates(
        JSON.stringify([
          {
            productId: "gid://shopify/Product/1",
            productTitle: "Product 3",
            seoTitle: "Trail Pack | Northward Systems",
            seoDescription: "Shop the Trail Pack at Northward Systems.",
          },
        ]),
        new Set(["gid://shopify/Product/1"]),
      ),
    ).toThrow('Choose a descriptive product name instead of "Product 3".');
  });
});

describe("product naming helpers", () => {
  it("flags generic product titles", () => {
    expect(isGenericProductTitle("Product 2")).toBe(true);
    expect(isGenericProductTitle("Trail Pack")).toBe(false);
  });

  it("suggests a handle-based product title", () => {
    expect(suggestProductTitle("Product 2", "trail-pack")).toBe("Trail Pack");
    expect(humanizeProductHandle("summit-bottle")).toBe("Summit Bottle");
  });
});
