import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  const log = await prisma.webhookLog.create({
    data: { topic, shop, payload: payload as object },
  });

  try {
    const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (store) {
      await prisma.finding.deleteMany({ where: { audit: { storeId: store.id } } });
      await prisma.audit.deleteMany({ where: { storeId: store.id } });
      await prisma.entitlement.deleteMany({ where: { storeId: store.id } });
      await prisma.subscription.deleteMany({ where: { storeId: store.id } });
      await prisma.store.delete({ where: { id: store.id } });
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
