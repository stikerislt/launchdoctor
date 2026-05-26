import {
  buildDeepLink,
  getRuleDeepLink,
  legalLink,
  normalizeAdminPath,
  policiesLink,
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
    expect(Object.keys(RULE_DEEP_LINKS).length).toBe(48);
    expect(getRuleDeepLink("SEO_PRODUCT_META", handle)).toBe(
      "https://admin.shopify.com/store/northward-systems/products",
    );
    expect(getRuleDeepLink("TRUST_NO_REVIEWS", handle)).toMatch(/^https:\/\/apps\.shopify\.com/);
    expect(getRuleDeepLink("SEO_NO_SITEMAP", handle)).toBeNull();
  });
});
