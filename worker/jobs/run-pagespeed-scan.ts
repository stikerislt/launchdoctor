import * as Sentry from "@sentry/node";
import prisma from "../../app/lib/prisma.server";
import { getOfflineSession } from "../../app/lib/shopify.server";
import shopify from "../../app/lib/shopify.server";
import { SHOP_QUERY, type ShopQueryResult } from "../../collector/queries/shop";
import { graphqlWithRetry } from "../../collector/graphql";
import { fetchPageSpeedMobileScore } from "../../collector/pagespeed";
import { resolveStorefrontUrl } from "../../collector/storefront-url";
import pino from "pino";

const logger = pino({ name: "run-pagespeed-scan" });

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

export async function runPageSpeedScanJob(scanId: string) {
  const scan = await prisma.pageSpeedScan.update({
    where: { id: scanId },
    data: { status: "RUNNING", startedAt: new Date() },
    include: { store: true },
  });

  const shop = scan.store.shopDomain;
  logger.info({ scanId, shop }, "PageSpeed scan started");

  try {
    const session = await getOfflineSession(shop);
    const { admin } = await shopify.unauthenticated.admin(session.shop);

    const shopData = await graphqlWithRetry<ShopQueryResult>(admin, SHOP_QUERY);
    const storefrontUrl = resolveStorefrontUrl(
      shopData.shop.primaryDomain,
      shop,
    );

    const result = await fetchPageSpeedMobileScore(storefrontUrl);

    if (result.score === null) {
      const detail =
        result.error === "missing_api_key"
          ? "PageSpeed API key is not configured on the server."
          : result.error ?? "PageSpeed could not score this URL.";
      await prisma.pageSpeedScan.update({
        where: { id: scanId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          measuredUrl: result.measuredUrl,
          errorMessage: detail,
        },
      });
      logger.warn({ scanId, shop, error: detail }, "PageSpeed scan failed");
      return;
    }

    await prisma.pageSpeedScan.update({
      where: { id: scanId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        measuredUrl: result.measuredUrl,
        score: result.score,
        errorMessage: null,
      },
    });

    logger.info({ scanId, shop, score: result.score, url: result.measuredUrl }, "PageSpeed scan completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.pageSpeedScan.update({
      where: { id: scanId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      },
    });
    Sentry.captureException(err, { tags: { shop, scanId } });
    logger.error({ scanId, shop, err: message }, "PageSpeed scan crashed");
    throw err;
  }
}
