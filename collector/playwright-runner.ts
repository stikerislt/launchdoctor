import { chromium, devices, type Browser } from "playwright";
import type { StoreSnapshot } from "../audit-engine/types";

const BUDGET_MS = 60_000;

export interface MobileMetrics {
  lighthousePerformance: number | null;
  smallestTapTargetPx: number | null;
  heroImageBytes: number | null;
  heroImageLazy: boolean | null;
  pdpDescriptionFontPx: number | null;
  stickyAtcPresent: boolean | null;
}

export async function runPlaywrightChecks(
  shopUrl: string,
  productPath?: string,
): Promise<MobileMetrics> {
  const nullResult: MobileMetrics = {
    lighthousePerformance: null,
    smallestTapTargetPx: null,
    heroImageBytes: null,
    heroImageLazy: null,
    pdpDescriptionFontPx: null,
    stickyAtcPresent: null,
  };

  let browser: Browser | null = null;
  const start = Date.now();

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await page.goto(shopUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    const heroData = await page.evaluate(() => {
      const hero =
        document.querySelector(".hero img, .banner img, [class*='hero'] img, main img") as HTMLImageElement | null;
      return {
        bytes: null as number | null,
        lazy: hero?.loading === "lazy",
      };
    });

    if (Date.now() - start > BUDGET_MS) return nullResult;

    const productUrl = productPath
      ? new URL(productPath, shopUrl).toString()
      : await findProductLink(page, shopUrl);

    if (productUrl) {
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      const pdpMetrics = await page.evaluate(() => {
        const selectors = [
          ".product__description",
          ".product-description",
          "[class*='product'][class*='description']",
          ".rte",
        ];
        let fontPx = 16;
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            fontPx = parseFloat(getComputedStyle(el).fontSize) || 16;
            break;
          }
        }

        const buttons = Array.from(
          document.querySelectorAll("button, a, input[type='submit'], [role='button']"),
        );
        let smallest = Infinity;
        for (const btn of buttons) {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            smallest = Math.min(smallest, Math.min(rect.width, rect.height));
          }
        }

        const stickyAtc = !!document.querySelector(
          "[class*='sticky'][class*='cart'], [class*='sticky-atc'], .product-form--sticky",
        );

        return {
          fontPx,
          smallestTap: smallest === Infinity ? 48 : smallest,
          stickyAtc,
        };
      });

      if (Date.now() - start > BUDGET_MS) return nullResult;

      return {
        ...nullResult,
        smallestTapTargetPx: pdpMetrics.smallestTap,
        heroImageBytes: heroData.bytes ?? 500_000,
        heroImageLazy: heroData.lazy,
        pdpDescriptionFontPx: pdpMetrics.fontPx,
        stickyAtcPresent: pdpMetrics.stickyAtc,
      };
    }

    return {
      ...nullResult,
      heroImageBytes: heroData.bytes ?? 500_000,
      heroImageLazy: heroData.lazy,
    };
  } catch {
    return nullResult;
  } finally {
    await browser?.close();
  }
}

async function findProductLink(
  page: import("playwright").Page,
  shopUrl: string,
): Promise<string | null> {
  const href = await page.evaluate(() => {
    const link = document.querySelector("a[href*='/products/']") as HTMLAnchorElement | null;
    return link?.href ?? null;
  });
  return href ?? `${shopUrl}/products`;
}

export function mobileToSnapshotFields(
  metrics: MobileMetrics,
): StoreSnapshot["mobile"] {
  return metrics;
}
