import type { LoaderFunctionArgs } from "@remix-run/node";
import { Card, BlockStack, Spinner, Text, Page } from "@shopify/polaris";
import { authenticate, AUDIT_PLUS_PLAN } from "../shopify.server";
import prisma from "../db.server";
import {
  appPurchaseOneTimeGid,
  appSubscriptionGid,
  confirmOneTimePurchase,
  grantAuditUnlock,
  grantAuditPlus,
} from "../lib/billing.server";
import { cacheAuditPdfIfPossible } from "../lib/pdf.server";
import { shopifyAppPath } from "../lib/app-routes";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session, redirect } = await authenticate.admin(request);
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
    const subscriptionGid = appSubscriptionGid(chargeId);
    const { appSubscriptions } = await billing.check({ plans: [AUDIT_PLUS_PLAN] });
    const active = appSubscriptions.find(
      (sub) => sub.id === subscriptionGid && sub.status === "ACTIVE",
    );
    if (active) {
      await grantAuditPlus(store.id, subscriptionGid);
      return redirect(shopifyAppPath("/app/audit-plus?subscribed=true", session.shop));
    }
  }

  if (auditId && chargeId) {
    const active = await confirmOneTimePurchase(admin, chargeId);
    if (active) {
      await grantAuditUnlock(store.id, auditId, appPurchaseOneTimeGid(chargeId));
      await cacheAuditPdfIfPossible(auditId);
      return redirect(shopifyAppPath(`/app/audit/${auditId}?unlocked=true`, session.shop));
    }
  }

  return redirect(shopifyAppPath("/app/billing?billing=declined", session.shop));
};

export default function BillingConfirm() {
  return (
    <Page>
      <Card>
        <BlockStack gap="300" inlineAlign="center">
          <Spinner accessibilityLabel="Confirming your purchase" size="large" />
          <Text as="p" variant="bodyMd" tone="subdued">
            Confirming your purchase…
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}
