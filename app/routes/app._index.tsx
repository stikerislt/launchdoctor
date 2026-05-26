import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Banner,
  Badge,
  Card,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate, getShopHandle } from "../shopify.server";
import prisma from "../db.server";
import { enqueueAudit } from "../lib/queue.server";
import { PerfectScoreCelebration } from "../components/PerfectScoreCelebration";
import { ScoreGauge } from "../components/ScoreGauge";
import { isPerfectLaunchScore } from "../lib/launch-score";
import { SeverityBadge } from "../components/SeverityBadge";
import { hasAuditPlus } from "../lib/billing.server";
import { resolveScoresFromFindings } from "../lib/audit-access.server";
import { PREVIEW_FINDING_COUNT } from "../lib/audit-access.server";
import { buildFixPreviews } from "../lib/fixes/preview.server";
import {
  filterFindingsByDismissals,
  getDismissedFixIds,
  getDismissedRuleCodes,
} from "../lib/fixes/dismissals.server";
import {
  isSeoRuleCode,
  pickPreviewFindingIds,
  pillarSeveritySummaries,
} from "../lib/finding-summary";
import { getScanScopeFromSnapshot } from "../lib/scan-scope";
import { DashboardNavCards } from "../components/DashboardNavCards";
import { PillarIssueSummary } from "../components/PillarIssueSummary";
import { shopifyAppPath } from "../lib/app-routes";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  let store = await prisma.store.findUnique({
    where: { shopDomain },
    include: {
      audits: {
        orderBy: { completedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          launchScore: true,
          isUnlocked: true,
          completedAt: true,
          snapshot: true,
          findings: {
            select: { id: true, severity: true, ruleCode: true, title: true },
          },
        },
      },
    },
  });

  if (!store) {
    store = await prisma.store.create({
      data: { shopDomain },
      include: {
        audits: {
          orderBy: { completedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            launchScore: true,
            isUnlocked: true,
            completedAt: true,
            snapshot: true,
            findings: {
              select: { id: true, severity: true, ruleCode: true, title: true },
            },
          },
        },
      },
    });
  }

  const latestAuditRaw = store.audits[0] ?? null;
  const dismissedFixIds = await getDismissedFixIds(store.id);
  const dismissedRuleCodes = await getDismissedRuleCodes(store.id);
  const scores = latestAuditRaw
    ? resolveScoresFromFindings(
        latestAuditRaw.findings,
        latestAuditRaw.launchScore,
        dismissedRuleCodes,
      )
    : null;

  const latestAudit = latestAuditRaw
    ? {
        id: latestAuditRaw.id,
        status: latestAuditRaw.status,
        isUnlocked: latestAuditRaw.isUnlocked,
        completedAt: latestAuditRaw.completedAt,
        launchScore: scores?.launchScore ?? latestAuditRaw.launchScore,
        coreScore: scores?.coreScore ?? null,
        seoScore: scores?.seoScore ?? null,
        findings: latestAuditRaw.findings,
        snapshot: latestAuditRaw.snapshot,
      }
    : null;

  const runningAudit = await prisma.audit.findFirst({
    where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
  });

  const auditPlusActive = await hasAuditPlus(store.id);
  const latestCompleted = latestAudit?.status === "COMPLETED" ? latestAudit : null;
  const activeFindings = latestCompleted
    ? filterFindingsByDismissals(latestCompleted.findings, dismissedRuleCodes)
    : [];
  const fixCount =
    latestCompleted && auditPlusActive
      ? buildFixPreviews(latestCompleted.snapshot, dismissedFixIds).length
      : 0;

  const pillars = latestCompleted ? pillarSeveritySummaries(activeFindings) : null;

  const previewFindingIds = latestCompleted
    ? new Set(pickPreviewFindingIds(activeFindings, PREVIEW_FINDING_COUNT))
    : new Set<string>();

  const previewFindings = latestCompleted
    ? activeFindings.filter((f) => previewFindingIds.has(f.id))
    : [];

  const reportFullyUnlocked =
    Boolean(latestCompleted?.isUnlocked) || auditPlusActive;
  const scanScope = latestCompleted
    ? getScanScopeFromSnapshot(latestCompleted.snapshot)
    : null;

  return json({
    shopHandle: getShopHandle(shopDomain),
    shopDomain,
    latestAudit: latestCompleted,
    runningAudit,
    hasAudits: store.audits.length > 0,
    auditPlusActive,
    fixCount,
    pillars,
    previewFindings,
    previewFindingCount: PREVIEW_FINDING_COUNT,
    reportFullyUnlocked,
    lockedFindingCount: latestCompleted
      ? Math.max(0, activeFindings.length - PREVIEW_FINDING_COUNT)
      : 0,
    scanScope,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.upsert({
    where: { shopDomain: session.shop },
    create: { shopDomain: session.shop },
    update: {},
  });

  const audit = await prisma.audit.create({
    data: { storeId: store.id, status: "PENDING", triggeredBy: "MANUAL" },
  });

  await enqueueAudit(audit.id);
  return redirect(shopifyAppPath(`/app/audit/${audit.id}`, session.shop));
};

export default function Dashboard() {
  const {
    latestAudit,
    runningAudit,
    hasAudits,
    shopDomain,
    auditPlusActive,
    fixCount,
    pillars,
    previewFindings,
    previewFindingCount,
    reportFullyUnlocked,
    lockedFindingCount,
    scanScope,
  } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isRunning = navigation.state === "submitting" || !!runningAudit;

  const reportPath = latestAudit
    ? shopifyAppPath(`/app/audit/${latestAudit.id}`, shopDomain)
    : null;
  const fixesPath = latestAudit
    ? shopifyAppPath(`/app/fixes/${latestAudit.id}`, shopDomain)
    : null;
  const billingPath = latestAudit
    ? shopifyAppPath(`/app/billing?auditId=${latestAudit.id}`, shopDomain)
    : shopifyAppPath("/app/billing", shopDomain);

  const navCards = [
    {
      title: "Latest audit report",
      description: reportFullyUnlocked
        ? "Full findings, category filters, and PDF export."
        : `See all ${pillars?.totalCount ?? 0} issues — ${previewFindingCount} unlocked free.`,
      actionLabel: "Open report",
      onAction: () => reportPath && navigate(reportPath),
      primary: true,
      badge: latestAudit ? "Start here" : undefined,
    },
    {
      title: "Fix Center",
      description: auditPlusActive
        ? fixCount > 0
          ? `${fixCount} one-click fix pack${fixCount === 1 ? "" : "s"} ready.`
          : "SEO, catalog, images, inventory, and trust page fixes."
        : "Audit Plus subscribers can apply SEO and catalog fixes in one click.",
      actionLabel: auditPlusActive ? "Open Fix Center" : "Get Audit Plus",
      onAction: () =>
        auditPlusActive && fixesPath
          ? navigate(fixesPath)
          : navigate(shopifyAppPath("/app/audit-plus", shopDomain)),
      badge: auditPlusActive ? "Subscriber" : "Fixes locked",
    },
    {
      title: "Audit Plus hub",
      description: "Monitoring, theme-change rescans, and subscription tools.",
      actionLabel: "Open hub",
      onAction: () => navigate(shopifyAppPath("/app/audit-plus", shopDomain)),
    },
    {
      title: "Audit history",
      description: "Compare past runs and track score changes over time.",
      actionLabel: "View history",
      onAction: () => navigate(shopifyAppPath("/app/history", shopDomain)),
    },
  ];

  return (
    <Page>
      <TitleBar title="Launch Doctor" />
      <BlockStack gap="500">
        {!hasAudits ? (
          <div className="ld-hero-card">
            <div className="ld-hero-content">
              <img
                className="ld-hero-logo"
                src="/launch-doctor-icon.png"
                alt="Launch Doctor"
                width={80}
                height={80}
              />
              <div>
                <h1 className="ld-hero-title">
                  Find the things that will cost you money before they do
                </h1>
                <p className="ld-hero-subtitle">
                  Full-store scan across your catalog, sitemap URLs, payments, shipping,
                  trust signals, and SEO — 50 automated checks.
                </p>
                <ul className="ld-feature-list">
                  <li>Scans all active products (up to 10,000) and your sitemap</li>
                  <li>Free dashboard shows every issue count by severity</li>
                  <li>{previewFindingCount} detailed findings unlocked free</li>
                  <li>Audit Plus fixes SEO & catalog issues in one click</li>
                </ul>
                <div style={{ marginTop: 24 }}>
                  <Button
                    variant="primary"
                    size="large"
                    loading={isRunning}
                    onClick={() => submit({}, { method: "post" })}
                  >
                    Run my first audit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Layout>
            <Layout.Section>
              <div className="ld-summary-card">
                <div className="ld-dashboard-top">
                  <div className="ld-dashboard-top-main">
                    <div className="ld-dashboard-brand">
                      <img
                        src="/launch-doctor-icon.png"
                        alt=""
                        width={40}
                        height={40}
                      />
                      <div className="ld-dashboard-brand-text">
                        <h1>Launch Doctor</h1>
                        <p>Your store health at a glance</p>
                      </div>
                    </div>

                    <div className="ld-dashboard-top-body">
                      {runningAudit && (
                        <Banner tone="info">
                          Audit in progress… We scan your full catalog and sitemap — usually
                          1–2 minutes.
                        </Banner>
                      )}

                      {scanScope && (
                        <p className="ld-scan-scope">
                          Last scan: <strong>{scanScope.productCount}</strong> active products ·{" "}
                          <strong>{scanScope.sitemapUrls}</strong> sitemap URLs (
                          {scanScope.sitemapProducts} products,{" "}
                          {scanScope.sitemapCollections} collections, {scanScope.sitemapPages}{" "}
                          pages)
                        </p>
                      )}

                      <div className="ld-dashboard-actions">
                        <Button
                          variant="primary"
                          loading={isRunning}
                          onClick={() => submit({}, { method: "post" })}
                        >
                          Re-run full audit
                        </Button>
                        {reportPath && (
                          <Button onClick={() => navigate(reportPath)}>Open full report</Button>
                        )}
                        {fixesPath && auditPlusActive && (
                          <Button onClick={() => navigate(fixesPath)}>Fix Center</Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {latestAudit?.launchScore != null && (
                    <div className="ld-dashboard-top-score">
                      <ScoreGauge score={latestAudit.launchScore} />
                      {latestAudit.coreScore != null && latestAudit.seoScore != null && (
                        <p className="ld-dashboard-score-caption">
                          Core {latestAudit.coreScore} · SEO {latestAudit.seoScore}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {isPerfectLaunchScore(latestAudit?.launchScore) && (
                  <div style={{ marginTop: 16 }}>
                    <PerfectScoreCelebration />
                  </div>
                )}

                {pillars && (
                  <div className="ld-pillar-grid">
                    <PillarIssueSummary
                      title="Store readiness"
                      subtitle="Payments, shipping, catalog quality, trust, checkout, and theme"
                      counts={pillars.core}
                      issueCount={pillars.coreCount}
                    />
                    <PillarIssueSummary
                      variant="seo"
                      title="SEO & discoverability"
                      subtitle="Homepage SEO, sitemap, images, alt text, and product search metadata"
                      counts={pillars.seo}
                      issueCount={pillars.seoCount}
                      lockedHint={
                        auditPlusActive
                          ? undefined
                          : "Counts are visible on every plan. One-click SEO fixes require Audit Plus."
                      }
                    />
                  </div>
                )}
              </div>
            </Layout.Section>

            <Layout.Section>
              <Text as="h2" variant="headingMd">
                Where to go next
              </Text>
              <div style={{ marginTop: 12 }}>
                <DashboardNavCards cards={navCards} />
              </div>
            </Layout.Section>

            {latestAudit && previewFindings.length > 0 && (
              <Layout.Section>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center" wrap>
                      <BlockStack gap="100">
                        <Text as="h2" variant="headingMd">
                          Top issues with full detail (free preview)
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          {reportFullyUnlocked
                            ? "Your report is fully unlocked."
                            : `${previewFindingCount} of ${pillars?.totalCount ?? latestAudit.findings.length} findings include fix steps on the free plan.`}
                        </Text>
                      </BlockStack>
                      {!reportFullyUnlocked && lockedFindingCount > 0 && (
                        <Button onClick={() => navigate(billingPath)}>Unlock full report</Button>
                      )}
                    </InlineStack>

                    <div className="ld-preview-findings">
                      {previewFindings.map((finding) => (
                        <div key={finding.id} className="ld-preview-finding-row">
                          <div>
                            <div className="ld-preview-finding-title">{finding.title}</div>
                            <span
                              className={`ld-preview-finding-pillar ${isSeoRuleCode(finding.ruleCode) ? "ld-preview-finding-pillar--seo" : ""}`}
                            >
                              {isSeoRuleCode(finding.ruleCode) ? "SEO" : "Core"}
                            </span>
                          </div>
                          <SeverityBadge
                            severity={
                              finding.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
                            }
                          />
                        </div>
                      ))}
                    </div>

                    {reportPath && (
                      <Button onClick={() => navigate(reportPath)}>
                        View full audit report
                      </Button>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            )}

            <Layout.Section>
              <div
                className={`ld-dashboard-plus-card ${auditPlusActive ? "ld-dashboard-plus-card--active" : ""}`}
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Audit Plus
                        </Text>
                        <Badge tone={auditPlusActive ? "success" : undefined}>
                          {auditPlusActive ? "Active" : "Subscriber tools"}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {auditPlusActive
                          ? fixCount > 0
                            ? `${fixCount} fix pack${fixCount === 1 ? "" : "s"} ready — apply SEO and catalog fixes without leaving Launch Doctor.`
                            : "Fix Center, unlimited report unlocks, and automatic theme-change rescans."
                          : "Unlock one-click fixes for SEO, images, SKUs, inventory, and trust pages — $9/month."}
                      </Text>
                    </BlockStack>
                    <Button
                      variant={auditPlusActive && fixCount > 0 ? "primary" : undefined}
                      onClick={() => navigate(shopifyAppPath("/app/audit-plus", shopDomain))}
                    >
                      {auditPlusActive ? "Open Audit Plus" : "Explore Audit Plus"}
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>
    </Page>
  );
}
