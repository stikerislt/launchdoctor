import prisma from "../db.server";

export async function loader() {
  const [auditCounts, unlockCount] = await Promise.all([
    prisma.audit.groupBy({ by: ["status"], _count: true }),
    prisma.entitlement.count({ where: { type: "ONE_TIME_UNLOCK" } }),
  ]);

  const lines = [
    "# HELP audits_total Total audits by status",
    "# TYPE audits_total counter",
    ...auditCounts.map(
      (c) => `audits_total{status="${c.status}"} ${c._count}`,
    ),
    "# HELP unlocks_total Total one-time unlocks",
    "# TYPE unlocks_total counter",
    `unlocks_total ${unlockCount}`,
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
