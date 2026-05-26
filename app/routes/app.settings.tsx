import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Card,
  Text,
  BlockStack,
  Banner,
  Badge,
  List,
  InlineStack,
  Button,
} from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { hasAuditPlus } from "../lib/billing.server";
import { AppPage } from "../components/AppPage";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { shopifyAppPath } from "../lib/app-routes";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const justSubscribed = url.searchParams.get("subscribed") === "true";

  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
    include: {
      subscriptions: { where: { status: "ACTIVE" }, take: 1 },
      audits: {
        where: { triggeredBy: "WEBHOOK_THEME_PUBLISH" },
        orderBy: { completedAt: "desc" },
        take: 1,
      },
    },
  });

  const auditPlusActive = store ? await hasAuditPlus(store.id) : false;

  return json({
    shopDomain: session.shop,
    auditPlusActive,
    justSubscribed,
    subscription: store?.subscriptions[0] ?? null,
    lastThemeAudit: store?.audits[0] ?? null,
  });
};

export default function Settings() {
  const { shopDomain, auditPlusActive, justSubscribed, lastThemeAudit } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <AppPage title="Settings" shopDomain={shopDomain}>
      <BlockStack gap="500">
        <AppBrandHeader
          title="Settings"
          subtitle="Subscription status and automated monitoring"
        />

        {justSubscribed && auditPlusActive && (
          <Banner
            tone="success"
            title="Audit Plus is now active"
            onDismiss={() => navigate(shopifyAppPath("/app/settings", shopDomain))}
          >
            Open the Audit Plus hub to use Fix Center and see everything included in
            your subscription.
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <Text as="p" variant="bodyMd">
                Fix Center, monitoring, and subscription status live in the Audit Plus hub.
              </Text>
              <Button
                variant="primary"
                onClick={() => navigate(shopifyAppPath("/app/audit-plus", shopDomain))}
              >
                Open Audit Plus
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Audit Plus
              </Text>
              <Badge tone={auditPlusActive ? "success" : undefined}>
                {auditPlusActive ? "Active" : "Not subscribed"}
              </Badge>
            </InlineStack>

            {auditPlusActive ? (
              <>
                <Text as="p" variant="bodyMd">
                  Your subscription includes the tools below. Use the Audit Plus hub to
                  open Fix Center and track monitoring.
                </Text>
                <List type="bullet">
                  <List.Item>
                    <strong>Fix Center</strong> — alt text, images, homepage & product SEO,
                    descriptions, SKUs, inventory tracking, and trust pages.
                  </List.Item>
                  <List.Item>
                    <strong>All reports unlocked</strong> — every audit is fully
                    unlocked with PDF export (no $19 per report).
                  </List.Item>
                  <List.Item>
                    <strong>Theme change alerts</strong> — when you publish a theme
                    update, Launch Doctor queues a fresh audit automatically.
                    {lastThemeAudit?.completedAt
                      ? ` Last theme-triggered scan: ${new Date(lastThemeAudit.completedAt).toLocaleString()}.`
                      : " No theme-triggered scan yet."}
                  </List.Item>
                  <List.Item>
                    <InlineStack gap="200" blockAlign="center">
                      <span>
                        <strong>Weekly auto-rescans</strong> — full store scan on a
                        recurring schedule
                      </span>
                      <Badge tone="attention">Coming soon</Badge>
                    </InlineStack>
                  </List.Item>
                </List>
                <Button onClick={() => navigate(shopifyAppPath("/app/audit-plus", shopDomain))}>
                  Go to Audit Plus hub
                </Button>
              </>
            ) : (
              <>
                <Text as="p" variant="bodyMd">
                  Audit Plus is an optional subscription for stores that want ongoing
                  monitoring instead of paying $19 per report.
                </Text>
                <List type="bullet">
                  <List.Item>Fix Center — 8 automated fix packs for catalog, SEO, and trust pages</List.Item>
                  <List.Item>Unlock every audit report automatically</List.Item>
                  <List.Item>Re-scan when you publish theme changes</List.Item>
                  <List.Item>Weekly scheduled rescans</List.Item>
                </List>
                <Button
                  variant="primary"
                  onClick={() => navigate(shopifyAppPath("/app/billing", shopDomain))}
                >
                  View plans
                </Button>
              </>
            )}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              One-time report unlocks
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Paid $19 unlocks apply to a single audit report. Audit Plus includes
              the same full report access on every scan.
            </Text>
            <Button
              variant="plain"
              onClick={() => navigate(shopifyAppPath("/app/billing", shopDomain))}
            >
              Manage billing
            </Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </AppPage>
  );
}
