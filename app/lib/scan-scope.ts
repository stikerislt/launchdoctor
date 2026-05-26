import type { StoreSnapshot } from "../../audit-engine/types";

export type ScanScope = {
  productCount: number;
  sitemapUrls: number;
  sitemapProducts: number;
  sitemapCollections: number;
  sitemapPages: number;
};

export function getScanScopeFromSnapshot(snapshot: unknown): ScanScope | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const snap = snapshot as StoreSnapshot;

  return {
    productCount: snap.products?.total ?? 0,
    sitemapUrls: snap.storefront?.sitemapUrlCount ?? 0,
    sitemapProducts: snap.storefront?.sitemapProductUrls ?? 0,
    sitemapCollections: snap.storefront?.sitemapCollectionUrls ?? 0,
    sitemapPages: snap.storefront?.sitemapPageUrls ?? 0,
  };
}
