import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { json } from "@remix-run/node";

import { useFetcher, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";

import { useEffect, useState } from "react";

import {
  BlockStack,
  Text,
  Tabs,
  Banner,
  Button,
  Spinner,
  InlineStack,
  Card,
  List,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

import {
  loadAuditForShop,
  serializeAuditForClient,
} from "../lib/audit-access.server";
import { hasAuditPlus, isDevBillingBypassEnabled } from "../lib/billing.server";
import { buildFixPreviews } from "../lib/fixes/preview.server";
import {
  dismissAllFindings,
  getDismissedFixIds,
  getDismissedRuleCodes,
  restoreAllDismissals,
  restoreRuleCode,
  summarizeDismissedFindings,
} from "../lib/fixes/dismissals.server";

import { PREVIEW_FINDING_COUNT } from "../../audit-engine/utils/audit-serialize";

import { AppBrandHeader } from "../components/AppBrandHeader";
import { AppPage } from "../components/AppPage";

import { PerfectScoreCelebration } from "../components/PerfectScoreCelebration";
import { ScoreGauge } from "../components/ScoreGauge";
import { isPerfectLaunchScore } from "../lib/launch-score";

import { FindingCard } from "../components/FindingCard";

import { SeveritySummary } from "../components/SeveritySummary";

import { severityCounts } from "../components/SeverityBadge";

import { shopifyAppPath } from "../lib/app-routes";

import { APP_ICON_SRC } from "../lib/assets";

import { useEmbeddedDownload } from "../hooks/useEmbeddedDownload";

import { AIChat } from "../components/AIChat";



const CATEGORY_LABELS: Record<string, string> = {

  ALL: "All",

  PAYMENTS_FRAUD: "Payments",

  SHIPPING_FULFILLMENT: "Shipping",

  PRODUCT_CATALOG: "Products",

  SEO_DISCOVERABILITY: "SEO",

  TRUST_SIGNALS: "Trust",

  CHECKOUT_CONVERSION: "Checkout",

  MOBILE_THEME: "Mobile & Theme",

};



export const loader = async ({ request, params }: LoaderFunctionArgs) => {

  const { session } = await authenticate.admin(request);

  const audit = await loadAuditForShop(params.id!, session.shop);



  if (!audit) {

    throw new Response("Audit not found", { status: 404 });

  }

  const auditPlusActive = await hasAuditPlus(audit.storeId);
  const dismissedFixIds = await getDismissedFixIds(audit.storeId);
  const latestCompleted = await prisma.audit.findFirst({
    where: { storeId: audit.storeId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true, snapshot: true },
  });

  const fixCount =
    audit.status === "COMPLETED" && auditPlusActive
      ? buildFixPreviews(audit.snapshot, dismissedFixIds).length
      : 0;
  const latestFixCount =
    latestCompleted && auditPlusActive
      ? buildFixPreviews(latestCompleted.snapshot, dismissedFixIds).length
      : 0;

  const dismissedRuleCodes = await getDismissedRuleCodes(audit.storeId);

  return json({

    audit: await serializeAuditForClient(audit),

    previewCount: PREVIEW_FINDING_COUNT,

    showWorkerHint: process.env.NODE_ENV === "development",
    workerHintMessage:
      process.env.NODE_ENV === "development"
        ? "In local dev, run pnpm worker in a second terminal if this page does not update."
        : "If this screen does not finish within a few minutes, the background worker may not be processing jobs. Try again or contact support.",
    devBillingBypass: isDevBillingBypassEnabled(),
    auditPlusActive,
    fixCount,
    latestFixAuditId: latestCompleted?.id ?? null,
    latestFixCount,
    rawFindingCount: audit.findings.length,
    dismissedFindings: summarizeDismissedFindings(audit.findings, dismissedRuleCodes),

  });

};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (!isDevBillingBypassEnabled()) {
    return json({ error: "Finding dismissals are only available in development." }, { status: 403 });
  }

  const { session } = await authenticate.admin(request);
  const audit = await loadAuditForShop(params.id!, session.shop);

  if (!audit || audit.status !== "COMPLETED") {
    return json({ error: "Completed audit not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "dismiss-all") {
    const ruleCodes = [...new Set(audit.findings.map((finding) => finding.ruleCode))];
    const fixIds = buildFixPreviews(audit.snapshot).map((fix) => fix.id);
    await dismissAllFindings(audit.storeId, ruleCodes, fixIds);
  } else if (intent === "restore-all") {
    await restoreAllDismissals(audit.storeId);
  } else if (intent === "restore-finding") {
    const ruleCode = String(formData.get("ruleCode") ?? "");
    if (!ruleCode) {
      return json({ error: "Missing rule code." }, { status: 400 });
    }
    await restoreRuleCode(audit.storeId, ruleCode);
  } else {
    return json({ error: "Unknown action." }, { status: 400 });
  }

  const dismissedRuleCodes = await getDismissedRuleCodes(audit.storeId);

  return json({
    ok: true,
    audit: await serializeAuditForClient(audit),
    dismissedFindings: summarizeDismissedFindings(audit.findings, dismissedRuleCodes),
    rawFindingCount: audit.findings.length,
  });
};

export default function AuditReport() {

  const loaderData = useLoaderData<typeof loader>();

  const fetcher = useFetcher<typeof loader>();
  const dismissFetcher = useFetcher<typeof action>();

  const live = fetcher.data ?? loaderData;
  const {
    showWorkerHint,
    workerHintMessage,
    previewCount,
    auditPlusActive,
    fixCount,
    latestFixAuditId,
    latestFixCount,
    devBillingBypass,
    rawFindingCount,
    dismissedFindings,
  } = live;

  const dismissLive = dismissFetcher.data;
  const audit =
    dismissLive && "audit" in dismissLive && dismissLive.audit
      ? dismissLive.audit
      : fetcher.data?.audit ?? loaderData.audit;
  const dismissedList =
    dismissLive && "dismissedFindings" in dismissLive
      ? dismissLive.dismissedFindings
      : dismissedFindings;
  const totalFindingCount =
    dismissLive && "rawFindingCount" in dismissLive
      ? dismissLive.rawFindingCount
      : rawFindingCount;
  const dismissBusy = dismissFetcher.state !== "idle";

  const shop = audit.store.shopDomain;

  const [selectedTab, setSelectedTab] = useState(0);

  const [searchParams] = useSearchParams();
  const justUnlocked = searchParams.get("unlocked") === "true";
  const [showUnlockedBanner, setShowUnlockedBanner] = useState(justUnlocked);

  const navigate = useNavigate();

  const fixesPath = shopifyAppPath(`/app/fixes/${audit.id}`, shop);
  const latestFixesPath =
    latestFixAuditId && latestFixAuditId !== audit.id
      ? shopifyAppPath(`/app/fixes/${latestFixAuditId}`, shop)
      : fixesPath;
  const viewingOlderAudit =
    latestFixAuditId != null && latestFixAuditId !== audit.id;

  const billingPath = shopifyAppPath(`/app/billing?auditId=${audit.id}`, shop);

  const pdfPath = shopifyAppPath(`/app/audit/${audit.id}/pdf`, shop);

  const {
    download: downloadPdf,
    downloading: pdfDownloading,
    error: pdfError,
    clearError: clearPdfError,
  } = useEmbeddedDownload();



  useEffect(() => {

    if (audit.status === "PENDING" || audit.status === "RUNNING") {

      const interval = setInterval(() => {

        fetcher.load(`/app/audit/${audit.id}?shop=${encodeURIComponent(shop)}`);

      }, 3000);

      return () => clearInterval(interval);

    }

  }, [audit.status, audit.id, shop, fetcher]);



  if (audit.status === "PENDING" || audit.status === "RUNNING") {

    return (

      <AppPage title="Running audit…" shopDomain={shop}>

        <div className="ld-summary-card ld-running-state">

          <img src={APP_ICON_SRC} alt="" />

          <Text as="h2" variant="headingMd">

            Scanning your store…

          </Text>

          <Text as="p" variant="bodyMd" tone="subdued">

            Running 50 checks across payments, shipping, SEO, and more. Most scans finish in
            under a minute; large catalogs can take a couple of minutes. This page updates on
            its own when your report is ready.

          </Text>

          <div style={{ marginTop: 16 }}>

            <Spinner accessibilityLabel="Audit in progress" size="large" />

          </div>

          <Text as="p" variant="bodySm" tone="subdued">
            You can safely leave or close this page — the scan keeps running in the
            background. Your report will be waiting on your dashboard when it&rsquo;s done.
          </Text>

          {showWorkerHint && workerHintMessage && (

            <Banner tone="info">

              {workerHintMessage.includes("pnpm worker") ? (
                <>
                  In local dev, run <code>pnpm worker</code> in a second terminal if this page
                  does not update.
                </>
              ) : (
                <>{workerHintMessage}</>
              )}

            </Banner>

          )}

        </div>

      </AppPage>

    );

  }



  if (audit.status === "FAILED") {

    return (

      <AppPage title="Audit failed" shopDomain={shop}>

        <AppBrandHeader title="Audit failed" subtitle="Something went wrong during the scan" />

        <Banner tone="critical">{audit.errorMessage ?? "An unknown error occurred."}</Banner>

      </AppPage>

    );

  }



  const counts = severityCounts(audit.findings);

  const categories = ["ALL", ...Object.keys(CATEGORY_LABELS).filter((k) => k !== "ALL")];

  const activeCategory = categories[selectedTab]!;

  const filtered =

    activeCategory === "ALL"

      ? audit.findings

      : audit.findings.filter((f) => f.category === activeCategory);



  const tabs = categories.map((cat) => ({

    id: cat,

    content: CATEGORY_LABELS[cat] ?? cat,

    badge: cat === "ALL"

      ? String(audit.findings.length)

      : String(audit.findings.filter((f) => f.category === cat).length),

  }));



  const isUnlocked = audit.isUnlocked;

  const completedDate = audit.completedAt

    ? new Date(audit.completedAt).toLocaleDateString(undefined, {

        month: "short",

        day: "numeric",

        year: "numeric",

      })

    : null;



  return (
    <>
    <AppPage
      title="Audit Report"
      shopDomain={shop}
      titleBarChildren={
        <>
          {!isUnlocked && (
            <button variant="primary" onClick={() => navigate(billingPath)}>
              Unlock options
            </button>
          )}
          {isUnlocked && (
            <button
              disabled={pdfDownloading}
              onClick={() =>
                void downloadPdf(pdfPath, `launch-doctor-audit-${audit.id}.pdf`)
              }
            >
              {pdfDownloading ? "Preparing PDF…" : "Download PDF"}
            </button>
          )}
        </>
      }
    >

      <BlockStack gap="500">

        <AppBrandHeader

          title="Audit Report"

          subtitle={

            completedDate

              ? `${audit.findings.length} findings · ${completedDate}`

              : `${audit.findings.length} findings`

          }

        />

        {showUnlockedBanner && (
          <Banner
            tone="success"
            title="Report unlocked"
            onDismiss={() => setShowUnlockedBanner(false)}
          >
            Your full report is now unlocked — every finding, the Fix Center, and
            PDF export are available below.
          </Banner>
        )}

        {devBillingBypass && (
          <Banner tone="info">
            Dev mode — all findings, Fix Center, and PDF export are unlocked without billing.
            Set <code>BILLING_DEV_BYPASS=false</code> to test the 5-finding preview.
          </Banner>
        )}

        {devBillingBypass && audit.status === "COMPLETED" && totalFindingCount > 0 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Dev: dismiss findings
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Hide audit issues from this report and recalculate Launch Score immediately.
                  {dismissedList.length > 0
                    ? ` ${audit.findings.length} active · ${dismissedList.length} dismissed · ${totalFindingCount} total checks.`
                    : ` ${audit.findings.length} of ${totalFindingCount} checks active.`}
                </Text>
              </BlockStack>

              <InlineStack gap="200" wrap>
                {audit.findings.length > 0 && (
                  <dismissFetcher.Form method="post">
                    <input type="hidden" name="intent" value="dismiss-all" />
                    <Button submit variant="primary" loading={dismissBusy}>
                      Dismiss all findings
                    </Button>
                  </dismissFetcher.Form>
                )}
                {dismissedList.length > 0 && (
                  <dismissFetcher.Form method="post">
                    <input type="hidden" name="intent" value="restore-all" />
                    <Button submit loading={dismissBusy}>
                      Restore all
                    </Button>
                  </dismissFetcher.Form>
                )}
              </InlineStack>

              {dismissedList.length > 0 && (
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Restore individually to bring a check back into your score.
                  </Text>
                  <List type="bullet">
                    {dismissedList.map((item) => (
                      <List.Item key={item.ruleCode}>
                        <InlineStack gap="200" blockAlign="center" wrap>
                          <Text as="span" variant="bodyMd">
                            {item.title}
                          </Text>
                          <dismissFetcher.Form method="post">
                            <input type="hidden" name="intent" value="restore-finding" />
                            <input type="hidden" name="ruleCode" value={item.ruleCode} />
                            <Button submit size="slim" loading={dismissBusy}>
                              Restore
                            </Button>
                          </dismissFetcher.Form>
                        </InlineStack>
                      </List.Item>
                    ))}
                  </List>
                </BlockStack>
              )}

              {audit.findings.length === 0 && dismissedList.length > 0 && (
                <Banner tone="success">
                  All findings are dismissed. Launch Score reflects an empty active issue list.
                </Banner>
              )}
            </BlockStack>
          </Card>
        )}

        {pdfError && (
          <Banner tone="critical" onDismiss={clearPdfError}>
            {pdfError}
          </Banner>
        )}

        {auditPlusActive && fixCount > 0 && (
          <Banner tone="success" title="Audit Plus quick fixes available">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                Launch Doctor found {fixCount} auto-fix pack{fixCount === 1 ? "" : "s"} —
                SEO, catalog, images, inventory, and trust pages.
              </Text>
              <InlineStack gap="200">
                <Button
                  onClick={() => navigate(shopifyAppPath("/app/audit-plus", shop))}
                  variant="primary"
                >
                  Open Tools
                </Button>
                {fixCount > 0 && (
                  <Button variant="plain" onClick={() => navigate(fixesPath)}>
                    Apply fixes now
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Banner>
        )}

        {auditPlusActive &&
          fixCount === 0 &&
          latestFixCount > 0 &&
          viewingOlderAudit &&
          audit.status === "COMPLETED" && (
            <Banner tone="success" title="Fixes available on your latest audit">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  This report is from an earlier run. Your latest completed audit has{" "}
                  {latestFixCount} auto-fix pack{latestFixCount === 1 ? "" : "s"} ready in Tools.
                </Text>
                <InlineStack gap="200">
                  <Button
                    onClick={() => navigate(shopifyAppPath("/app/audit-plus", shop))}
                    variant="primary"
                  >
                    Open Tools
                  </Button>
                  <Button variant="plain" onClick={() => navigate(latestFixesPath!)}>
                    Apply fixes now
                  </Button>
                  <Button
                    variant="plain"
                    onClick={() =>
                      navigate(shopifyAppPath(`/app/audit/${latestFixAuditId}`, shop))
                    }
                  >
                    View latest report
                  </Button>
                </InlineStack>
              </BlockStack>
            </Banner>
          )}

        {auditPlusActive &&
          fixCount === 0 &&
          (latestFixCount === 0 || !viewingOlderAudit) &&
          audit.status === "COMPLETED" && (
            <Banner tone="info">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  No one-click fixes were detected for this audit. Open Tools for
                  monitoring and other subscriber utilities.
                </Text>
                <Button onClick={() => navigate(shopifyAppPath("/app/audit-plus", shop))}>
                  Open Tools
                </Button>
              </BlockStack>
            </Banner>
          )}

        {isPerfectLaunchScore(audit.launchScore) && <PerfectScoreCelebration />}

        <div className="ld-summary-card">

          <div className="ld-summary-grid">

            <div className="ld-score-column">
              {audit.launchScore != null && <ScoreGauge score={audit.launchScore} />}
              {audit.coreScore != null && audit.seoScore != null && (
                <div className="ld-score-breakdown">
                  <Text as="p" variant="bodyMd">
                    <strong>Core:</strong> {audit.coreScore} · <strong>SEO:</strong>{" "}
                    {audit.seoScore}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Launch Score blends 65% store readiness and 35% SEO visibility.
                  </Text>
                </div>
              )}
            </div>

            <SeveritySummary counts={counts} />

          </div>

        </div>



        {!isUnlocked && audit.findings.length > previewCount && (

          <div className="ld-unlock-banner">

            <div className="ld-unlock-banner-main">

              <Text as="p" variant="bodyMd" fontWeight="semibold">

                Showing {previewCount} of {audit.findings.length} findings with full fix steps

              </Text>

              <Text as="p" variant="bodySm" tone="subdued">

                Pick the option that fits how you work with Launch Doctor.

              </Text>

              <div className="ld-unlock-options">

                <div className="ld-unlock-option">

                  <Text as="p" variant="bodyMd" fontWeight="semibold">

                    $19 one-time — this report

                  </Text>

                  <Text as="p" variant="bodySm" tone="subdued">

                    All findings and fix steps for this audit, plus PDF export. Does not

                    include Fix Center or future reports.

                  </Text>

                </div>

                <div className="ld-unlock-option">

                  <Text as="p" variant="bodyMd" fontWeight="semibold">

                    $9/month — Audit Plus

                  </Text>

                  <Text as="p" variant="bodySm" tone="subdued">

                    Every report unlocked, Fix Center one-click fixes, and theme-publish

                    rescans. Best if you want ongoing monitoring and SEO/catalog automation.

                  </Text>

                </div>

              </div>

            </div>

            <InlineStack gap="200" wrap>

              <Button onClick={() => navigate(billingPath)} variant="primary">

                Unlock this report — $19

              </Button>

              <Button onClick={() => navigate(billingPath)}>

                Subscribe — $9/mo

              </Button>

            </InlineStack>

          </div>

        )}



        <div className="ld-tabs-wrap">

          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />

        </div>



        <BlockStack gap="300">

          {filtered.map((finding) => (

            <FindingCard

              key={finding.id}

              shopHandle={shop.replace(".myshopify.com", "")}

              unlockUrl={billingPath}

              finding={finding}

            />

          ))}

        </BlockStack>

      </BlockStack>

    </AppPage>

    {audit.status === "COMPLETED" && (
      <AIChat
        auditId={audit.id}
        shopDomain={shop}
        auditPlusActive={auditPlusActive}
      />
    )}
    </>

  );

}

