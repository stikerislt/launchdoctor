import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  List,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { hasAuditPlus } from "../lib/billing.server";
import { resolveScoresFromFindings } from "../lib/audit-access.server";
import { buildFixPreviews } from "../lib/fixes/preview.server";
import {
  getDismissedFixIds,
  getDismissedRuleCodes,
} from "../lib/fixes/dismissals.server";
import { AppPage } from "../components/AppPage";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { shopifyAppPath } from "../lib/app-routes";
import type { FixId } from "../lib/fixes/types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const justSubscribed = url.searchParams.get("subscribed") === "true";

  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
    include: {
      audits: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 1,
        include: { findings: { select: { ruleCode: true, severity: true } } },
      },
    },
  });

  const latestAuditRaw = store?.audits[0] ?? null;

  // These reads are independent of each other — run them in parallel so the
  // page transition isn't blocked on a chain of remote-DB round-trips.
  const [auditPlusActive, dismissedFixIds, dismissedRuleCodes, lastThemeAudit, runningAudit] =
    store
      ? await Promise.all([
          hasAuditPlus(store.id),
          getDismissedFixIds(store.id),
          getDismissedRuleCodes(store.id),
          prisma.audit.findFirst({
            where: { storeId: store.id, triggeredBy: "WEBHOOK_THEME_PUBLISH" },
            orderBy: { completedAt: "desc" },
          }),
          prisma.audit.findFirst({
            where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
          }),
        ])
      : ([false, new Set<FixId>(), new Set<string>(), null, null] as [
          boolean,
          Set<FixId>,
          Set<string>,
          Awaited<ReturnType<typeof prisma.audit.findFirst>>,
          Awaited<ReturnType<typeof prisma.audit.findFirst>>,
        ]);

  const fixCount =
    latestAuditRaw && auditPlusActive
      ? buildFixPreviews(latestAuditRaw.snapshot, dismissedFixIds).length
      : 0;

  const latestScores = latestAuditRaw
    ? resolveScoresFromFindings(
        latestAuditRaw.findings,
        latestAuditRaw.launchScore,
        dismissedRuleCodes,
      )
    : null;

  return json({
    shopDomain: session.shop,
    auditPlusActive,
    justSubscribed,
    latestAudit: latestAuditRaw
      ? {
          id: latestAuditRaw.id,
          launchScore: latestScores?.launchScore ?? latestAuditRaw.launchScore,
          seoScore: latestScores?.seoScore ?? null,
          completedAt: latestAuditRaw.completedAt,
        }
      : null,
    fixCount,
    lastThemeAudit: lastThemeAudit
      ? { completedAt: lastThemeAudit.completedAt }
      : null,
    runningAudit: runningAudit ? { id: runningAudit.id } : null,
  });
};

export default function AuditPlusHub() {
  const {
    shopDomain,
    auditPlusActive,
    justSubscribed,
    latestAudit,
    fixCount,
    lastThemeAudit,
    runningAudit,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const fixesPath = latestAudit
    ? shopifyAppPath(`/app/fixes/${latestAudit.id}`, shopDomain)
    : null;
  const reportPath = latestAudit
    ? shopifyAppPath(`/app/audit/${latestAudit.id}`, shopDomain)
    : null;
  const billingPath = shopifyAppPath("/app/billing", shopDomain);
  const settingsPath = shopifyAppPath("/app/settings", shopDomain);

  return (
    <AppPage title="Audit Plus" shopDomain={shopDomain}>
      <BlockStack gap="500">
        <AppBrandHeader
          title="Audit Plus"
          subtitle="Your hub for one-click fixes, unlocked reports, and automated monitoring"
        />

        {justSubscribed && auditPlusActive && (
          <Banner
            tone="success"
            title="Welcome to Audit Plus"
            onDismiss={() => navigate(shopifyAppPath("/app/audit-plus", shopDomain))}
          >
            Start with Fix Center below to apply quick fixes from your latest audit.
          </Banner>
        )}

        <div className="ld-audit-plus-status">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Subscription
              </Text>
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  {auditPlusActive ? "Audit Plus is active" : "Audit Plus is not active"}
                </Text>
                <Badge tone={auditPlusActive ? "success" : undefined}>
                  {auditPlusActive ? "Active" : "Not subscribed"}
                </Badge>
              </InlineStack>
            </BlockStack>
            {!auditPlusActive && (
              <Button variant="primary" onClick={() => navigate(billingPath)}>
                Subscribe — $9/month
              </Button>
            )}
          </InlineStack>
        </div>

        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Tools
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {auditPlusActive
              ? "Use these tools after each audit to improve your store faster."
              : "Subscribe to unlock Fix Center and automatic report access."}
          </Text>

          <div className="ld-tool-grid">
            <div className={`ld-tool-card ${auditPlusActive ? "ld-tool-card--primary" : ""}`}>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="start">
                  <Text as="h3" variant="headingSm">
                    Store Monitor
                  </Text>
                  <Badge>New</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Your store&apos;s health over time — Launch Score trend, catalog guardrails,
                  PageSpeed mobile score, and broken links, with alerts when something changes.
                  Re-scans run automatically every week.
                </Text>
                {auditPlusActive ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate(shopifyAppPath("/app/monitor", shopDomain))}
                  >
                    Open Store Monitor
                  </Button>
                ) : (
                  <Button onClick={() => navigate(billingPath)}>Unlock with Audit Plus</Button>
                )}
              </BlockStack>
            </div>

            <div
              className={`ld-tool-card ${auditPlusActive && fixesPath ? "ld-tool-card--primary" : ""}`}
            >
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="start">
                  <Text as="h3" variant="headingSm">
                    Fix Center
                  </Text>
                  {auditPlusActive && fixCount > 0 && (
                    <Badge tone="success">{`${fixCount} fix${fixCount === 1 ? "" : "es"} ready`}</Badge>
                  )}
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Apply one-click fixes for missing alt text, oversized images, homepage SEO,
                  product SEO, thin descriptions, SKUs, inventory tracking, and trust pages
                  from your latest completed audit.
                </Text>
                {!auditPlusActive ? (
                  <Button onClick={() => navigate(billingPath)}>Unlock with Audit Plus</Button>
                ) : !latestAudit ? (
                  <Button onClick={() => navigate(shopifyAppPath("/app", shopDomain))}>
                    Run an audit first
                  </Button>
                ) : runningAudit ? (
                  <Button
                    onClick={() =>
                      navigate(shopifyAppPath(`/app/audit/${runningAudit.id}`, shopDomain))
                    }
                  >
                    Audit in progress…
                  </Button>
                ) : fixCount > 0 ? (
                  <Button variant="primary" onClick={() => navigate(fixesPath!)}>
                    Open Fix Center
                  </Button>
                ) : (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      No automatic fixes detected on your latest audit.
                    </Text>
                    <InlineStack gap="200">
                      <Button onClick={() => navigate(fixesPath!)}>Review Fix Center</Button>
                      {reportPath && (
                        <Button variant="plain" onClick={() => navigate(reportPath)}>
                          View report
                        </Button>
                      )}
                    </InlineStack>
                  </BlockStack>
                )}
              </BlockStack>
            </div>

            <div className="ld-tool-card">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="start">
                  <Text as="h3" variant="headingSm">
                    Mobile PageSpeed
                  </Text>
                  <Badge>New</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Run Google PageSpeed Insights on your live storefront — real mobile Lighthouse
                  performance scores, shown in Store Monitor and updated whenever you re-scan.
                </Text>
                {auditPlusActive ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate(shopifyAppPath("/app/pagespeed", shopDomain))}
                  >
                    Open Mobile PageSpeed
                  </Button>
                ) : (
                  <Button onClick={() => navigate(billingPath)}>Unlock with Audit Plus</Button>
                )}
              </BlockStack>
            </div>

            <div className="ld-tool-card">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="start">
                  <Text as="h3" variant="headingSm">
                    Image Optimizer
                  </Text>
                  <Badge>New</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Resize oversized product images (max 2048px wide) and convert them to
                  WebP in one batch. See exactly how many KB you saved per image.
                </Text>
                {auditPlusActive && latestAudit ? (
                  <Button
                    variant="primary"
                    onClick={() =>
                      navigate(shopifyAppPath("/app/image-optimizer", shopDomain))
                    }
                  >
                    Open Image Optimizer
                  </Button>
                ) : auditPlusActive ? (
                  <Button onClick={() => navigate(shopifyAppPath("/app", shopDomain))}>
                    Run an audit first
                  </Button>
                ) : (
                  <Button onClick={() => navigate(billingPath)}>Unlock with Audit Plus</Button>
                )}
              </BlockStack>
            </div>

            <div className="ld-tool-card">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="start">
                  <Text as="h3" variant="headingSm">
                    Broken Link Finder
                  </Text>
                  <Badge>New</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Scan your products, pages, blog posts, and homepage for dead links and broken
                  images, with step-by-step instructions on where and how to fix each one.
                </Text>
                {auditPlusActive ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate(shopifyAppPath("/app/links", shopDomain))}
                  >
                    Open Broken Link Finder
                  </Button>
                ) : (
                  <Button onClick={() => navigate(billingPath)}>Unlock with Audit Plus</Button>
                )}
              </BlockStack>
            </div>

            <div className="ld-tool-card">
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Latest audit report
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {auditPlusActive
                    ? "Every report is fully unlocked with PDF export — no $19 per scan."
                    : "Full reports require a one-time unlock or Audit Plus."}
                </Text>
                {latestAudit && reportPath ? (
                  <BlockStack gap="200">
                    {latestAudit.launchScore != null && (
                      <Text as="p" variant="bodySm">
                        Launch score: <strong>{latestAudit.launchScore}</strong>
                        {latestAudit.completedAt
                          ? ` · ${new Date(latestAudit.completedAt).toLocaleDateString()}`
                          : ""}
                      </Text>
                    )}
                    <Button onClick={() => navigate(reportPath)}>Open latest report</Button>
                  </BlockStack>
                ) : (
                  <Button onClick={() => navigate(shopifyAppPath("/app", shopDomain))}>
                    Run your first audit
                  </Button>
                )}
              </BlockStack>
            </div>

            <div className="ld-tool-card">
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Audit history
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Compare past scans and open Fix Center for any completed audit from History.
                </Text>
                <Button
                  variant="plain"
                  onClick={() => navigate(shopifyAppPath("/app/history", shopDomain))}
                >
                  View history
                </Button>
              </BlockStack>
            </div>
          </div>
        </BlockStack>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Automated monitoring
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              {auditPlusActive
                ? "These run in the background — no setup required."
                : "Included with Audit Plus after you subscribe."}
            </Text>
            <List type="bullet">
              <List.Item>
                <strong>Theme publish rescans</strong> — queues a fresh audit when you publish
                a theme update.
                {auditPlusActive &&
                  (lastThemeAudit?.completedAt
                    ? ` Last run: ${new Date(lastThemeAudit.completedAt).toLocaleString()}.`
                    : " No theme-triggered scan yet.")}
              </List.Item>
              <List.Item>
                <strong>Weekly auto-rescans</strong> — Store Monitor runs a full-store scan
                every week and flags anything that changed since the last one.
              </List.Item>
            </List>
          </BlockStack>
        </Card>

        <InlineStack gap="200">
          <Button variant="plain" onClick={() => navigate(settingsPath)}>
            Subscription details
          </Button>
          {!auditPlusActive && (
            <Button variant="plain" onClick={() => navigate(billingPath)}>
              Compare plans
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    </AppPage>
  );
}
