import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { productsLink } from "../utils/deep-link";

function detectImageFormat(url: string): "png" | "jpeg" | "webp" | "other" {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".webp")) return "webp";
    if (pathname.endsWith(".png")) return "png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "jpeg";
  } catch {
    // Not a valid URL
  }
  return "other";
}

export const prodPngFormatRule: Rule = {
  id: 52,
  code: "PROD_PNG_FORMAT",
  category: Category.PRODUCT_CATALOG,
  severity: Severity.MEDIUM,
  title: "Many product images still use PNG instead of WebP",
  description: ">25% of product images are PNG format — WebP delivers smaller files at the same quality.",
  evaluate(snap) {
    let total = 0;
    let png = 0;

    for (const product of snap.products.sampled) {
      for (const image of product.images ?? []) {
        if (!image.url) continue;
        total++;
        if (detectImageFormat(image.url) === "png") png++;
      }
    }

    if (total === 0 || png / total <= 0.25) return null;

    const pct = Math.round((png / total) * 100);

    return createFinding({
      snap,
      ruleId: 52,
      ruleCode: "PROD_PNG_FORMAT",
      category: Category.PRODUCT_CATALOG,
      severity: Severity.MEDIUM,
      title: "Many product images still use PNG instead of WebP",
      body: `${pct}% of product images (${png} of ${total}) are PNG. WebP offers smaller file sizes at equivalent quality, improving page load speed and Core Web Vitals.`,
      fixSteps: getFixSteps("PROD_PNG_FORMAT"),
      fixDeepLink: productsLink(snap.shop.handle),
      evidence: { pngCount: png, totalImages: total, pngPct: pct },
    });
  },
};
