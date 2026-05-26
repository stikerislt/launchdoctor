import type { FixId } from "./types";

export const FIX_APPLY_LABELS: Record<FixId, (itemCount: number) => string> = {
  "alt-text": (count) => `Fix alt text (${count})`,
  "optimize-images": (count) => `Optimize images (${count})`,
  "homepage-seo": () => "Apply homepage SEO",
  "product-seo": () => "Save product SEO",
  "thin-descriptions": (count) => `Expand descriptions (${count})`,
  "assign-skus": (count) => `Assign SKUs (${count})`,
  "enable-inventory": (count) => `Enable tracking (${count})`,
  "trust-pages": (count) => `Create pages (${count})`,
};
