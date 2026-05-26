import {
  homepageSeoNeedsImprovement,
  isGenericHomepageTitle,
  resolveHomepageSeo,
} from "../utils/homepage-seo";

describe("homepage-seo", () => {
  it("treats storefront HTML title as generic when admin SEO title is missing", () => {
    const resolved = resolveHomepageSeo({
      titleTag: null,
      descriptionTag: null,
      shopDescription: null,
      publicSeo: { title: "Home", description: "Welcome" },
      shopName: "Northward Systems",
      themeName: "Dawn",
    });

    expect(resolved.title).toBeNull();
    expect(resolved.description).toBe("Welcome");
    expect(
      homepageSeoNeedsImprovement(resolved, "Northward Systems", "Dawn"),
    ).toBe(true);
  });

  it("uses admin SEO metafields instead of scraped HTML", () => {
    const resolved = resolveHomepageSeo({
      titleTag: "Northward Systems — Official Online Store",
      descriptionTag: "Shop curated outdoor gear with fast shipping.",
      shopDescription: null,
      publicSeo: { title: "Home", description: "" },
      shopName: "Northward Systems",
      themeName: "Dawn",
    });

    expect(isGenericHomepageTitle(resolved.title, "Northward Systems", "Dawn")).toBe(false);
    expect(
      homepageSeoNeedsImprovement(resolved, "Northward Systems", "Dawn"),
    ).toBe(false);
  });

  it("falls back to shop.description for meta description", () => {
    const resolved = resolveHomepageSeo({
      titleTag: "Northward Systems — Official Online Store",
      descriptionTag: null,
      shopDescription: "Shop curated outdoor gear with fast shipping.",
      publicSeo: { title: "Home", description: "" },
      shopName: "Northward Systems",
      themeName: "Dawn",
    });

    expect(homepageSeoNeedsImprovement(resolved, "Northward Systems", "Dawn")).toBe(
      false,
    );
  });

  it("uses a non-generic storefront title when admin title metafield is missing", () => {
    const resolved = resolveHomepageSeo({
      titleTag: null,
      descriptionTag: "Shop curated outdoor gear with fast shipping.",
      shopDescription: null,
      publicSeo: {
        title: "Northward Systems — Official Online Store",
        description: "Shop curated outdoor gear with fast shipping.",
      },
      shopName: "Northward Systems",
      themeName: "Dawn",
    });

    expect(resolved.title).toBe("Northward Systems — Official Online Store");
    expect(
      homepageSeoNeedsImprovement(resolved, "Northward Systems", "Dawn"),
    ).toBe(false);
  });
});
