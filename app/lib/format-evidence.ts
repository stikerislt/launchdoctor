export function formatEvidence(
  ruleCode: string,
  evidence: Record<string, unknown> | null | undefined,
): string[] {
  if (!evidence || Object.keys(evidence).length === 0) return [];

  const lines: string[] = [];

  switch (ruleCode) {
    case "PAY_AUTO_CAPTURE":
      if (evidence.captureMode) lines.push(`Payment capture: ${evidence.captureMode}`);
      if (evidence.shopPayEnabled === true) {
        lines.push("Shop Pay: enabled (Shopify Protect may apply to eligible orders)");
      } else if (evidence.shopPayEnabled === false) {
        lines.push("Shop Pay: not enabled");
      }
      break;
    case "PAY_TEST_MODE":
      lines.push("Shopify Payments is in test mode");
      if (evidence.hasRealOrder === false) lines.push("No real (non-test) orders in the last 30 days");
      break;
    case "POL_REFUND_MISSING":
      lines.push(
        typeof evidence.bodyLength === "number" && evidence.bodyLength > 0
          ? `Refund policy is only ${evidence.bodyLength} characters (minimum 50 recommended)`
          : "No refund policy found",
      );
      break;
    case "POL_ALL_MISSING":
      if (Array.isArray(evidence.missing)) {
        lines.push(`Missing policies: ${(evidence.missing as string[]).join(", ")}`);
      }
      break;
    case "PROD_THIN_DESC":
    case "PROD_SINGLE_IMAGE":
    case "PROD_NO_IMAGE":
    case "PROD_MISSING_ALT":
    case "PROD_NO_SKU":
    case "PROD_NO_WEIGHT":
    case "PROD_INVENTORY_OFF":
    case "SEO_HANDLE_NOISE":
    case "SEO_HEAVY_IMAGES":
    case "SEO_PRODUCT_META": {
      const key = Object.keys(evidence)[0];
      const val = evidence[key!];
      if (typeof val === "number") {
        const labels: Record<string, string> = {
          thinDescPct: "of sampled products have descriptions under 50 characters",
          singleImagePct: "of sampled products have fewer than 3 images",
          noImagePct: "of sampled products have no image at all",
          missingAltPct: "of sampled products are missing image alt text",
          noSkuPct: "of variants have no SKU",
          noWeightPct: "of variants have no weight set",
          inventoryOffPct: "of variants have inventory tracking disabled",
          handleNoisePct: "of product handles contain random number suffixes",
          heavyImagePct: "of product images exceed 500 KB",
          missingProductSeoPct: "of products are missing an SEO title or meta description",
        };
        lines.push(`${Math.round(val)}% ${labels[key!] ?? key}`);
      }
      break;
    }
    case "PROD_BROKEN_COMPARE_AT":
      if (typeof evidence.count === "number") {
        lines.push(`${evidence.count} variant(s) have compare-at price ≤ sale price`);
      }
      break;
    case "PROD_DUPLICATE":
      if (typeof evidence.duplicatePairCount === "number") {
        lines.push(`${evidence.duplicatePairCount} near-duplicate product title pair(s) detected`);
      }
      break;
    case "SHIP_LOW_INTL_RATE":
      if (Array.isArray(evidence.zones)) {
        lines.push(`Zones with low rates: ${(evidence.zones as string[]).join(", ")}`);
      }
      break;
    case "SHIP_NO_FREE_THRESHOLD":
      if (evidence.hasThreshold === false) lines.push("No free-shipping threshold configured");
      if (typeof evidence.aov === "number") {
        lines.push(`Current average order value: $${evidence.aov.toFixed(2)}`);
      }
      break;
    case "SEO_NO_CUSTOM_DOMAIN":
      if (evidence.host) lines.push(`Current primary domain: ${evidence.host}`);
      break;
    case "SEO_DEFAULT_TITLE":
      if (evidence.title) lines.push(`Homepage title: "${evidence.title}"`);
      break;
    case "SEO_ROBOTS_BLOCKED":
      lines.push("robots.txt contains Disallow: / for all crawlers");
      if (evidence.storefrontPasswordProtected === true) {
        lines.push("Storefront password protection appears to be enabled");
      } else if (evidence.storefrontPasswordProtected === false) {
        lines.push("No password page detected — check for a custom robots.txt.liquid template");
      }
      break;
    case "SEO_NO_SITEMAP":
      if (evidence.status) lines.push(`Sitemap returned HTTP ${evidence.status}`);
      if (typeof evidence.urlCount === "number") {
        lines.push(`Sitemap contains ${evidence.urlCount} URLs`);
      }
      if (evidence.storefrontPasswordProtected === true) {
        lines.push("Storefront password protection may be blocking public access");
      }
      break;
    case "TRUST_VAGUE_RETURNS":
      if (typeof evidence.wordCount === "number") {
        lines.push(`Refund policy contains only ${evidence.wordCount} words`);
      }
      break;
    case "TRUST_NO_ABOUT":
      if (typeof evidence.aboutBodyLength === "number") {
        lines.push(
          evidence.aboutBodyLength === 0
            ? "No About page found"
            : `About page is only ${evidence.aboutBodyLength} characters`,
        );
      }
      break;
    case "TRUST_BROKEN_SOCIAL":
      if (Array.isArray(evidence.broken)) {
        lines.push(`Broken links: ${(evidence.broken as string[]).join(", ")}`);
      }
      break;
    case "PAY_MANUAL_METHODS_RAW":
      if (Array.isArray(evidence.methods)) {
        lines.push(`Manual methods: ${(evidence.methods as string[]).join(", ")}`);
      }
      break;
    case "LOC_MISSING":
      if (evidence.location) lines.push(`Primary location: ${evidence.location}`);
      else lines.push("No fulfillment location configured");
      break;
    case "THM_LOW_LIGHTHOUSE":
      if (typeof evidence.score === "number") {
        lines.push(`Mobile PageSpeed performance score: ${Math.round(evidence.score)}/100`);
      }
      break;
    case "THM_TINY_TAPS":
      if (typeof evidence.smallestTapTargetPx === "number") {
        lines.push(`Smallest tap target: ${evidence.smallestTapTargetPx}px (48px minimum recommended)`);
      }
      break;
    case "THM_HEAVY_HERO":
      if (typeof evidence.heroImageBytes === "number") {
        lines.push(`Hero image size: ${Math.round(evidence.heroImageBytes / 1024)} KB`);
      }
      if (evidence.heroImageLazy === false) lines.push("Hero image is not lazy-loaded");
      break;
    case "THM_SMALL_FONT":
      if (typeof evidence.pdpDescriptionFontPx === "number") {
        lines.push(`Product description font size: ${evidence.pdpDescriptionFontPx}px`);
      }
      break;
    case "THM_OUTDATED":
      if (evidence.installedVersion != null && evidence.themeStoreLatestVersion != null) {
        lines.push(
          `Installed theme version: ${evidence.installedVersion} (latest: ${evidence.themeStoreLatestVersion})`,
        );
      }
      break;
    default:
      for (const [key, val] of Object.entries(evidence)) {
        if (val == null) continue;
        if (typeof val === "boolean") {
          lines.push(`${key}: ${val ? "yes" : "no"}`);
        } else if (Array.isArray(val)) {
          lines.push(`${key}: ${val.join(", ")}`);
        } else {
          lines.push(`${String(key)}: ${String(val)}`);
        }
      }
  }

  return lines;
}
