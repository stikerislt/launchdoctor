import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useEffect } from "react";
import { Form, useFetcher, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Divider,
  InlineStack,
  List,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { hasAuditPlus } from "../lib/billing.server";
import { enqueueLinkScan } from "../lib/link-scan/queue.server";
import {
  getLinkIssueGuidance,
  LINK_KIND_LABELS,
  LINK_KIND_ORDER,
  type LinkIssueLike,
} from "../lib/link-scan/guidance";
import { AppPage } from "../components/AppPage";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { getShopHandle } from "../lib/shopify.server";
import { shopifyAppPath } from "../lib/app-routes";

// A crawl that never reports back (worker down) shouldn't spin forever.
const SCAN_STALE_MS = 10 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({ where: { shopDomain } });

  if (!store) {
    return json({
      shopDomain,
      shopHandle: getShopHandle(shopDomain),
      auditPlusActive: false,
      scan: null,
      running: null,
    });
  }

  // Age out crawls that the worker never finished.
  const staleBefore = new Date(Date.now() - SCAN_STALE_MS);
  await prisma.linkScan.updateMany({
    where: {
      storeId: store.id,
      status: { in: ["PENDING", "RUNNING"] },
      createdAt: { lt: staleBefore },
    },
    data: { status: "FAILED", errorMessage: "Scan timed out.", completedAt: new Date() },
  });

  const [auditPlusActive, latestScan, running] = await Promise.all([
    hasAuditPlus(store.id),
    prisma.linkScan.findFirst({
      where: { storeId: store.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      include: { issues: true },
    }),
    prisma.linkScan.findFirst({
      where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return json({
    shopDomain,
    shopHandle: getShopHandle(shopDomain),
    auditPlusActive,
    scan: latestScan
      ? {
          id: latestScan.id,
          status: latestScan.status,
          completedAt: latestScan.completedAt,
          pagesScanned: latestScan.pagesScanned,
          linksChecked: latestScan.linksChecked,
          brokenCount: latestScan.brokenCount,
          truncated: latestScan.truncated,
          issues: latestScan.issues.map((i) => ({
            id: i.id,
            kind: i.kind,
            url: i.url,
            statusCode: i.statusCode,
            sourceType: i.sourceType,
            sourceLabel: i.sourceLabel,
            sourceAdminUrl: i.sourceAdminUrl,
            detail: i.detail,
          })),
        }
      : null,
    running: running
      ? {
          id: running.id,
          status: running.status,
          pagesScanned: running.pagesScanned,
          linksChecked: running.linksChecked,
        }
      : null,
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
    return json({ error: "Audit Plus is required to run a link scan." }, { status: 403 });
  }

  // One scan at a time per shop — don't pile crawls onto the worker.
  const existing = await prisma.linkScan.findFirst({
    where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (existing) {
    return redirect(shopifyAppPath("/app/links", session.shop));
  }

  const scan = await prisma.linkScan.create({
    data: { storeId: store.id, status: "PENDING" },
  });

  try {
    await enqueueLinkScan(scan.id, store.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not queue link scan.";
    await prisma.linkScan.update({
      where: { id: scan.id },
      data: { status: "FAILED", errorMessage: `Queue error: ${message}` },
    });
  }

  return redirect(shopifyAppPath("/app/links", session.shop));
};

type LoaderData = ReturnType<typeof useLoaderData<typeof loader>>;

export default function BrokenLinkFinder() {
  const initial = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();

  // Use freshly-polled data when available, falling back to the initial load.
  const data: LoaderData = (fetcher.data as LoaderData) ?? initial;
  const { shopDomain, shopHandle, auditPlusActive, scan, running } = data;

  const isScanning = Boolean(running);
  const isStarting = navigation.state === "submitting";

  // Poll while a scan is in progress so the page updates without a refresh.
  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      fetcher.load(`/app/links?shop=${encodeURIComponent(shopDomain)}`);
    }, 3000);
    return () => clearInterval(interval);
  }, [isScanning, shopDomain, fetcher]);

  if (!auditPlusActive) {
    return (
      <AppPage
        title="Broken Link Finder"
        shopDomain={shopDomain}
        backTo="/app/audit-plus"
        backLabel="Audit Plus"
      >
        <BlockStack gap="500">
          <AppBrandHeader
            title="Broken Link Finder"
            subtitle="Find dead links and broken images across your store"
          />
          <Banner tone="warning" title="Audit Plus required">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                The Broken Link Finder scans your products, pages, and blog posts for dead
                links and broken images, then shows you exactly where and how to fix each one.
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

  return (
    <AppPage
      title="Broken Link Finder"
      shopDomain={shopDomain}
      backTo="/app/audit-plus"
      backLabel="Audit Plus"
    >
      <BlockStack gap="500">
        <AppBrandHeader
          title="Broken Link Finder"
          subtitle="Find dead links and broken images across your store"
        />

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Scan your storefront
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Checks links and images in your products, pages, blog posts, and homepage.
                  Read-only — Launch Doctor never changes your store.
                </Text>
              </BlockStack>
              {!isScanning && (
                <Form method="post">
                  <Button submit variant="primary" loading={isStarting}>
                    {scan ? "Re-scan store" : "Run link scan"}
                  </Button>
                </Form>
              )}
            </InlineStack>

            {isScanning && (
              <Banner tone="info" title="Scanning your store…">
                <Text as="p" variant="bodyMd">
                  Crawling content and checking links
                  {running && running.pagesScanned > 0
                    ? ` — ${running.pagesScanned} item${running.pagesScanned === 1 ? "" : "s"} scanned so far`
                    : ""}
                  . This can take a few minutes on large stores. You can leave this page — the
                  scan keeps running.
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Card>

        {!isScanning && scan && <ScanResults scan={scan} shopHandle={shopHandle} />}

        {!isScanning && !scan && (
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                No scan yet. Run your first link scan to find broken links and images before
                your customers (and Google) do.
              </Text>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </AppPage>
  );
}

type ScanData = NonNullable<LoaderData["scan"]>;

function ScanResults({ scan, shopHandle }: { scan: ScanData; shopHandle: string }) {
  const completed = scan.completedAt ? new Date(scan.completedAt).toLocaleString() : null;

  if (scan.brokenCount === 0) {
    return (
      <Banner tone="success" title="No broken links found">
        <Text as="p" variant="bodyMd">
          We checked {scan.linksChecked} link{scan.linksChecked === 1 ? "" : "s"} across{" "}
          {scan.pagesScanned} item{scan.pagesScanned === 1 ? "" : "s"} and everything resolved.
          {completed ? ` Last scan: ${completed}.` : ""}
        </Text>
      </Banner>
    );
  }

  const grouped = LINK_KIND_ORDER.map((kind) => ({
    kind,
    label: LINK_KIND_LABELS[kind] ?? kind,
    issues: scan.issues.filter((i) => i.kind === kind),
  })).filter((g) => g.issues.length > 0);

  return (
    <BlockStack gap="400">
      <Banner tone="warning" title={`${scan.brokenCount} broken link${scan.brokenCount === 1 ? "" : "s"} found`}>
        <Text as="p" variant="bodyMd">
          Checked {scan.linksChecked} link{scan.linksChecked === 1 ? "" : "s"} across{" "}
          {scan.pagesScanned} item{scan.pagesScanned === 1 ? "" : "s"}.
          {completed ? ` Last scan: ${completed}.` : ""}
          {scan.truncated
            ? " Your store is large, so the scan was capped — fix these, then re-scan for more."
            : ""}
        </Text>
      </Banner>

      {grouped.map((group) => (
        <BlockStack gap="300" key={group.kind}>
          <InlineStack gap="200" blockAlign="center">
            <Text as="h2" variant="headingMd">
              {group.label}
            </Text>
            <Badge tone="attention">{String(group.issues.length)}</Badge>
          </InlineStack>
          {group.issues.map((issue) => (
            <LinkIssueCard key={issue.id} issue={issue} shopHandle={shopHandle} />
          ))}
        </BlockStack>
      ))}
    </BlockStack>
  );
}

function LinkIssueCard({
  issue,
  shopHandle,
}: {
  issue: ScanData["issues"][number];
  shopHandle: string;
}) {
  const guidance = getLinkIssueGuidance(issue as LinkIssueLike, shopHandle);

  return (
    <Card>
      <BlockStack gap="300">
        <BlockStack gap="100">
          <InlineStack gap="200" blockAlign="center" wrap>
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {issue.sourceLabel}
            </Text>
            <Badge tone="critical">
              {issue.detail ?? (issue.statusCode ? `HTTP ${issue.statusCode}` : "Broken")}
            </Badge>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued" breakWord>
            {issue.url}
          </Text>
        </BlockStack>

        <Divider />

        <BlockStack gap="200">
          <Text as="p" variant="bodyMd">
            {guidance.summary}
          </Text>
          <Text as="h4" variant="headingSm">
            How to fix
          </Text>
          <List type="number">
            {guidance.steps.map((step) => (
              <List.Item key={step}>{step}</List.Item>
            ))}
          </List>
        </BlockStack>

        {guidance.actions.length > 0 && (
          <InlineStack gap="200" wrap>
            {guidance.actions.map((action, idx) => (
              <Button
                key={action.url}
                url={action.url}
                target="_blank"
                variant={idx === 0 ? "primary" : "secondary"}
              >
                {action.label} →
              </Button>
            ))}
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}
