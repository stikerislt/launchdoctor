import * as Sentry from "@sentry/node";
import prisma from "../../app/lib/prisma.server";
import { getOfflineSession } from "../../app/lib/shopify.server";
import shopify from "../../app/lib/shopify.server";
import { runLinkScan } from "../../collector/link-crawler";
import pino from "pino";

const logger = pino({ name: "run-link-scan" });

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

export async function runLinkScanJob(scanId: string) {
  const scan = await prisma.linkScan.update({
    where: { id: scanId },
    data: { status: "RUNNING", startedAt: new Date() },
    include: { store: true },
  });

  const shop = scan.store.shopDomain;
  logger.info({ scanId, shop }, "Link scan started");

  try {
    const session = await getOfflineSession(shop);
    const { admin } = await shopify.unauthenticated.admin(session.shop);

    const result = await runLinkScan(admin, shop, async (progress) => {
      // Best-effort live progress for the polling UI; ignore write failures.
      try {
        await prisma.linkScan.update({
          where: { id: scanId },
          data: {
            ...(progress.pagesScanned !== undefined
              ? { pagesScanned: progress.pagesScanned }
              : {}),
            ...(progress.linksChecked !== undefined
              ? { linksChecked: progress.linksChecked }
              : {}),
          },
        });
      } catch {
        // non-fatal
      }
    });

    await prisma.$transaction([
      prisma.linkIssue.createMany({
        data: result.issues.map((issue) => ({
          scanId,
          sourceType: issue.sourceType,
          sourceRef: issue.sourceRef,
          sourceLabel: issue.sourceLabel,
          sourceAdminUrl: issue.sourceAdminUrl,
          url: issue.url,
          kind: issue.kind,
          statusCode: issue.statusCode,
          redirectChain: issue.redirectChain,
          detail: issue.detail,
        })),
      }),
      prisma.linkScan.update({
        where: { id: scanId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          pagesScanned: result.pagesScanned,
          linksChecked: result.linksChecked,
          brokenCount: result.issues.length,
          truncated: result.truncated,
        },
      }),
    ]);

    logger.info(
      { scanId, shop, broken: result.issues.length, links: result.linksChecked },
      "Link scan completed",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.linkScan.update({
      where: { id: scanId },
      data: { status: "FAILED", errorMessage: message },
    });
    Sentry.captureException(err, { tags: { shop, scanId } });
    logger.error({ scanId, shop, err: message }, "Link scan failed");
    throw err;
  }
}
