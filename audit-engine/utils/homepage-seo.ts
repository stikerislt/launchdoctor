export type HomepageSeo = {
  title: string | null;
  description: string | null;
};

export function isGenericHomepageTitle(
  title: string | null | undefined,
  shopName: string,
  themeName: string,
): boolean {
  const normalized = title?.trim().toLowerCase() ?? "";
  if (!normalized) return true;

  const generic = ["home", shopName.trim().toLowerCase(), themeName.trim().toLowerCase()];
  return generic.includes(normalized);
}

export function homepageSeoNeedsImprovement(
  homepageSeo: HomepageSeo,
  shopName: string,
  themeName: string,
): boolean {
  return (
    isGenericHomepageTitle(homepageSeo.title, shopName, themeName) ||
    !homepageSeo.description?.trim()
  );
}

/** Prefer admin SEO metafields over scraped storefront HTML for audit decisions. */
export function resolveHomepageSeo(input: {
  titleTag: string | null | undefined;
  descriptionTag: string | null | undefined;
  shopDescription: string | null | undefined;
  publicSeo: HomepageSeo;
  shopName: string;
  themeName: string;
}): HomepageSeo {
  const titleFromTag = input.titleTag?.trim() || null;
  const publicTitle = input.publicSeo.title?.trim() || null;
  const title =
    titleFromTag ||
    (publicTitle &&
    !isGenericHomepageTitle(publicTitle, input.shopName, input.themeName)
      ? publicTitle
      : null);

  const description =
    input.descriptionTag?.trim() ||
    input.shopDescription?.trim() ||
    input.publicSeo.description?.trim() ||
    null;

  return { title, description };
}
