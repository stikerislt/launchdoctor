import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
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
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  cancelAuditPlusSubscription,
  createOneTimePurchase,
  createSubscription,
  devCancelAuditPlus,
  devGrantAuditPlus,
  devGrantOneTimeUnlock,
  getActiveSubscription,
  hasAuditPlus,
  isDevBillingBypassEnabled,
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

  const activeSubscription = store ? await getActiveSubscription(store.id) : null;

  return json({
    auditId,
    shopDomain: session.shop,
    devBillingBypass: isDevBillingBypassEnabled(),
    auditPlusActive: store ? await hasAuditPlus(store.id) : false,
    activeSubscription: activeSubscription
      ? {
          id: activeSubscription.id,
          startedAt: activeSubscription.startedAt.toISOString(),
          currentPeriodEnd: activeSubscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    justCancelled: url.searchParams.get("cancelled") === "true",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const auditId = formData.get("auditId") as string;
  const appUrl = process.env.APP_URL || process.env.SHOPIFY_APP_URL || "";

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

      await cancelAuditPlusSubscription(admin, store.id, activeSubscription.id);
      return redirect(shopifyAppPath("/app/billing?cancelled=true", session.shop));
    }

    if (intent === "one-time") {
      const result = await createOneTimePurchase(
        admin,
        auditId,
        `${appUrl}/app/billing/confirm?auditId=${encodeURIComponent(auditId)}`,
      );
      return redirect(result.confirmationUrl);
    }

    if (intent === "subscription") {
      const result = await createSubscription(
        admin,
        `${appUrl}/app/billing/confirm?type=subscription`,
      );
      return redirect(result.confirmationUrl);
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
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
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const billingError = actionData && "error" in actionData ? actionData.error : null;

  const backTo = auditId ? `/app/audit/${auditId}` : "/app";
  const backLabel = auditId ? "Audit report" : "Dashboard";
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
                Best if you only need the full findings and PDF for this audit.
              </Text>
              <List type="bullet">
                <List.Item>All 50 audit findings</List.Item>
                <List.Item>Fix steps with admin deep-links</List.Item>
                <List.Item>PDF export</List.Item>
              </List>
              <Form method="post">
                <input type="hidden" name="intent" value="one-time" />
                <input type="hidden" name="auditId" value={auditId ?? ""} />
                <Button submit variant="primary" disabled={auditPlusActive}>
                  {devBillingBypass ? "Unlock this report (dev)" : "Unlock this report"}
                </Button>
              </Form>
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
