import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  ProgressBar,
  Text,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { loadAuditForShop } from "../lib/audit-access.server";
import {
  getHeavyImageTargets,
  getImageFormatBreakdown,
  getPngImageTargets,
  getSnapshotProducts,
  parseAuditSnapshot,
} from "../lib/fixes/snapshot.server";
import type { BatchOptimizeResult, PngConvertResult } from "../lib/fixes/apply-optimize-images.server";
import {
  convertPngImagesWithStats,
  optimizeImagesWithStats,
} from "../lib/fixes/apply-optimize-images.server";
import { AppPage } from "../components/AppPage";
import { AppBrandHeader } from "../components/AppBrandHeader";

type HeavyImageItem = {
  productId: string;
  productTitle: string;
  imageId: string;
  imageUrl: string;
  currentKB: number;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
    select: {
      audits: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { id: true, snapshot: true, completedAt: true },
      },
    },
  });

  const latestAudit = store?.audits[0] ?? null;
  const snapshot = parseAuditSnapshot(latestAudit?.snapshot ?? null);
  const products = getSnapshotProducts(snapshot);
  const heavyTargets = getHeavyImageTargets(products);
  const formatBreakdown = getImageFormatBreakdown(products);
  const pngTargets = getPngImageTargets(products);

  const totalKB = Math.round(
    heavyTargets.reduce((sum, t) => sum + (t.bytes ?? 0), 0) / 1024,
  );

  const images: HeavyImageItem[] = heavyTargets.map((t) => ({
    productId: t.productId,
    productTitle: t.productTitle,
    imageId: t.imageId ?? "",
    imageUrl: t.imageUrl ?? "",
    currentKB: Math.round((t.bytes ?? 0) / 1024),
  }));

  return json({
    shopDomain: session.shop,
    auditId: latestAudit?.id ?? null,
    completedAt: latestAudit?.completedAt ?? null,
    images,
    totalKB,
    formatBreakdown,
    pngCount: pngTargets.length,
  });
};

type OptimizeResult = { resultType: "optimize"; result: BatchOptimizeResult };
type ConvertPngResult = { resultType: "convert-png"; result: PngConvertResult };
type ActionError = { error: string };
type ActionData = OptimizeResult | ConvertPngResult | ActionError | undefined;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const auditId = String(formData.get("auditId") ?? "");
  const intent = String(formData.get("intent") ?? "optimize");

  const audit = await loadAuditForShop(auditId, session.shop);
  if (!audit) {
    return json(
      { error: "Audit not found. Run a fresh audit first." },
      { status: 404 },
    );
  }

  try {
    if (intent === "convert-png") {
      const result = await convertPngImagesWithStats(admin, audit.snapshot, 25);
      return json({ resultType: "convert-png", result } satisfies ConvertPngResult);
    }

    const result = await optimizeImagesWithStats(admin, audit.snapshot, 25);
    return json({ resultType: "optimize", result } satisfies OptimizeResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image processing failed.";
    return json({ error: message }, { status: 500 });
  }
};

export default function ImageOptimizer() {
  const {
    shopDomain,
    auditId,
    images,
    totalKB,
    completedAt,
    formatBreakdown,
    pngCount,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData;
  const navigation = useNavigation();
  const isProcessing = navigation.state === "submitting";

  const resultType = actionData && "resultType" in actionData ? actionData.resultType : undefined;
  const result = actionData && "result" in actionData ? actionData.result : undefined;
  const actionError = actionData && "error" in actionData ? actionData.error : undefined;

  // Determine which intent is currently being submitted
  const submittingIntent: string | undefined =
    isProcessing && navigation.formData
      ? String(navigation.formData.get("intent") ?? "optimize")
      : undefined;

  const hasAnyImages = formatBreakdown.total > 0;

  return (
    <AppPage title="Image Optimizer" shopDomain={shopDomain}>
      <BlockStack gap="500">
        <AppBrandHeader
          title="Image Optimizer"
          subtitle={
            completedAt
              ? `Resize, compress, and convert product images · audit from ${new Date(completedAt).toLocaleDateString()}`
              : "Resize, compress, and convert product images"
          }
        />

        {actionError && (
          <Banner tone="critical" title="Processing failed">
            {actionError}
          </Banner>
        )}

        {!auditId && (
          <Banner tone="warning" title="No audit available">
            Run a full-store audit first to detect oversized images, then return here to
            optimize them.
          </Banner>
        )}

        {/* ── Format Breakdown Card ── */}
        {auditId && hasAnyImages && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Image Format Audit
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Format breakdown across {formatBreakdown.total.toLocaleString()} product
                image{formatBreakdown.total === 1 ? "" : "s"} from your latest audit.
              </Text>

              {/* Format bars */}
              <BlockStack gap="200">
                <FormatRow
                  label="WebP"
                  count={formatBreakdown.webp}
                  total={formatBreakdown.total}
                  tone="success"
                />
                <FormatRow
                  label="JPEG"
                  count={formatBreakdown.jpeg}
                  total={formatBreakdown.total}
                  tone="info"
                />
                <FormatRow
                  label="PNG"
                  count={formatBreakdown.png}
                  total={formatBreakdown.total}
                  tone="attention"
                />
                <FormatRow
                  label="SVG / GIF / Other"
                  count={formatBreakdown.svg + formatBreakdown.gif + formatBreakdown.other}
                  total={formatBreakdown.total}
                  tone="subdued"
                />
              </BlockStack>

              {/* Convert PNGs button */}
              {pngCount > 0 ? (
                <Form method="post">
                  <input type="hidden" name="auditId" value={auditId ?? ""} />
                  <input type="hidden" name="intent" value="convert-png" />
                  <InlineStack gap="200" blockAlign="center" wrap>
                    <Button
                      submit
                      variant="primary"
                      loading={submittingIntent === "convert-png"}
                      disabled={isProcessing}
                    >
                      {submittingIntent === "convert-png"
                        ? `Converting ${pngCount} PNG${pngCount === 1 ? "" : "s"}…`
                        : `Convert ${pngCount} PNG${pngCount === 1 ? "" : "s"} to WebP`}
                    </Button>
                    {submittingIntent === "convert-png" && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        Downloading, converting, and re-uploading — this may take a minute.
                      </Text>
                    )}
                  </InlineStack>
                </Form>
              ) : (
                <Banner tone="success">
                  All product images are already in modern formats (WebP or JPEG). No PNGs
                  to convert.
                </Banner>
              )}

              {submittingIntent === "convert-png" && (
                <ProgressBar progress={50} size="small" tone="highlight" />
              )}
            </BlockStack>
          </Card>
        )}

        {/* ── PNG Conversion Results ── */}
        {result && resultType === "convert-png" && (
          <ResultsCard
            title={`PNG conversion complete`}
            result={result}
            failLabel="failed"
            successLabel="converted"
          />
        )}

        {/* ── Empty state: no images at all ── */}
        {auditId && !hasAnyImages && !result && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                No product images found
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Your latest audit found zero product images. Add images to your products
                first, then return here to optimize them.
              </Text>
            </BlockStack>
          </Card>
        )}

        {/* ── Heavy images card (oversized >500KB) ── */}
        {!result && images.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    {images.length} oversized image{images.length === 1 ? "" : "s"} found
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Total: {totalKB.toLocaleString()} KB across {images.length} product
                    {images.length === 1 ? "" : "s"}. Each will be resized (max 2048px
                    wide) and converted to WebP.
                  </Text>
                </BlockStack>
              </InlineStack>

              <div className="ld-image-optimizer-list">
                {images.map((img) => (
                  <div key={img.productId} className="ld-image-optimizer-row">
                    <div>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {img.productTitle}
                      </Text>
                    </div>
                    <Badge tone="attention">{img.currentKB.toLocaleString()} KB</Badge>
                  </div>
                ))}
              </div>

              <Form method="post">
                <input type="hidden" name="auditId" value={auditId ?? ""} />
                <input type="hidden" name="intent" value="optimize" />
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Button
                    submit
                    variant="primary"
                    loading={submittingIntent === "optimize"}
                    disabled={isProcessing}
                  >
                    {submittingIntent === "optimize"
                      ? `Optimizing ${images.length} image${images.length === 1 ? "" : "s"}…`
                      : `Optimize ${images.length} image${images.length === 1 ? "" : "s"}`}
                  </Button>
                  {submittingIntent === "optimize" && (
                    <Text as="span" variant="bodySm" tone="subdued">
                      Downloading, compressing, and re-uploading — this may take a minute.
                    </Text>
                  )}
                </InlineStack>
              </Form>

              {submittingIntent === "optimize" && (
                <ProgressBar progress={50} size="small" tone="highlight" />
              )}
            </BlockStack>
          </Card>
        )}

        {/* ── Heavy images: empty state ── */}
        {auditId && images.length === 0 && hasAnyImages && !result && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                All clear — no oversized images detected
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Your latest audit found zero product hero images exceeding 500 KB.
                Your images are already well-optimized for fast page loads.
              </Text>
            </BlockStack>
          </Card>
        )}

        {/* ── Optimize Results ── */}
        {result && resultType === "optimize" && (
          <ResultsCard
            title="Optimization complete"
            result={result}
            failLabel="failed"
            successLabel="optimized"
          />
        )}
      </BlockStack>
    </AppPage>
  );
}

/* ── Sub-components ── */

function FormatRow({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "success" | "info" | "attention" | "subdued";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor =
    tone === "success"
      ? "var(--ld-low)"
      : tone === "attention"
        ? "var(--ld-high)"
        : tone === "info"
          ? "#2c6ecb"
          : "var(--ld-muted)";

  return (
    <BlockStack gap="050">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="span" variant="bodySm" fontWeight="semibold">
          {label}
        </Text>
        <InlineStack gap="200" blockAlign="center">
          <Text as="span" variant="bodySm">
            {count.toLocaleString()}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {pct}%
          </Text>
        </InlineStack>
      </InlineStack>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--ld-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: barColor,
            borderRadius: 3,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </BlockStack>
  );
}

function ResultsCard({
  title,
  result,
  successLabel,
  failLabel,
}: {
  title: string;
  result: BatchOptimizeResult | PngConvertResult;
  successLabel: string;
  failLabel: string;
}) {
  return (
    <Card>
      <BlockStack gap="400">
        <Banner
          tone={result.failCount === 0 ? "success" : "warning"}
          title={
            result.failCount === 0
              ? title
              : `${title} with errors`
          }
        >
          <Text as="p" variant="bodyMd">
            {result.successCount} image{result.successCount === 1 ? "" : "s"} {successLabel}
            {result.failCount > 0
              ? `, ${result.failCount} ${failLabel}`
              : ""}
            .
          </Text>
        </Banner>

        {/* Status bar: total reduction */}
        <div className="ld-image-optimizer-savings">
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Before
              </Text>
              <Text as="span" variant="bodyMd">
                {result.totalOriginalKB.toLocaleString()} KB
              </Text>
            </InlineStack>
            <ProgressBar
              progress={
                result.totalOriginalKB > 0
                  ? Math.round(
                      ((result.totalOriginalKB - result.totalOptimizedKB) /
                        result.totalOriginalKB) *
                        100,
                    )
                  : 0
              }
              size="medium"
              tone="success"
            />
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                After
              </Text>
              <Text as="span" variant="bodyMd">
                {result.totalOptimizedKB.toLocaleString()} KB
              </Text>
            </InlineStack>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Saved
              </Text>
              <Badge tone="success">
                {result.totalSavedKB.toLocaleString()} KB
                {result.totalOriginalKB > 0
                  ? ` (${Math.round(
                      (result.totalSavedKB / result.totalOriginalKB) * 100,
                    )}%)`
                  : ""}
              </Badge>
            </InlineStack>
          </BlockStack>
        </div>

        {/* Re-scan prompt */}
        <Banner tone="info">
          Images have been replaced in Shopify. Re-run a full audit to refresh your
          Launch Score and confirm the fixes are reflected in your report.
        </Banner>

        {/* Per-image breakdown */}
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">
            Per-image breakdown
          </Text>
          <div className="ld-image-optimizer-list">
            {result.results.map((r) => (
              <div
                key={r.productId}
                className={`ld-image-optimizer-row ${
                  !r.success ? "ld-image-optimizer-row--error" : ""
                }`}
              >
                <div>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {r.productTitle}
                  </Text>
                  {r.error && (
                    <Text as="p" variant="bodySm" tone="critical">
                      {r.error}
                    </Text>
                  )}
                </div>
                <InlineStack gap="200" blockAlign="center">
                  {r.success ? (
                    <>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {r.originalKB.toLocaleString()} KB
                      </Text>
                      <Text as="span" variant="bodySm">→</Text>
                      <Badge tone="success">
                        {r.optimizedKB.toLocaleString()} KB
                      </Badge>
                      <Badge tone="success">
                        −{r.savedKB.toLocaleString()} KB
                      </Badge>
                    </>
                  ) : (
                    <Badge tone="critical">Failed</Badge>
                  )}
                </InlineStack>
              </div>
            ))}
          </div>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
