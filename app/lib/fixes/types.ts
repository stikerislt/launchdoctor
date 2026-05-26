export type FixId =
  | "alt-text"
  | "optimize-images"
  | "homepage-seo"
  | "product-seo"
  | "thin-descriptions"
  | "assign-skus"
  | "enable-inventory"
  | "trust-pages";

export const FIX_RULE_CODES: Record<FixId, readonly string[]> = {
  "alt-text": ["PROD_MISSING_ALT"],
  "optimize-images": ["SEO_HEAVY_IMAGES"],
  "homepage-seo": ["SEO_DEFAULT_TITLE", "SEO_NO_META_DESC"],
  "product-seo": ["SEO_PRODUCT_META"],
  "thin-descriptions": ["PROD_THIN_DESC"],
  "assign-skus": ["PROD_NO_SKU"],
  "enable-inventory": ["PROD_INVENTORY_OFF"],
  "trust-pages": ["TRUST_NO_ABOUT", "TRUST_NO_CONTACT", "TRUST_NO_FAQ"],
};

export type FixPreviewItem = {
  id: string;
  label: string;
  detail?: string;
  meta?: Record<string, string | number | null | boolean>;
};

export type ProductSeoDraft = {
  productId: string;
  productTitle: string;
  suggestedProductTitle: string;
  hasBadProductTitle: boolean;
  seoTitle: string;
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
