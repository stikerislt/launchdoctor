import { resolveStorefrontUrl } from "../../collector/storefront-url";

describe("resolveStorefrontUrl", () => {
  it("prefers primary domain URL over myshopify host", () => {
    expect(
      resolveStorefrontUrl(
        { host: "www.brand.com", url: "https://www.brand.com" },
        "brand.myshopify.com",
      ),
    ).toBe("https://www.brand.com");
  });

  it("falls back to myshopify domain", () => {
    expect(resolveStorefrontUrl(undefined, "brand.myshopify.com")).toBe(
      "https://brand.myshopify.com",
    );
  });
});
