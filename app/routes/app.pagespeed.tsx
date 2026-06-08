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
  InlineStack,
  List,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { hasAuditPlus } from "../lib/billing.server";
import { enqueuePageSpeedScan } from "../lib/pagespeed-scan/queue.server";
import { AppPage } from "../components/AppPage";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { shopifyAppPath } from "../lib/app-routes";

const SCAN_STALE_MS = 15 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({ where: { shopDomain } });

  if (!store) {
    return json({
      shopDomain,
      auditPlusActive: false,
      scan: null,
      running: null,
      lastFailed: null,
    });
  }

  const staleBefore = new Date(Date.now() - SCAN_STALE_MS);
  await prisma.pageSpeedScan.updateMany({
    where: {
      storeId: store.id,
      status: { in: ["PENDING", "RUNNING"] },
      createdAt: { lt: staleBefore },
    },
    data: {
      status: "FAILED",
      errorMessage: "Scan timed out. Try again.",
      completedAt: new Date(),
    },
  });

  const [auditPlusActive, latestScan, running, lastFailed] = await Promise.all([
    hasAuditPlus(store.id),
    prisma.pageSpeedScan.findFirst({
      where: { storeId: store.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    }),
    prisma.pageSpeedScan.findFirst({
      where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pageSpeedScan.findFirst({
      where: { storeId: store.id, status: "FAILED" },
      orderBy: { completedAt: "desc" },
      select: { errorMessage: true, measuredUrl: true, completedAt: true },
    }),
  ]);

  return json({
    shopDomain,
    auditPlusActive,
    scan: latestScan
      ? {
          id: latestScan.id,
          score: latestScan.score,
          measuredUrl: latestScan.measuredUrl,
          completedAt: latestScan.completedAt,
        }
      : null,
    running: running
      ? { id: running.id, status: running.status, errorMessage: running.errorMessage }
      : null,
    lastFailed: latestScan ? null : lastFailed,
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

  const existing = await prisma.pageSpeedScan.findFirst({
    where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (existing) {
    return redirect(shopifyAppPath("/app/pagespeed", session.shop));
  }

  const scan = await prisma.pageSpeedScan.create({
    data: { storeId: store.id, status: "PENDING" },
  });

  try {
    await enqueuePageSpeedScan(scan.id, store.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not queue PageSpeed scan.";
    await prisma.pageSpeedScan.update({
      where: { id: scan.id },
      data: { status: "FAILED", errorMessage: `Queue error: ${message}`, completedAt: new Date() },
    });
  }

  return redirect(shopifyAppPath("/app/pagespeed", session.shop));
};

type LoaderData = ReturnType<typeof useLoaderData<typeof loader>>;

function scoreTone(score: number): "success" | "warning" | "critical" {
  if (score >= 90) return "success";
  if (score >= 50) return "warning";
  return "critical";
}

export default function PageSpeedInsightsTool() {
  const initial = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const data: LoaderData = (fetcher.data as LoaderData) ?? initial;
  const { shopDomain, auditPlusActive, scan, running, lastFailed } = data;

  const isScanning = Boolean(running);
  const isStarting = navigation.state === "submitting";

  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      fetcher.load(`/app/pagespeed?shop=${encodeURIComponent(shopDomain)}`);
    }, 4000);
    return () => clearInterval(interval);
  }, [isScanning, shopDomain, fetcher]);

  if (!auditPlusActive) {
    return (
      <AppPage
        title="Mobile PageSpeed"
        shopDomain={shopDomain}
        backTo="/app/audit-plus"
        backLabel="Audit Plus"
      >
        <BlockStack gap="500">
          <AppBrandHeader
            title="Mobile PageSpeed"
            subtitle="Google PageSpeed Insights for your storefront"
          />
          <Banner tone="warning" title="Audit Plus required">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                Run Google&apos;s official mobile Lighthouse performance score on your live
                storefront — the same metric used in PageSpeed Insights and Core Web Vitals
                reporting.
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
      title="Mobile PageSpeed"
      shopDomain={shopDomain}
      backTo="/app/audit-plus"
      backLabel="Audit Plus"
    >
      <BlockStack gap="500">
        <AppBrandHeader
          title="Mobile PageSpeed"
          subtitle="Google PageSpeed Insights — mobile performance score"
        />

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Run mobile performance check
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Scores your public storefront homepage with Google Lighthouse (mobile). Takes
                  about 30–90 seconds. Results appear in Store Monitor.
                </Text>
              </BlockStack>
              <Form method="post">
                <Button submit variant="primary" loading={isStarting || isScanning} disabled={isScanning}>
                  {isScanning ? "Running PageSpeed…" : scan ? "Run again" : "Run PageSpeed scan"}
                </Button>
              </Form>
            </InlineStack>

            {isScanning && (
              <Banner tone="info">
                <Text as="p" variant="bodyMd">
                  Google is analyzing your storefront. This page updates automatically — you can
                  keep working in another tab.
                </Text>
              </Banner>
            )}

            {!isScanning && !scan && lastFailed?.errorMessage && (
              <Banner tone="warning" title="Last scan did not complete">
                <Text as="p" variant="bodyMd">
                  {lastFailed.errorMessage}
                  {lastFailed.measuredUrl ? ` URL: ${lastFailed.measuredUrl}` : ""}
                </Text>
              </Banner>
            )}

            {!scan && !isScanning && !lastFailed && (
              <Banner tone="info">
                <Text as="p" variant="bodyMd">
                  No scan yet. Your storefront must be publicly accessible (password protection
                  must be off) for Google to score it.
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Card>

        {scan && scan.score != null && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <Text as="h2" variant="headingMd">
                  Latest result
                </Text>
                <Badge tone={scoreTone(scan.score)}>{`${scan.score} / 100`}</Badge>
              </InlineStack>

              {scan.score < 50 && (
                <Banner tone="warning" title="Performance needs attention">
                  <Text as="p" variant="bodyMd">
                    Scores under 50 hurt mobile conversion and SEO. Compress images, reduce apps,
                    and simplify your homepage hero.
                  </Text>
                </Banner>
              )}

              <List type="bullet">
                <List.Item>
                  <strong>Score:</strong> {scan.score}/100 (Google Lighthouse, mobile strategy)
                </List.Item>
                {scan.measuredUrl && (
                  <List.Item>
                    <strong>URL tested:</strong> {scan.measuredUrl}
                  </List.Item>
                )}
                {scan.completedAt && (
                  <List.Item>
                    <strong>Scanned:</strong>{" "}
                    {new Date(scan.completedAt).toLocaleString()}
                  </List.Item>
                )}
              </List>

              {scan.measuredUrl && (
                <Button
                  url={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(scan.measuredUrl)}`}
                  target="_blank"
                >
                  Open in PageSpeed.web.dev →
                </Button>
              )}

              <Button onClick={() => navigate(shopifyAppPath("/app/monitor", shopDomain))}>
                View in Store Monitor
              </Button>
            </BlockStack>
          </Card>
        )}

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Tips for a better score
            </Text>
            <List type="bullet">
              <List.Item>Compress product and hero images (WebP, under 200 KB where possible)</List.Item>
              <List.Item>Remove unused apps that inject scripts on every page</List.Item>
              <List.Item>Limit homepage slideshows and autoplay video</List.Item>
              <List.Item>Use a fast Shopify theme and keep it updated</List.Item>
            </List>
          </BlockStack>
        </Card>
      </BlockStack>
    </AppPage>
  );
}
