export type FixId =
  | "alt-text"
  | "optimize-images"
  | "convert-png-to-webp"
  | "homepage-seo"
  | "product-seo"
  | "thin-descriptions"
  | "assign-skus"
  | "enable-inventory"
  | "trust-pages"
  | "add-product-images";

export const FIX_RULE_CODES: Record<FixId, readonly string[]> = {
  "alt-text": ["PROD_MISSING_ALT"],
  "optimize-images": ["SEO_HEAVY_IMAGES"],
  "convert-png-to-webp": ["PROD_PNG_FORMAT"],
  "homepage-seo": ["SEO_DEFAULT_TITLE", "SEO_NO_META_DESC"],
  "product-seo": ["SEO_PRODUCT_META"],
  "thin-descriptions": ["PROD_THIN_DESC"],
  "assign-skus": ["PROD_NO_SKU"],
  "enable-inventory": ["PROD_INVENTORY_OFF"],
  "trust-pages": ["TRUST_NO_ABOUT", "TRUST_NO_CONTACT", "TRUST_NO_FAQ"],
  "add-product-images": ["PROD_NO_IMAGE"],
};

export type FixPreviewItem = {
  id: string;
  label: string;
  detail?: string;
  /** Admin deep link for guided fixes (e.g. open this product's media). */
  adminUrl?: string;
  meta?: Record<string, string | number | null | boolean>;
};

export type ProductSeoDraft = {
  productId: string;
  productTitle: string;
  suggestedProductTitle: string;
  hasBadProductTitle: boolean;
  currentSeoTitle: string;
  currentSeoDescription: string;
  suggestedSeoTitle: string;
  suggestedSeoDescription: string;
  /** Suggested SEO title (same as suggestedSeoTitle). */
  seoTitle: string;
  /** Suggested meta description (same as suggestedSeoDescription). */
  seoDescription: string;
  missingTitle: boolean;
  missingDescription: boolean;
};

export type ProductSeoUpdate = {
  productId: string;
  productTitle?: string;
  seoTitle: string;
  seoDescription: string;
};

export type FixPreview = {
  id: FixId;
  ruleCodes: string[];
  title: string;
  description: string;
  itemCount: number;
  items: FixPreviewItem[];
  /**
   * Guided fixes can't be auto-applied (e.g. we can't generate product photos).
   * The UI renders deep links to fix each item in Shopify instead of an Apply
   * button. `guidedActionUrl` is an optional "do it in Shopify" link.
   */
  guided?: boolean;
  guidedActionUrl?: string;
  guidedActionLabel?: string;
  productSeoDrafts?: ProductSeoDraft[];
  suggestions?: {
    title?: string[];
    description?: string[];
    currentTitle?: string | null;
    currentDescription?: string | null;
  };
};

export type FixResult = {
  success: boolean;
  message: string;
  appliedCount: number;
  errors: string[];
};

export type SnapshotProductImage = {
  id: string;
  url: string;
  altText: string | null;
  bytes: number | null;
};

export type SnapshotProductVariant = {
  id?: string;
  sku: string | null;
  inventoryItemId?: string | null;
  inventoryTracked: boolean;
};

export type SnapshotProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionLength?: number;
  seo?: { title: string | null; description: string | null };
  images?: SnapshotProductImage[];
  variants?: SnapshotProductVariant[];
  heroImageBytes: number | null;
};

export type TrustPageKey = "about" | "contact" | "faq";

export const PRODUCT_SEO_EDIT_LIMIT = 25;
