/**
 * Resolve the public storefront origin used for PageSpeed and Playwright checks.
 * Prefer Shopify's primary domain URL over the *.myshopify.com admin hostname.
 */
export function resolveStorefrontUrl(
  primaryDomain: { url: string; host: string } | undefined,
  shopDomain: string,
): string {
  const fallback = `https://${shopDomain.replace(/^https?:\/\//, "")}`;
  const raw = primaryDomain?.url?.trim();
  if (!raw) return fallback;

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return fallback;
  }
}
