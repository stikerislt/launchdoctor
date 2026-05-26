import * as Sentry from "@sentry/node";
import prisma from "../../app/lib/prisma.server";
import { getOfflineSession } from "../../app/lib/shopify.server";
import shopify from "../../app/lib/shopify.server";
import { buildSnapshot } from "../../collector/snapshot-builder";
import { runRules, computeAllScores } from "../../audit-engine/engine";
import pino from "pino";

const logger = pino({ name: "run-audit" });

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

export async function runAudit(auditId: string) {
  const audit = await prisma.audit.update({
    where: { id: auditId },
    data: { status: "RUNNING", startedAt: new Date() },
    include: { store: true },
  });

  const shop = audit.store.shopDomain;
  logger.info({ auditId, shop }, "Audit started");

  try {
    const session = await getOfflineSession(shop);
    const { admin } = await shopify.unauthenticated.admin(session.shop);
    const snapshot = await buildSnapshot(admin, shop);
    const findings = runRules(snapshot);
    const { launchScore } = computeAllScores(findings);

    await prisma.$transaction([
      prisma.finding.createMany({
        data: findings.map((f: Awaited<ReturnType<typeof runRules>>[number]) => ({
          auditId,
          ruleId: f.ruleId,
          ruleCode: f.ruleCode,
          severity: f.severity,
          category: f.category,
          title: f.title,
          body: f.body,
          fixSteps: f.fixSteps,
          fixDeepLink: f.fixDeepLink,
          evidence: f.evidence ? (f.evidence as object) : undefined,
          confidence: f.confidence,
        })),
      }),
      prisma.audit.update({
        where: { id: auditId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          durationMs: Date.now() - (audit.startedAt?.getTime() ?? Date.now()),
          snapshot: snapshot as object,
          launchScore,
        },
      }),
    ]);

    logger.info({ auditId, shop, launchScore, findingCount: findings.length }, "Audit completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.audit.update({
      where: { id: auditId },
      data: { status: "FAILED", errorMessage: message },
    });
    Sentry.captureException(err, { tags: { shop, auditId } });
    logger.error({ auditId, shop, err: message }, "Audit failed");
    throw err;
  }
}
