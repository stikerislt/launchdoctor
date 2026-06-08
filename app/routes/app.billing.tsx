import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, Form, useNavigate, useSubmit } from "@remix-run/react";
import { useState } from "react";
import {
  Card,
  BlockStack,
  Text,
  Button,
  InlineGrid,
  List,
  Banner,
  Modal,
} from "@shopify/polaris";
import { authenticate, AUDIT_PLUS_PLAN } from "../shopify.server";
import prisma from "../db.server";
import {
  devCancelAuditPlus,
  devGrantAuditPlus,
  devGrantOneTimeUnlock,
  getActiveSubscription,
  createOneTimePurchase,
  getBillingReturnUrl,
  hasAuditPlus,
  isShopBillingTestMode,
  isDevBillingBypassEnabled,
  revokeAuditPlus,
} from "../lib/billing.server";
import { shopifyAppPath } from "../lib/app-routes";
import { AppPage } from "../components/AppPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const auditId = url.searchParams.get("auditId");

  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
  });

  const [activeSubscription, auditPlusActive] = store
    ? await Promise.all([getActiveSubscription(store.id), hasAuditPlus(store.id)])
    : [null, false];

  return json({
    auditId,
    shopDomain: session.shop,
    devBillingBypass: isDevBillingBypassEnabled(),
    auditPlusActive,
    activeSubscription: activeSubscription
      ? {
          id: activeSubscription.id,
          startedAt: activeSubscription.startedAt.toISOString(),
          currentPeriodEnd: activeSubscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    justCancelled: url.searchParams.get("cancelled") === "true",
    billingDeclined: url.searchParams.get("billing") === "declined",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, redirect, billing } = await authenticate.admin(request);
  const url = new URL(request.url);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const auditId = String(
    formData.get("auditId") ?? url.searchParams.get("auditId") ?? "",
  ).trim();

  try {
    if (isDevBillingBypassEnabled()) {
      if (intent === "one-time" && auditId) {
        await devGrantOneTimeUnlock(session.shop, auditId);
        return redirect(shopifyAppPath(`/app/audit/${auditId}?unlocked=true`, session.shop));
      }

      if (intent === "subscription") {
        await devGrantAuditPlus(session.shop);
        return redirect(shopifyAppPath("/app/audit-plus?subscribed=true", session.shop));
      }

      if (intent === "cancel-subscription") {
        await devCancelAuditPlus(session.shop);
        return redirect(shopifyAppPath("/app/billing?cancelled=true", session.shop));
      }
    }

    if (intent === "cancel-subscription") {
      const store = await prisma.store.findUnique({
        where: { shopDomain: session.shop },
      });
      if (!store) {
        return json({ error: "Store not found" }, { status: 404 });
      }

      const activeSubscription = await getActiveSubscription(store.id);
      if (!activeSubscription) {
        return json({ error: "No active Audit Plus subscription to cancel." }, { status: 400 });
      }

      await billing.cancel({
        subscriptionId: activeSubscription.id,
        isTest: await isShopBillingTestMode(admin),
      });
      await revokeAuditPlus(store.id, activeSubscription.id);
      return redirect(shopifyAppPath("/app/billing?cancelled=true", session.shop));
    }

    if (intent === "one-time") {
      if (!auditId) {
        return json(
          { error: "Open an audit report first, then unlock from that report." },
          { status: 400 },
        );
      }

      const store = await prisma.store.findUnique({
        where: { shopDomain: session.shop },
      });
      if (!store) {
        return json({ error: "Store not found" }, { status: 404 });
      }

      const audit = await prisma.audit.findFirst({
        where: { id: auditId, storeId: store.id },
      });
      if (!audit) {
        return json(
          { error: "Audit not found. Open the report you want to unlock, then try again." },
          { status: 400 },
        );
      }

      const returnUrl = await getBillingReturnUrl(
        admin,
        `/app/billing/confirm?auditId=${encodeURIComponent(auditId)}`,
        session.shop,
      );

      const isTest = await isShopBillingTestMode(admin);
      const result = await createOneTimePurchase(admin, returnUrl, isTest);

      return redirect(result.confirmationUrl, { target: "_top" });
    }

    if (intent === "subscription") {
      const returnUrl = await getBillingReturnUrl(
        admin,
        "/app/billing/confirm?type=subscription",
        session.shop,
      );

      const isTest = await isShopBillingTestMode(admin);

      return await billing.request({
        plan: AUDIT_PLUS_PLAN,
        isTest,
        returnUrl,
      });
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) throw error;
    const message =
      error instanceof Error ? error.message : "Billing failed. Please try again.";
    return json({ error: message }, { status: 400 });
  }
};

export default function Billing() {
  const {
    auditId,
    shopDomain,
    devBillingBypass,
    auditPlusActive,
    activeSubscription,
    justCancelled,
    billingDeclined,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const billingError = actionData && "error" in actionData ? actionData.error : null;

  const backTo = auditId ? `/app/audit/${auditId}` : "/app";
  const backLabel = auditId ? "Audit report" : "Dashboard";
  const oneTimeFormAction = auditId
    ? shopifyAppPath(`/app/billing?auditId=${encodeURIComponent(auditId)}`, shopDomain)
    : undefined;
  const canCancelSubscription = Boolean(activeSubscription) || (devBillingBypass && auditPlusActive);
  const startedLabel = activeSubscription?.startedAt
    ? new Date(activeSubscription.startedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <AppPage title="Unlock Launch Doctor" shopDomain={shopDomain} backTo={backTo} backLabel={backLabel}>
      <BlockStack gap="400">
        {devBillingBypass && (
          <Banner tone="info">
            Dev mode: billing is bypassed locally because custom apps cannot use
            Shopify&apos;s Billing API until the app has public distribution.
            Unlocks are granted instantly with no charge.
          </Banner>
        )}

        {justCancelled && (
          <Banner tone="success" title="Audit Plus cancelled">
            Your subscription has been cancelled. Fix Center and subscriber-only tools are
            no longer available. One-time report unlocks you already purchased are kept.
          </Banner>
        )}

        {auditPlusActive && !justCancelled && (
          <Banner tone="success">
            Audit Plus is active. Open the Audit Plus hub for Fix Center and monitoring.
          </Banner>
        )}

        {billingDeclined && (
          <Banner tone="warning">
            Charge was not approved. You can try again when you are ready.
          </Banner>
        )}

        {billingError && <Banner tone="critical">{billingError}</Banner>}

        {canCancelSubscription && !justCancelled && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Manage Audit Plus subscription
              </Text>
              {startedLabel && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  Active since {startedLabel}. Billed $9/month through Shopify.
                </Text>
              )}
              {devBillingBypass && !activeSubscription && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  Dev mode: subscription is simulated locally (no Shopify charge).
                </Text>
              )}
              <Text as="p" variant="bodyMd">
                Cancelling stops future billing and removes Fix Center, automatic report
                unlocks, and theme-change rescans. Reports you unlocked with a one-time
                purchase stay available.
              </Text>
              <Button tone="critical" onClick={() => setShowCancelModal(true)}>
                Cancel Audit Plus subscription
              </Button>
            </BlockStack>
          </Card>
        )}

        <InlineGrid columns={2} gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                $19 one-time — this report
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Best if you only need the full findings and PDF for this single audit — read
                and fix issues yourself using guided steps.
              </Text>
              <List type="bullet">
                <List.Item>All audit findings for this report (not just the free preview)</List.Item>
                <List.Item>Fix steps with admin deep-links</List.Item>
                <List.Item>PDF export for this audit</List.Item>
              </List>
              <Text as="p" variant="bodySm" tone="subdued">
                Does not include Audit Plus: no Fix Center, no one-click SEO or catalog fixes,
                no automatic unlock on future audits, and no theme-publish rescan.
              </Text>
              {auditId ? (
                <Form method="post" action={oneTimeFormAction}>
                  <input type="hidden" name="intent" value="one-time" />
                  <input type="hidden" name="auditId" value={auditId} />
                  <Button submit variant="primary" disabled={auditPlusActive}>
                    {devBillingBypass ? "Unlock this report (dev)" : "Unlock this report"}
                  </Button>
                </Form>
              ) : (
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Open an audit report first, then use Unlock from that report so we know
                    which scan to unlock.
                  </Text>
                  <Button onClick={() => navigate(shopifyAppPath("/app", shopDomain))}>
                    Go to dashboard
                  </Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                $9/month — Audit Plus
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Ongoing monitoring and Fix Center. After subscribing, use the Audit Plus
                hub to apply fixes.
              </Text>
              <List type="bullet">
                <List.Item>Fix Center — alt text, images, SEO, descriptions, SKUs, inventory, trust pages</List.Item>
                <List.Item>Every audit report unlocked automatically</List.Item>
                <List.Item>Auto re-scan when you publish a theme (active now)</List.Item>
                <List.Item>Weekly scheduled rescans (coming soon)</List.Item>
              </List>
              <Form method="post">
                <input type="hidden" name="intent" value="subscription" />
                <input type="hidden" name="auditId" value={auditId ?? ""} />
                <Button submit disabled={auditPlusActive}>
                  {auditPlusActive
                    ? "Audit Plus active"
                    : devBillingBypass
                      ? "Enable Audit Plus (dev)"
                      : "Subscribe to Audit Plus"}
                </Button>
              </Form>
              {auditPlusActive && (
                <Button
                  variant="plain"
                  onClick={() => navigate(shopifyAppPath("/app/audit-plus", shopDomain))}
                >
                  Open Audit Plus hub
                </Button>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>

        <Modal
          open={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title="Cancel Audit Plus subscription?"
          primaryAction={{
            content: "Yes, cancel subscription",
            destructive: true,
            onAction: () => {
              setShowCancelModal(false);
              submit({ intent: "cancel-subscription" }, { method: "post" });
            },
          }}
          secondaryActions={[
            { content: "Keep subscription", onAction: () => setShowCancelModal(false) },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                Please confirm you want to cancel Audit Plus ($9/month). Here is what
                will happen:
              </Text>
              <List type="bullet">
                <List.Item>
                  Shopify will stop future subscription charges for Launch Doctor.
                </List.Item>
                <List.Item>
                  Fix Center and one-click fixes will no longer be available.
                </List.Item>
                <List.Item>
                  New audits will show only the free preview unless you unlock reports
                  individually ($19) or subscribe again.
                </List.Item>
                <List.Item>
                  One-time report unlocks you already paid for are not removed.
                </List.Item>
              </List>
              {devBillingBypass && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Dev mode: no real charge is cancelled in Shopify — access is removed
                  locally only.
                </Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>

      </BlockStack>
    </AppPage>
  );
}
