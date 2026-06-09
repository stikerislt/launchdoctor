import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useNavigation, Form } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  Divider,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { hasAuditPlus } from "../lib/billing.server";
import { resolveScoresFromFindings } from "../lib/audit-access.server";
import { getDismissedRuleCodes } from "../lib/fixes/dismissals.server";
import { enqueueAudit } from "../lib/queue.server";
import { checkPromotionAuditLimit } from "../lib/promotion-limits.server";
import { shopifyAppPath } from "../lib/app-routes";
import {
  catalogMetricRows,
  computeHealthAlerts,
  extractHealth,
  type AlertTone,
  type HealthSnapshot,
} from "../lib/monitor/health";
import { resolveMonitorPerformance } from "../lib/monitor/performance";
import { AppPage } from "../components/AppPage";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { PROMOTION_LIMIT_MESSAGE } from "../lib/promotion-limits";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const limitReached = new URL(request.url).searchParams.get("limitReached") === "1";
  const store = await prisma.store.findUnique({ where: { shopDomain } });

  if (!store) {
    return json({
      shopDomain,
      auditPlusActive: false,
      snapshots: [] as HealthSnapshot[],
      linkScan: null,
      pageSpeed: null,
      running: false,
      limitReached,
    });
  }

  const [auditPlusActive, audits, dismissedRuleCodes, linkScan, pageSpeedScan, running] =
    await Promise.all([
    hasAuditPlus(store.id),
    prisma.audit.findMany({
      where: { storeId: store.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 12,
      select: {
        id: true,
        completedAt: true,
        launchScore: true,
        snapshot: true,
        findings: { select: { ruleCode: true, severity: true } },
      },
    }),
    getDismissedRuleCodes(store.id),
    prisma.linkScan.findFirst({
      where: { storeId: store.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { id: true, completedAt: true, brokenCount: true, linksChecked: true },
    }),
    prisma.pageSpeedScan.findFirst({
      where: { storeId: store.id, status: "COMPLETED", score: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { score: true, measuredUrl: true, completedAt: true },
    }),
    prisma.audit.findFirst({
      where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
      select: { id: true },
    }),
  ]);

  const snapshots: HealthSnapshot[] = audits.map((audit) => {
    const scores = resolveScoresFromFindings(
      audit.findings,
      audit.launchScore,
      dismissedRuleCodes,
    );
    return extractHealth({
      id: audit.id,
      completedAt: audit.completedAt,
      launchScore: scores.launchScore ?? audit.launchScore,
      seoScore: scores.seoScore,
      snapshot: audit.snapshot,
      findings: audit.findings,
    });
  });

  return json({
    shopDomain,
    auditPlusActive,
    snapshots,
    linkScan,
    pageSpeed: pageSpeedScan
      ? {
          score: pageSpeedScan.score,
          measuredUrl: pageSpeedScan.measuredUrl,
          completedAt: pageSpeedScan.completedAt,
        }
      : null,
    running: Boolean(running),
    limitReached,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.upsert({
    where: { shopDomain: session.shop },
    create: { shopDomain: session.shop },
    update: {},
  });

  if (!(await hasAuditPlus(store.id))) {
    return json({ error: "Audit Plus is required." }, { status: 403 });
  }

  const running = await prisma.audit.findFirst({
    where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (running) {
    return redirect(shopifyAppPath(`/app/audit/${running.id}`, session.shop));
  }

  const limit = await checkPromotionAuditLimit(store.id, session.shop, session.email);
  if (!limit.allowed) {
    return redirect(shopifyAppPath("/app/monitor?limitReached=1", session.shop));
  }

  const audit = await prisma.audit.create({
    data: { storeId: store.id, status: "PENDING", triggeredBy: "MANUAL" },
  });
  await enqueueAudit(audit.id, store.id);
  return redirect(shopifyAppPath(`/app/audit/${audit.id}`, session.shop));
};

const ALERT_TONE_MAP: Record<AlertTone, "critical" | "warning" | "success" | "info"> = {
  critical: "critical",
  warning: "warning",
  success: "success",
  info: "info",
};

export default function StoreMonitor() {
  const { shopDomain, auditPlusActive, snapshots, linkScan, pageSpeed, running, limitReached } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const pagespeedPath = shopifyAppPath("/app/pagespeed", shopDomain);

  if (!auditPlusActive) {
    return (
      <AppPage
        title="Store Monitor"
        shopDomain={shopDomain}
        backTo="/app/audit-plus"
        backLabel="Tools"
      >
        <BlockStack gap="500">
          <AppBrandHeader
            title="Store Monitor"
            subtitle="Ongoing health tracking, trends, and change alerts"
          />
          <Banner tone="warning" title="Audit Plus required">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                Store Monitor watches your store week to week — tracking your Launch Score,
                catalog health, performance, and broken links, and alerting you when something
                changes.
              </Text>
              <Button
                variant="primary"
                onClick={() => navigate(shopifyAppPath("/app/billing", shopDomain))}
              >
                Subscribe — $9/month
              </Button>
            </BlockStack>
          </Banner>
        </BlockStack>
      </AppPage>
    );
  }

  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;
  const perf = resolveMonitorPerformance(latest, pageSpeed);
  const latestForAlerts =
    latest != null
      ? {
          ...latest,
          performance: perf.score,
          performanceSource: perf.source,
        }
      : null;
  const alerts = latestForAlerts ? computeHealthAlerts(latestForAlerts, previous) : [];

  const trendRows = snapshots.map((s) => [
    s.capturedAt ? new Date(s.capturedAt).toLocaleDateString() : "—",
    s.launchScore?.toString() ?? "—",
    s.criticalCount.toString(),
    s.performance != null ? s.performance.toString() : "—",
  ]);

  return (
    <AppPage
      title="Store Monitor"
      shopDomain={shopDomain}
      backTo="/app/audit-plus"
      backLabel="Tools"
    >
      <BlockStack gap="500">
        <AppBrandHeader
          title="Store Monitor"
          subtitle="Ongoing health tracking, trends, and change alerts"
        />

        {limitReached && (
          <Banner tone="warning" title="Weekly audit limit reached">
            {PROMOTION_LIMIT_MESSAGE}
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  {latest ? "We're watching your store" : "Monitoring is on"}
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {latest?.capturedAt
                    ? `Last checked ${new Date(latest.capturedAt).toLocaleString()}. Automatic weekly re-scans keep this current.`
                    : "Run your first scan to start tracking your store's health over time. Weekly re-scans run automatically."}
                </Text>
              </BlockStack>
              <Form method="post">
                <Button submit variant="primary" loading={isSubmitting} disabled={running}>
                  {running ? "Scan in progress…" : "Run full check now"}
                </Button>
              </Form>
            </InlineStack>
          </BlockStack>
        </Card>

        {!latest && (
          <Card>
            <Text as="p" variant="bodyMd">
              No completed audits yet. Run a full check to record your baseline.
            </Text>
          </Card>
        )}

        {latest && (
          <>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                What changed
              </Text>
              {alerts.map((alert) => (
                <Banner key={alert.id} tone={ALERT_TONE_MAP[alert.tone]} title={alert.title}>
                  <Text as="p" variant="bodyMd">
                    {alert.detail}
                  </Text>
                </Banner>
              ))}
            </BlockStack>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Current health
                </Text>
                <InlineStack gap="400" wrap>
                  <HealthStat label="Launch score" value={latest.launchScore?.toString() ?? "—"} />
                  <HealthStat label="Critical issues" value={latest.criticalCount.toString()} attention={latest.criticalCount > 0} />
                  <HealthStat label="High issues" value={latest.highCount.toString()} attention={latest.highCount > 0} />
                  <HealthStat
                    label="Mobile performance"
                    value={perf.score != null ? `${perf.score}` : "—"}
                    helpText={
                      perf.score != null && perf.source === "pagespeed"
                        ? perf.measuredAt
                          ? `PageSpeed (mobile) · ${new Date(perf.measuredAt).toLocaleDateString()}`
                          : "Google PageSpeed Insights (mobile)"
                        : "Run a PageSpeed scan in Audit Plus Tools"
                    }
                    attention={perf.score != null && perf.score < 50}
                  />
                  <HealthStat label="Products" value={latest.productCount.toString()} />
                  <HealthStat
                    label="Broken links"
                    value={linkScan ? linkScan.brokenCount.toString() : "Not scanned"}
                    attention={Boolean(linkScan && linkScan.brokenCount > 0)}
                  />
                </InlineStack>

                {perf.score == null && (
                  <Banner tone="info">
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd">
                        Mobile performance uses the dedicated PageSpeed tool — run a scan to
                        see your Google Lighthouse score here.
                      </Text>
                      <Button onClick={() => navigate(pagespeedPath)}>Run PageSpeed scan</Button>
                    </BlockStack>
                  </Banner>
                )}

                <Divider />

                <Text as="h3" variant="headingSm">
                  Catalog guardrails
                </Text>
                <BlockStack gap="150">
                  {catalogMetricRows(latest).map((row) => (
                    <InlineStack key={row.label} align="space-between" blockAlign="center">
                      <Text as="span" variant="bodyMd">
                        {row.label}
                      </Text>
                      <Badge tone={row.attention ? "attention" : undefined}>{row.value}</Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="h2" variant="headingMd">
                    Mobile PageSpeed
                  </Text>
                  <Button onClick={() => navigate(pagespeedPath)}>Open PageSpeed tool</Button>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {pageSpeed?.score != null
                    ? `Latest mobile score: ${pageSpeed.score}/100${
                        pageSpeed.measuredUrl ? ` · ${pageSpeed.measuredUrl}` : ""
                      }${
                        pageSpeed.completedAt
                          ? ` · ${new Date(pageSpeed.completedAt).toLocaleDateString()}`
                          : ""
                      }.`
                    : "No PageSpeed scan yet. Run one to measure your storefront with Google Lighthouse."}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="h2" variant="headingMd">
                    Broken Link Finder
                  </Text>
                  <Button onClick={() => navigate(shopifyAppPath("/app/links", shopDomain))}>
                    Open Broken Link Finder
                  </Button>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {linkScan
                    ? `Last scan checked ${linkScan.linksChecked} links and found ${linkScan.brokenCount} broken${
                        linkScan.completedAt
                          ? ` · ${new Date(linkScan.completedAt).toLocaleDateString()}`
                          : ""
                      }.`
                    : "No link scan yet. Run one to catch dead links and broken images."}
                </Text>
              </BlockStack>
            </Card>

            {snapshots.length > 1 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Score trend
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric", "numeric"]}
                    headings={["Date", "Launch score", "Critical", "Performance"]}
                    rows={trendRows}
                  />
                </BlockStack>
              </Card>
            )}
          </>
        )}
      </BlockStack>
    </AppPage>
  );
}

function HealthStat({
  label,
  value,
  helpText,
  attention = false,
}: {
  label: string;
  value: string;
  helpText?: string;
  attention?: boolean;
}) {
  return (
    <BlockStack gap="050">
      <Text as="span" variant="bodySm" tone="subdued">
        {label}
      </Text>
      <Text as="span" variant="headingLg" tone={attention ? "critical" : undefined}>
        {value}
      </Text>
      {helpText && (
        <Text as="span" variant="bodySm" tone="subdued">
          {helpText}
        </Text>
      )}
    </BlockStack>
  );
}
