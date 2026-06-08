import {
  buildDeepLink,
  getRuleDeepLink,
  legalLink,
  normalizeAdminPath,
  policiesLink,
  productAdminLink,
  resolveAdminDeepLink,
  RULE_DEEP_LINKS,
} from "../utils/deep-link";

describe("deep-link", () => {
  const handle = "northward-systems";

  it("builds store-scoped admin URLs", () => {
    expect(legalLink(handle)).toBe(
      "https://admin.shopify.com/store/northward-systems/settings/legal",
    );
  });

  it("productAdminLink resolves a GID to a numeric product URL", () => {
    expect(productAdminLink(handle, "gid://shopify/Product/12345")).toBe(
      "https://admin.shopify.com/store/northward-systems/products/12345",
    );
    expect(productAdminLink(handle, "67890")).toBe(
      "https://admin.shopify.com/store/northward-systems/products/67890",
    );
  });

  it("productAdminLink falls back to the products list without a numeric id", () => {
    expect(productAdminLink(handle, "no-digits")).toBe(
      "https://admin.shopify.com/store/northward-systems/products",
    );
  });

  it("policiesLink aliases legalLink", () => {
    expect(policiesLink(handle)).toBe(legalLink(handle));
  });

  it("rewrites legacy /settings/policies paths", () => {
    expect(normalizeAdminPath("/settings/policies")).toBe("/settings/legal");
    expect(
      buildDeepLink(handle, "/settings/policies"),
    ).toBe("https://admin.shopify.com/store/northward-systems/settings/legal");
  });

  it("maps policy rules to legal settings", () => {
    expect(getRuleDeepLink("POL_REFUND_MISSING", handle)).toBe(legalLink(handle));
    expect(getRuleDeepLink("TRUST_VAGUE_RETURNS", handle)).toBe(legalLink(handle));
  });

  it("maps SEO title/meta rules to online store preferences", () => {
    expect(getRuleDeepLink("SEO_DEFAULT_TITLE", handle)).toBe(
      "https://admin.shopify.com/store/northward-systems/online_store/preferences",
    );
  });

  it("resolves stored legacy URLs using rule code", () => {
    expect(
      resolveAdminDeepLink(
        "https://admin.shopify.com/store/northward-systems/settings/policies",
        "POL_REFUND_MISSING",
        handle,
      ),
    ).toBe("https://admin.shopify.com/store/northward-systems/settings/legal");
  });

  it("covers all 50 rule codes", () => {
    expect(Object.keys(RULE_DEEP_LINKS).length).toBe(49);
    expect(getRuleDeepLink("SEO_PRODUCT_META", handle)).toBe(
      "https://admin.shopify.com/store/northward-systems/products",
    );
    expect(getRuleDeepLink("TRUST_NO_REVIEWS", handle)).toMatch(/^https:\/\/apps\.shopify\.com/);
    expect(getRuleDeepLink("SEO_NO_SITEMAP", handle)).toBeNull();
  });
});
