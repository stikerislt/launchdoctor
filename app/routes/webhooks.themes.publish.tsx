import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { enqueueAudit } from "../lib/queue.server";
import { hasAuditPlus } from "../lib/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  const log = await prisma.webhookLog.create({
    data: { topic, shop, payload: payload as object },
  });

  try {
    const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (store && (await hasAuditPlus(store.id))) {
      const audit = await prisma.audit.create({
        data: {
          storeId: store.id,
          status: "PENDING",
          triggeredBy: "WEBHOOK_THEME_PUBLISH",
        },
      });
      await enqueueAudit(audit.id);
    }

    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { error: String(err) },
    });
  }

  return new Response(null, { status: 200 });
};
