import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate, sessionStorage } from "../shopify.server";
import prisma from "../db.server";

async function logWebhook(topic: string, shop: string, payload: unknown) {
  return prisma.webhookLog.create({
    data: { topic, shop, payload: payload as object },
  });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const log = await logWebhook(topic, shop, payload);

  try {
    await prisma.store.updateMany({
      where: { shopDomain: shop },
      data: { uninstalledAt: new Date() },
    });

    await prisma.audit.updateMany({
      where: {
        store: { shopDomain: shop },
        status: { in: ["PENDING", "RUNNING"] },
      },
      data: { status: "FAILED", errorMessage: "App uninstalled" },
    });

    const sessions = await sessionStorage.findSessionsByShop(shop);
    if (sessions.length) {
      await sessionStorage.deleteSessions(sessions.map((s) => s.id));
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

  return new Response();
};
