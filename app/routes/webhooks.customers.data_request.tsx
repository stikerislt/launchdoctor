import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  const log = await prisma.webhookLog.create({
    data: { topic, shop, payload: payload as object },
  });

  await prisma.webhookLog.update({
    where: { id: log.id },
    data: {
      processedAt: new Date(),
    },
  });

  return new Response(JSON.stringify({ customer_data: [] }), {
    headers: { "Content-Type": "application/json" },
  });
};
