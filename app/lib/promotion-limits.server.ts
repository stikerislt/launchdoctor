import prisma from "./prisma.server";
import { isPromotionActive, isAdmin } from "./admin.server";

/** Max manual full-store audits per store per rolling 7 days while promotion is active. */
export const PROMOTION_WEEKLY_MANUAL_AUDIT_LIMIT = 3;

export const PROMOTION_LIMIT_MESSAGE =
  "During the free promotion, each store is limited to 3 full audits per week.";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type PromotionAuditLimit = {
  limited: boolean;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  exempt?: boolean;
  resetsAt: string | null;
};

function weekAgo(): Date {
  return new Date(Date.now() - WEEK_MS);
}

/** Count manual audits started in the last 7 days (in-flight counts toward the cap). */
export async function getPromotionManualAuditUsage(storeId: string): Promise<number> {
  return prisma.audit.count({
    where: {
      storeId,
      triggeredBy: "MANUAL",
      status: { in: ["PENDING", "RUNNING", "COMPLETED"] },
      createdAt: { gte: weekAgo() },
    },
  });
}

/** When the oldest counted audit ages out of the rolling window (approximate reset). */
export async function getPromotionLimitResetsAt(storeId: string): Promise<Date | null> {
  const oldest = await prisma.audit.findFirst({
    where: {
      storeId,
      triggeredBy: "MANUAL",
      status: { in: ["PENDING", "RUNNING", "COMPLETED"] },
      createdAt: { gte: weekAgo() },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (!oldest) return null;
  return new Date(oldest.createdAt.getTime() + WEEK_MS);
}

export async function checkPromotionAuditLimit(
  storeId: string,
  shopDomain: string,
  email?: string | null,
): Promise<PromotionAuditLimit> {
  const promotionActive = await isPromotionActive();
  if (!promotionActive) {
    return {
      limited: false,
      allowed: true,
      used: 0,
      limit: 0,
      remaining: 0,
      resetsAt: null,
    };
  }

  const limit = PROMOTION_WEEKLY_MANUAL_AUDIT_LIMIT;

  if (isAdmin(email, shopDomain)) {
    return {
      limited: true,
      allowed: true,
      used: 0,
      limit,
      remaining: limit,
      exempt: true,
      resetsAt: null,
    };
  }

  const used = await getPromotionManualAuditUsage(storeId);
  const resetsAt = await getPromotionLimitResetsAt(storeId);

  return {
    limited: true,
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: resetsAt?.toISOString() ?? null,
  };
}
