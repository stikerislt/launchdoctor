/**
 * Build in-app paths for embedded Shopify admin navigation.
 * Always use Remix Link/useNavigate with these paths — never window.location
 * or Polaris Button url for internal routes (that breaks embedded auth).
 */
export function shopifyAppPath(path: string, shop: string): string {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  if (!params.has("shop")) {
    params.set("shop", shop);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
