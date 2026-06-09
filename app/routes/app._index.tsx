import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useSubmit,
  useNavigation,
  useNavigate,
  useRevalidator,
} from "@remix-run/react";
import { useEffect, useRef } from "react";
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
import { APP_ICON_SRC } from "../lib/assets";
import { isAdmin, isPromotionActive, getSetting } from "../lib/admin.server";
import { PROMOTION_LIMIT_MESSAGE } from "../lib/promotion-limits";
import { checkPromotionAuditLimit } from "../lib/promotion-limits.server";

// A RUNNING audit may legitimately take a while on large catalogs, so give it a
// generous window. A PENDING audit means the worker never even picked the job up,
// so a much shorter window is safe — without this, a never-processed job would
// leave the dashboard spinner up forever.
const RUNNING_STALE_MS = 10 * 60 * 1000;
const PENDING_STALE_MS = 3 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  let store = await prisma.store.findUnique({
    where: { shopDomain },
  });

  if (!store) {
    store = await prisma.store.create({
      data: { shopDomain },
    });
  }

  const auditSelect = {
    id: true,
    status: true,
    launchScore: true,
    isUnlocked: true,
    completedAt: true,
    snapshot: true,
    findings: {
      select: { id: true, severity: true, ruleCode: true, title: true },
    },
  } as const;

  const now = Date.now();
  const runningStaleBefore = new Date(now - RUNNING_STALE_MS);
  const pendingStaleBefore = new Date(now - PENDING_STALE_MS);

  // Independent reads run in parallel to cut per-load latency on the remote DB.
  const [
    latestAuditRaw,
    dismissedFixIds,
    dismissedRuleCodes,
    staleAudits,
    auditCount,
    auditPlusActive,
  ] = await Promise.all([
    prisma.audit.findFirst({
      where: { storeId: store.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: auditSelect,
    }),
    getDismissedFixIds(store.id),
    getDismissedRuleCodes(store.id),
    prisma.audit.findMany({
      where: {
        storeId: store.id,
        OR: [
          { status: "RUNNING", startedAt: { lt: runningStaleBefore } },
          { status: "PENDING", createdAt: { lt: pendingStaleBefore } },
        ],
      },
      select: { id: true },
    }),
    prisma.audit.count({ where: { storeId: store.id } }),
    hasAuditPlus(store.id),
  ]);

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

  if (staleAudits.length > 0) {
    await prisma.audit.updateMany({
      where: { id: { in: staleAudits.map((a) => a.id) } },
      data: {
        status: "FAILED",
        errorMessage:
          "Audit timed out waiting for the background worker. Please run it again.",
      },
    });
  }

  // Must run after the stale-timeout update so timed-out audits aren't reported as running.
  const runningAudit = await prisma.audit.findFirst({
    where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
    select: { id: true },
  });

  const latestCompleted = latestAudit?.status === "COMPLETED" ? latestAudit : null;
  // Surface a clear "just finished" confirmation when a merchant returns right after
  // a fast scan — otherwise the absence of a spinner can read as "nothing happened".
  const justCompleted = Boolean(
    latestCompleted?.completedAt &&
      now - new Date(latestCompleted.completedAt).getTime() < 2 * 60 * 1000,
  );
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
  const [promotionActive, promotionEndsAt, promotionMessage, promotionAuditLimit] =
    await Promise.all([
      isPromotionActive(),
      getSetting("promotion_ends_at"),
      getSetting("promotion_message"),
      checkPromotionAuditLimit(store.id, shopDomain, session.email),
    ]);

  const url = new URL(request.url);
  const limitReached = url.searchParams.get("limitReached") === "1";

  const totalFindingCount = latestCompleted?.findings.length ?? 0;
  const activeFindingCount = activeFindings.length;

  return json({
    shopHandle: getShopHandle(shopDomain),
    shopDomain,
    latestAudit: latestCompleted,
    runningAudit,
    hasAudits: auditCount > 0,
    justCompleted,
    auditPlusActive,
    fixCount,
    pillars,
    previewFindings,
    previewFindingCount: PREVIEW_FINDING_COUNT,
    reportFullyUnlocked,
    totalFindingCount,
    activeFindingCount,
    lockedFindingCount: latestCompleted
      ? Math.max(0, activeFindings.length - PREVIEW_FINDING_COUNT)
      : 0,
    scanScope,
    isAdminUser: isAdmin(session.email),
    promotionActive,
    promotionEndsAt,
    promotionMessage,
    promotionAuditLimit,
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

  const limit = await checkPromotionAuditLimit(store.id, session.shop, session.email);
  if (!limit.allowed) {
    return redirect(shopifyAppPath("/app?limitReached=1", session.shop));
  }

  const audit = await prisma.audit.create({
    data: { storeId: store.id, status: "PENDING", triggeredBy: "MANUAL" },
  });

  try {
    await enqueueAudit(audit.id, store.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not queue audit job.";
    await prisma.audit.update({
      where: { id: audit.id },
      data: {
        status: "FAILED",
        errorMessage: `Queue error: ${message}. Ensure DATABASE_URL is set and migrations have run.`,
      },
    });
    return redirect(
      shopifyAppPath(`/app/audit/${audit.id}?queueError=1`, session.shop),
    );
  }

  return redirect(shopifyAppPath(`/app/audit/${audit.id}`, session.shop));
};

export default function Dashboard() {
  const {
    latestAudit,
    runningAudit,
    hasAudits,
    justCompleted,
    shopDomain,
    auditPlusActive,
    fixCount,
    pillars,
    previewFindings,
    previewFindingCount,
    reportFullyUnlocked,
    lockedFindingCount,
    scanScope,
    totalFindingCount,
    activeFindingCount,
    isAdminUser,
    promotionActive,
    promotionEndsAt,
    promotionMessage,
    promotionAuditLimit,
    limitReached,
  } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const isRunning = navigation.state === "submitting" || !!runningAudit;

  // While an audit is queued/running, the loader doesn't re-run on its own, so the
  // "Audit in progress" spinner would stay up until the merchant manually reloads.
  // Poll so the dashboard resolves to the finished report (or a failure banner) on
  // its own — the loader's stale sweep also fails out jobs the worker never picked up.
  const runningAuditId = runningAudit?.id ?? null;
  const revalidatorRef = useRef(revalidator);
  revalidatorRef.current = revalidator;
  useEffect(() => {
    if (!runningAuditId) return;
    const interval = setInterval(() => {
      if (revalidatorRef.current.state === "idle") {
        revalidatorRef.current.revalidate();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [runningAuditId]);

  const reportPath = latestAudit
    ? shopifyAppPath(`/app/audit/${latestAudit.id}`, shopDomain)
    : runningAudit
      ? shopifyAppPath(`/app/audit/${runningAudit.id}`, shopDomain)
      : null;
  const billingPath = latestAudit
    ? shopifyAppPath(`/app/billing?auditId=${latestAudit.id}`, shopDomain)
    : shopifyAppPath("/app/billing", shopDomain);

  const navCards = [
    {
      title: "Latest audit report",
      description: reportFullyUnlocked
        ? "Full findings, category filters, and PDF export."
        : totalFindingCount === 0
          ? "Your last completed scan found no issues."
          : activeFindingCount < totalFindingCount
            ? `${totalFindingCount} findings in report (${activeFindingCount} active) — ${previewFindingCount} with full fix steps free.`
            : `${totalFindingCount} findings — ${previewFindingCount} with full fix steps free.`,
      actionLabel: runningAudit && !latestAudit ? "View scan progress" : "Open report",
      to: reportPath ?? undefined,
      primary: true,
      badge: latestAudit ? "Start here" : runningAudit ? "In progress" : undefined,
    },
    {
      title: "Tools",
      description: auditPlusActive
        ? fixCount > 0
          ? `One-click fixes, Store Monitor, PageSpeed, and more — ${fixCount} fix pack${fixCount === 1 ? "" : "s"} ready.`
          : "One-click fixes, Store Monitor, PageSpeed, link checker, and image optimizer."
        : "Subscriber tools for fixes, monitoring, and utilities — unlock with Audit Plus.",
      actionLabel: "Open Tools",
      onAction: () => navigate(shopifyAppPath("/app/audit-plus", shopDomain)),
      badge: auditPlusActive ? "Subscriber" : undefined,
    },
    {
      title: "Image Optimizer",
      description: latestAudit
        ? "Resize and compress oversized product images to WebP in one batch."
        : "Run an audit first to detect oversized images.",
      actionLabel: "Open Image Optimizer",
      onAction: () => navigate(shopifyAppPath("/app/image-optimizer", shopDomain)),
      badge: latestAudit ? "New" : undefined,
    },
    {
      title: "Audit history",
      description: "Compare past runs and track score changes over time.",
      actionLabel: "View history",
      onAction: () => navigate(shopifyAppPath("/app/history", shopDomain)),
    },
    ...(isAdminUser
      ? [
          {
            title: "Admin Panel",
            description: "Manage promotion mode and view platform stats.",
            actionLabel: "Open Admin",
            onAction: () => navigate(shopifyAppPath("/app/admin", shopDomain)),
            badge: "Admin only",
          } as const,
        ]
      : []),
  ];

  return (
    <Page>
      <TitleBar title="Launch Doctor" />
      <BlockStack gap="500">
        {limitReached && (
          <Banner tone="warning" title="Weekly audit limit reached">
            {PROMOTION_LIMIT_MESSAGE}{" "}
            {promotionAuditLimit.resetsAt
              ? `Your next slot opens around ${new Date(promotionAuditLimit.resetsAt).toLocaleDateString()}.`
              : "Try again after your oldest audit ages out of the rolling 7-day window."}
          </Banner>
        )}

        {promotionActive && (
          <div className="ld-promo-banner">
            <span className="ld-promo-banner-icon">🎉</span>
            <div className="ld-promo-banner-text">
              <strong>Free promotion active!</strong>
              <p>
                {promotionMessage
                  ? promotionMessage
                  : promotionEndsAt
                    ? `All features are free until ${new Date(promotionEndsAt).toLocaleDateString()}.`
                    : "All features are currently free for everyone."}
              </p>
              <p className="ld-promo-banner-limit">{PROMOTION_LIMIT_MESSAGE}</p>
            </div>
          </div>
        )}

        {!hasAudits ? (
          <div className="ld-hero-card">
            <div className="ld-hero-content">
              <img
                className="ld-hero-logo"
                src={APP_ICON_SRC}
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
                  <li>Audit Plus unlocks one-click fixes for SEO & catalog issues</li>
                </ul>
                <div style={{ marginTop: 24 }}>
                  <BlockStack gap="200">
                    {promotionAuditLimit.limited && !promotionAuditLimit.exempt && (
                      <Text as="p" variant="bodySm" tone="subdued">
                        {promotionAuditLimit.used} of {promotionAuditLimit.limit} promotion
                        audits used this week
                      </Text>
                    )}
                    <Button
                      variant="primary"
                      size="large"
                      loading={isRunning}
                      disabled={promotionAuditLimit.limited && !promotionAuditLimit.allowed}
                      onClick={() => submit({}, { method: "post" })}
                    >
                      Run my first audit
                    </Button>
                  </BlockStack>
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
                        src={APP_ICON_SRC}
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
                          Audit in progress… Most scans finish in under a minute (large
                          catalogs can take a couple of minutes). You can safely leave this
                          page — the scan keeps running in the background and your report
                          appears here automatically when it&rsquo;s done.
                        </Banner>
                      )}

                      {!runningAudit && justCompleted && (
                        <Banner tone="success" title="Audit complete">
                          Your scan finished and your Launch Score is ready below.
                        </Banner>
                      )}

                      {!runningAudit && !latestAudit && (
                        <Banner tone="warning" title="No completed audits yet">
                          Your previous scan didn’t finish. Run the audit again to
                          generate your Launch Score and findings.
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

                      {promotionAuditLimit.limited && !promotionAuditLimit.exempt && (
                        <Text as="p" variant="bodySm" tone="subdued">
                          {promotionAuditLimit.used} of {promotionAuditLimit.limit} promotion
                          audits used this week
                        </Text>
                      )}

                      <div className="ld-dashboard-actions">
                        <Button
                          variant="primary"
                          loading={isRunning}
                          disabled={promotionAuditLimit.limited && !promotionAuditLimit.allowed}
                          onClick={() => submit({}, { method: "post" })}
                        >
                          Re-run full audit
                        </Button>
                        {reportPath && (
                          <Button onClick={() => navigate(reportPath)}>Open full report</Button>
                        )}
                        {auditPlusActive && (
                          <Button
                            onClick={() =>
                              navigate(shopifyAppPath("/app/audit-plus", shopDomain))
                            }
                          >
                            Open Tools
                          </Button>
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
                            : `${previewFindingCount} of ${totalFindingCount} findings include fix steps on the free plan.`}
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
                      <Link to={reportPath} style={{ textDecoration: "none" }}>
                        <Button>View full audit report</Button>
                      </Link>
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
                          Tools
                        </Text>
                        <Badge tone={auditPlusActive ? "success" : undefined}>
                          {auditPlusActive ? "Audit Plus active" : "Subscriber tools"}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {auditPlusActive
                          ? fixCount > 0
                            ? `${fixCount} fix pack${fixCount === 1 ? "" : "s"} ready — apply fixes, monitor your store, and more.`
                            : "One-click fixes, Store Monitor, unlimited report unlocks, and theme-change rescans."
                          : "Subscribe to Audit Plus ($9/month) for Tools — fixes, monitoring, and subscriber utilities."}
                      </Text>
                    </BlockStack>
                    <Button
                      variant={auditPlusActive && fixCount > 0 ? "primary" : undefined}
                      onClick={() => navigate(shopifyAppPath("/app/audit-plus", shopDomain))}
                    >
                      {auditPlusActive ? "Open Tools" : "View Tools"}
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
