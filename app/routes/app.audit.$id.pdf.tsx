import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { deliverAuditPdf } from "../lib/pdf.server";
import {
  isAuditContentUnlocked,
  loadAuditForShop,
} from "../lib/audit-access.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const auditId = params.id;

  if (!auditId) {
    throw new Response("Audit not found", { status: 404 });
  }

  const audit = await loadAuditForShop(auditId, session.shop);
  if (!audit) {
    throw new Response("Audit not found", { status: 404 });
  }

  const contentUnlocked = await isAuditContentUnlocked(audit);
  if (!contentUnlocked) {
    throw new Response("Report not unlocked", { status: 403 });
  }

  if (audit.status !== "COMPLETED") {
    throw new Response("Audit not ready", { status: 409 });
  }

  try {
    return await deliverAuditPdf(audit);
  } catch {
    throw new Response("Unable to generate PDF", { status: 500 });
  }
};
