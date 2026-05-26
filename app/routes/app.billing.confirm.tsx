import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  confirmOneTimePurchase,
  grantAuditUnlock,
  grantAuditPlus,
} from "../lib/billing.server";
import { cacheAuditPdfIfPossible } from "../lib/pdf.server";
import { shopifyAppPath } from "../lib/app-routes";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const auditId = url.searchParams.get("auditId");
  const type = url.searchParams.get("type");
  const chargeId = url.searchParams.get("charge_id");

  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!store) {
    return redirect(shopifyAppPath("/app", session.shop));
  }

  if (type === "subscription" && chargeId) {
    await grantAuditPlus(store.id, chargeId);
    return redirect(shopifyAppPath("/app/audit-plus?subscribed=true", session.shop));
  }

  if (auditId && chargeId) {
    const active = await confirmOneTimePurchase(admin, chargeId);
    if (active) {
      await grantAuditUnlock(store.id, auditId, chargeId);
      await cacheAuditPdfIfPossible(auditId);

      return redirect(shopifyAppPath(`/app/audit/${auditId}?unlocked=true`, session.shop));
    }
  }

  return redirect(shopifyAppPath("/app/billing", session.shop));
};
