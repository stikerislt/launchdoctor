import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigate, useNavigation, useSubmit } from "@remix-run/react";
import { useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  List,
  Modal,
  Text,
  TextField,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { hasAuditPlus } from "../lib/billing.server";
import { loadAuditForShop, resolveScoresFromFindings } from "../lib/audit-access.server";
import { buildFixPreviews } from "../lib/fixes/preview.server";
import {
  dismissAllFindings,
  dismissFix,
  getDismissedFixIds,
  getDismissedRuleCodes,
  restoreAllDismissals,
  restoreFix,
} from "../lib/fixes/dismissals.server";
import { isDevBillingBypassEnabled } from "../lib/billing.server";
import { applyFix, FIX_IDS } from "../lib/fixes/registry.server";
import type { FixId, FixPreview, ProductSeoDraft } from "../lib/fixes/types";
import { FIX_RULE_CODES, PRODUCT_SEO_EDIT_LIMIT } from "../lib/fixes/types";
import { FIX_APPLY_LABELS } from "../lib/fixes/labels";
import {
  describeProductSeoChanges,
  productSeoInitialEditState,
  productSeoSaveBlockedReason,
  productSeoSavable,
  productSeoSuggestionsApplied,
} from "../lib/fixes/product-seo-ui";
import { resolveProductSeoUpdatesFromForm } from "../lib/fixes/product-seo.server";
import { sessionHasScope } from "../lib/fix-access-errors.server";
import { enqueueAudit } from "../lib/queue.server";
import prisma from "../db.server";
import { AppPage } from "../components/AppPage";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { shopifyAppPath } from "../lib/app-routes";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const audit = await loadAuditForShop(params.auditId!, session.shop);

  if (!audit) {
    throw new Response("Audit not found", { status: 404 });
  }

  if (audit.status !== "COMPLETED") {
    throw redirect(shopifyAppPath(`/app/audit/${audit.id}`, session.shop));
  }

  const [auditPlusActive, dismissedFixIds, dismissedRuleCodes] = await Promise.all([
    hasAuditPlus(audit.storeId),
    getDismissedFixIds(audit.storeId),
    getDismissedRuleCodes(audit.storeId),
  ]);
  const scores = resolveScoresFromFindings(
    audit.findings,
    audit.launchScore,
    dismissedRuleCodes,
  );
  const allFixes = auditPlusActive ? buildFixPreviews(audit.snapshot) : [];
  const fixes = allFixes.filter((fix) => !dismissedFixIds.has(fix.id));
  const dismissedFixes = allFixes.filter((fix) => dismissedFixIds.has(fix.id));

  const hasWriteInventoryScope = sessionHasScope(session.scope, "write_inventory");

  return json({
    shopDomain: session.shop,
    auditId: audit.id,
    auditPlusActive,
    fixes,
    dismissedFixes,
    launchScore: scores.launchScore,
    completedAt: audit.completedAt,
    devBillingBypass: isDevBillingBypassEnabled(),
    rawFindingCount: audit.findings.length,
    hasWriteInventoryScope,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const audit = await loadAuditForShop(params.auditId!, session.shop);

  if (!audit) {
    throw new Response("Audit not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "apply");
  const fixId = formData.get("fixId") as FixId;

  const auditPlusActive = await hasAuditPlus(audit.storeId);
  if (!auditPlusActive) {
    return json(
      { fixId, error: "Audit Plus is required to apply fixes.", success: false },
      { status: 403 },
    );
  }

  if (intent === "dismiss-all" || intent === "restore-all") {
    if (!isDevBillingBypassEnabled()) {
      return json({ error: "Dev only.", success: false }, { status: 403 });
    }
    if (intent === "dismiss-all") {
      const ruleCodes = [...new Set(audit.findings.map((finding) => finding.ruleCode))];
      const fixIds = buildFixPreviews(audit.snapshot).map((preview) => preview.id);
      await dismissAllFindings(audit.storeId, ruleCodes, fixIds);
    } else {
      await restoreAllDismissals(audit.storeId);
    }
    return redirect(shopifyAppPath(`/app/fixes/${audit.id}`, session.shop));
  }

  if (intent === "dismiss" || intent === "restore") {
    if (!FIX_IDS.includes(fixId)) {
      return json({ fixId, error: "Unknown fix type.", success: false }, { status: 400 });
    }

    if (intent === "dismiss") {
      await dismissFix(audit.storeId, fixId);
    } else {
      await restoreFix(audit.storeId, fixId);
    }

    return redirect(shopifyAppPath(`/app/fixes/${audit.id}`, session.shop));
  }

  // Explicit, merchant-triggered re-scan. Applying individual fixes no longer
  // enqueues an audit (see below) — the merchant batches fixes and re-scans once.
  if (intent === "rescan") {
    const newAudit = await prisma.audit.create({
      data: {
        storeId: audit.storeId,
        status: "PENDING",
        triggeredBy: "MANUAL",
      },
    });
    await enqueueAudit(newAudit.id, audit.storeId);
    return redirect(
      shopifyAppPath(`/app/audit/${newAudit.id}?rescan=1`, session.shop),
    );
  }

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");

  if (!FIX_IDS.includes(fixId)) {
    return json({ fixId, error: "Unknown fix type.", success: false }, { status: 400 });
  }

  try {
    let productSeoUpdates;
    if (fixId === "product-seo") {
      productSeoUpdates = resolveProductSeoUpdatesFromForm(
        audit.snapshot,
        String(formData.get("productSeo") ?? "[]"),
      );
    }

    const result = await applyFix(admin, fixId, audit.snapshot, {
      title,
      description,
      productSeoUpdates,
    });

    // Applying a fix no longer auto-triggers a full re-audit. Re-collecting the
    // whole store on every small change is expensive (Shopify GraphQL + browser
    // checks + all rules) and pulls the merchant out of Fix Center to wait. They
    // re-scan once, via the "Re-scan store" action, after batching their fixes.
    return json({
      fixId,
      success: result.success,
      message: result.message,
      errors: result.errors,
      appliedCount: result.appliedCount,
      storeChanged: result.appliedCount > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fix failed.";
    return json({ fixId, error: message, success: false }, { status: 400 });
  }
};

export default function FixCenter() {
  const {
    shopDomain,
    auditId,
    auditPlusActive,
    fixes,
    dismissedFixes,
    launchScore,
    completedAt,
    devBillingBypass,
    rawFindingCount,
    hasWriteInventoryScope,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();

  const submittingFixId =
    navigation.state !== "idle"
      ? (navigation.formData?.get("fixId") as FixId | undefined)
      : undefined;
  const isSubmitting = navigation.state === "submitting";
  const isRescanning =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "rescan";

  type FixFeedback = {
    tone: "success" | "warning" | "critical";
    title: string;
    message: string;
    errors?: string[];
  };

  const [fixFeedback, setFixFeedback] = useState<Record<string, FixFeedback>>({});
  const [appliedFixes, setAppliedFixes] = useState<Set<FixId>>(new Set());
  const [dismissTarget, setDismissTarget] = useState<FixPreview | null>(null);

  const homepageFix = fixes.find((fix) => fix.id === "homepage-seo");
  const productSeoFix = fixes.find((fix) => fix.id === "product-seo");
  const [seoTitle, setSeoTitle] = useState(
    homepageFix?.suggestions?.title?.[0] ?? homepageFix?.suggestions?.currentTitle ?? "",
  );
  const [seoDescription, setSeoDescription] = useState(
    homepageFix?.suggestions?.description?.[0] ??
      homepageFix?.suggestions?.currentDescription ??
      "",
  );
  const [productSeoEdits, setProductSeoEdits] = useState<
    Record<string, { productTitle: string; seoTitle: string; seoDescription: string }>
  >({});

  useEffect(() => {
    if (!productSeoFix?.productSeoDrafts?.length) return;

    setProductSeoEdits(
      Object.fromEntries(
        productSeoFix.productSeoDrafts.map((draft) => [
          draft.productId,
          {
            productTitle: draft.productTitle,
            seoTitle: draft.currentSeoTitle,
            seoDescription: draft.currentSeoDescription,
          },
        ]),
      ),
    );
  }, [productSeoFix]);

  function getProductSeoEdit(draft: ProductSeoDraft) {
    return (
      productSeoEdits[draft.productId] ?? productSeoInitialEditState(draft)
    );
  }

  const productSeoPayload =
    productSeoFix?.productSeoDrafts
      ?.filter((draft) => productSeoSavable(draft, getProductSeoEdit(draft)))
      .map((draft) => {
        const edit = getProductSeoEdit(draft);
        return {
          productId: draft.productId,
          productTitle:
            draft.hasBadProductTitle
              ? edit.productTitle.trim()
              : edit.productTitle.trim() !== draft.productTitle.trim()
                ? edit.productTitle.trim()
                : undefined,
          seoTitle: edit.seoTitle.trim(),
          seoDescription: edit.seoDescription.trim(),
        };
      }) ?? [];

  const productSeoSavableCount = productSeoPayload.length;

  const productSeoCanSave = productSeoSavableCount > 0;

  const productSeoBlockedReasons =
    productSeoFix?.productSeoDrafts
      ?.map((draft) => productSeoSaveBlockedReason(draft, getProductSeoEdit(draft)))
      .filter((reason): reason is string => Boolean(reason)) ?? [];

  function updateProductSeoField(
    productId: string,
    field: "productTitle" | "seoTitle" | "seoDescription",
    value: string,
  ) {
    setProductSeoEdits((prev) => ({
      ...prev,
      [productId]: {
        productTitle: prev[productId]?.productTitle ?? "",
        seoTitle: prev[productId]?.seoTitle ?? "",
        seoDescription: prev[productId]?.seoDescription ?? "",
        [field]: value,
      },
    }));
  }

  function applyProductSeoSuggestion(draft: ProductSeoDraft) {
    setProductSeoEdits((prev) => ({
      ...prev,
      [draft.productId]: {
        productTitle: draft.hasBadProductTitle
          ? draft.suggestedProductTitle
          : draft.productTitle,
        seoTitle: draft.suggestedSeoTitle,
        seoDescription: draft.suggestedSeoDescription,
      },
    }));
  }

  useEffect(() => {
    if (!actionData || !("fixId" in actionData) || !actionData.fixId) return;

    const fixId = actionData.fixId as FixId;

    if ("error" in actionData && actionData.error) {
      setFixFeedback((prev) => ({
        ...prev,
        [fixId]: {
          tone: "critical",
          title: "Fix failed",
          message: String(actionData.error),
        },
      }));
      return;
    }

    if (!("message" in actionData) || !actionData.message) return;

    const hasErrors = "errors" in actionData && actionData.errors.length > 0;
    const appliedCount =
      "appliedCount" in actionData ? (actionData.appliedCount ?? 0) : 0;

    setFixFeedback((prev) => ({
      ...prev,
      [fixId]: {
        tone: actionData.success && !hasErrors ? "success" : "warning",
        title:
          appliedCount > 0
            ? actionData.success && !hasErrors
              ? "Fix applied"
              : "Partially applied"
            : "Nothing to update",
        message:
          actionData.message +
          ("storeChanged" in actionData && actionData.storeChanged
            ? " Re-scan your store to refresh your Launch Score."
            : ""),
        errors: hasErrors ? actionData.errors : undefined,
      },
    }));

    if (actionData.success && appliedCount > 0) {
      setAppliedFixes((prev) => new Set(prev).add(fixId));
    }
  }, [actionData]);

  function confirmDismissFix() {
    if (!dismissTarget) return;
    submit(
      { intent: "dismiss", fixId: dismissTarget.id },
      { method: "post" },
    );
    setDismissTarget(null);
  }

  function restoreDismissedFix(fixId: FixId) {
    submit({ intent: "restore", fixId }, { method: "post" });
  }

  return (
    <AppPage
      title="Fix Center"
      shopDomain={shopDomain}
      backTo="/app/audit-plus"
      backLabel="Audit Plus"
    >
      <BlockStack gap="500">
        <AppBrandHeader
          title="Fix Center"
          subtitle={
            completedAt
              ? `Audit Plus quick fixes · score ${launchScore ?? "—"} · ${new Date(completedAt).toLocaleDateString()}`
              : "Audit Plus quick fixes"
          }
        />

        {!auditPlusActive && (
          <Banner tone="warning" title="Audit Plus required">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                One-click fixes are included with Audit Plus. Subscribe to apply changes
                automatically instead of fixing issues manually.
              </Text>
              <Button
                onClick={() => navigate(shopifyAppPath(`/app/billing?auditId=${auditId}`, shopDomain))}
              >
                View Audit Plus plans
              </Button>
            </BlockStack>
          </Banner>
        )}

        {auditPlusActive && (
          <Banner tone={appliedFixes.size > 0 ? "success" : "info"}>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                {appliedFixes.size > 0
                  ? "Your changes are live in Shopify. Apply any other fixes you need, then re-scan once to refresh your Launch Score and confirm the issues are resolved."
                  : "These fixes apply changes directly to your store. Apply the ones you need, then re-scan to refresh your Launch Score — Fix Center will reflect what Shopify reports now."}
              </Text>
              <Form method="post">
                <input type="hidden" name="intent" value="rescan" />
                <Button
                  submit
                  variant={appliedFixes.size > 0 ? "primary" : "secondary"}
                  loading={isRescanning}
                  disabled={isSubmitting && !isRescanning}
                >
                  Re-scan store
                </Button>
              </Form>
            </BlockStack>
          </Banner>
        )}

        {auditPlusActive && !hasWriteInventoryScope && fixes.some((f) => f.id === "enable-inventory") && (
          <Banner tone="warning" title="Inventory permission update required">
            <Text as="p" variant="bodyMd">
              Enable inventory tracking needs the <code>write_inventory</code> scope.
              Re-open Launch Doctor from Shopify Admin → Apps and approve updated
              permissions when prompted. Your staff account must also be allowed to
              manage inventory.
            </Text>
          </Banner>
        )}

        {devBillingBypass && rawFindingCount > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Dev: dismiss all issues
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Dismiss every finding and fix pack for this store. Launch Score updates on
                save; restore one-by-one below or all at once.
              </Text>
              <InlineStack gap="200" wrap>
                <Form method="post">
                  <input type="hidden" name="intent" value="dismiss-all" />
                  <Button submit variant="primary" loading={isSubmitting}>
                    {`Dismiss all (${rawFindingCount} checks)`}
                  </Button>
                </Form>
                {(dismissedFixes.length > 0 || fixes.length === 0) && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="restore-all" />
                    <Button submit loading={isSubmitting}>
                      Restore all dismissed
                    </Button>
                  </Form>
                )}
                <Button
                  onClick={() => navigate(shopifyAppPath(`/app/audit/${auditId}`, shopDomain))}
                >
                  Manage on audit report
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {auditPlusActive && fixes.length === 0 && dismissedFixes.length === 0 && (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                No quick fixes available
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                This audit has no auto-fixable issues in the current sample. Run a fresh audit
                after catalog changes, or review the full report for guided manual fixes.
              </Text>
              <Button onClick={() => navigate(shopifyAppPath(`/app/audit/${auditId}`, shopDomain))}>
                Back to audit report
              </Button>
            </BlockStack>
          </Card>
        )}

        {auditPlusActive && fixes.length === 0 && dismissedFixes.length > 0 && (
          <Banner tone="success">
            All active quick fixes are either applied or dismissed. Restore dismissed items below
            if you want Launch Doctor to track them again.
          </Banner>
        )}

        {fixes.map((fix) => {
          const feedback = fixFeedback[fix.id];
          const isApplying = submittingFixId === fix.id;
          const wasApplied = appliedFixes.has(fix.id);

          return (
          <Card key={fix.id}>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="start" wrap>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    {fix.title}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {fix.description}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {fix.itemCount} item{fix.itemCount === 1 ? "" : "s"} detected
                  </Text>
                </BlockStack>
                {wasApplied && !isApplying && (
                  <Badge tone="success">Applied</Badge>
                )}
                {isApplying && <Badge tone="info">Applying…</Badge>}
              </InlineStack>

              {!fix.guided && fix.id !== "product-seo" && fix.items.length > 0 && (
                <List type="bullet">
                  {fix.items.map((item) => (
                    <List.Item key={item.id}>
                      {item.label}
                      {item.detail ? ` — ${item.detail}` : ""}
                    </List.Item>
                  ))}
                  {fix.itemCount > fix.items.length && (
                    <List.Item>
                      + {fix.itemCount - fix.items.length} more
                    </List.Item>
                  )}
                </List>
              )}

              {fix.guided && auditPlusActive && (
                <BlockStack gap="300">
                  <BlockStack gap="200">
                    {fix.items.map((item) => (
                      <InlineStack
                        key={item.id}
                        align="space-between"
                        blockAlign="center"
                        wrap
                        gap="200"
                      >
                        <Text as="span" variant="bodyMd">
                          {item.label}
                          {item.detail ? ` — ${item.detail}` : ""}
                        </Text>
                        {item.adminUrl && (
                          <Button url={item.adminUrl} target="_blank" size="slim">
                            Add image →
                          </Button>
                        )}
                      </InlineStack>
                    ))}
                    {fix.itemCount > fix.items.length && (
                      <Text as="p" variant="bodySm" tone="subdued">
                        + {fix.itemCount - fix.items.length} more product
                        {fix.itemCount - fix.items.length === 1 ? "" : "s"} without an
                        image. Open Products to see the full list.
                      </Text>
                    )}
                  </BlockStack>

                  {feedback && (
                    <Banner
                      tone={feedback.tone}
                      title={feedback.title}
                      onDismiss={() =>
                        setFixFeedback((prev) => {
                          const next = { ...prev };
                          delete next[fix.id];
                          return next;
                        })
                      }
                    >
                      <Text as="p" variant="bodyMd">
                        {feedback.message}
                      </Text>
                    </Banner>
                  )}

                  <InlineStack gap="200" blockAlign="center" wrap>
                    {fix.guidedActionUrl && (
                      <Button
                        url={fix.guidedActionUrl}
                        target="_blank"
                        variant="primary"
                      >
                        {fix.guidedActionLabel ?? "Open in Shopify"} →
                      </Button>
                    )}
                    <Button onClick={() => setDismissTarget(fix)} disabled={isSubmitting}>
                      Dismiss
                    </Button>
                    <Text as="span" variant="bodySm" tone="subdued">
                      Opens Shopify admin in a new tab. Re-scan after adding images to
                      update your Launch Score.
                    </Text>
                  </InlineStack>
                </BlockStack>
              )}

              {fix.id === "enable-inventory" && auditPlusActive && !hasWriteInventoryScope && (
                <Banner tone="warning">
                  Re-open this app from Shopify Admin → Apps to grant inventory write access,
                  then try again. Staff accounts need permission to manage inventory.
                </Banner>
              )}

              {fix.id === "product-seo" && auditPlusActive && fix.productSeoDrafts && (
                <BlockStack gap="300">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Only products you edit are saved — you don&apos;t need to fill every row.
                    Use <strong>Fill with suggested values</strong> on the products you want,
                    then save (up to {PRODUCT_SEO_EDIT_LIMIT} per batch).
                    {fix.itemCount > fix.productSeoDrafts.length
                      ? ` ${fix.itemCount - fix.productSeoDrafts.length} more product${fix.itemCount - fix.productSeoDrafts.length === 1 ? "" : "s"} can be fixed in a follow-up visit.`
                      : ""}
                  </Text>

                  <div className="ld-product-seo-list">
                    {fix.productSeoDrafts.map((draft) => {
                      const edit = getProductSeoEdit(draft);
                      const suggestionsFilled = productSeoSuggestionsApplied(draft, edit);
                      const willSave = productSeoSavable(draft, edit);
                      const savePreview = describeProductSeoChanges(draft, edit);
                      const blockedReason = productSeoSaveBlockedReason(draft, edit);

                      return (
                        <div key={draft.productId} className="ld-product-seo-item">
                          <BlockStack gap="300">
                            <InlineStack align="space-between" blockAlign="center" wrap>
                              <InlineStack gap="200" blockAlign="center" wrap>
                                <Text as="h3" variant="headingSm">
                                  {draft.productTitle}
                                </Text>
                                {draft.hasBadProductTitle && (
                                  <Badge tone="warning">Generic name</Badge>
                                )}
                                {draft.missingTitle && (
                                  <Badge tone="attention">Missing SEO title</Badge>
                                )}
                                {draft.missingDescription && (
                                  <Badge tone="attention">Missing description</Badge>
                                )}
                                {willSave && <Badge tone="success">Will save</Badge>}
                              </InlineStack>
                              <Button
                                size="slim"
                                onClick={() => applyProductSeoSuggestion(draft)}
                                disabled={isSubmitting || suggestionsFilled}
                              >
                                {suggestionsFilled
                                  ? "Suggestions applied"
                                  : "Fill with suggested values"}
                              </Button>
                            </InlineStack>

                            <div className="ld-product-seo-preview">
                              <Text as="p" variant="bodySm" fontWeight="semibold">
                                Suggested values (what Fill will set)
                              </Text>
                              <List type="bullet">
                                {draft.hasBadProductTitle && (
                                  <List.Item>
                                    Product name: {draft.suggestedProductTitle}
                                    {draft.productTitle !== draft.suggestedProductTitle
                                      ? ` (currently “${draft.productTitle}”)`
                                      : ""}
                                  </List.Item>
                                )}
                                <List.Item>
                                  SEO title: {draft.suggestedSeoTitle}
                                  {draft.currentSeoTitle
                                    ? ` (currently “${draft.currentSeoTitle}”)`
                                    : " (currently empty)"}
                                </List.Item>
                                <List.Item>
                                  Meta description:{" "}
                                  {draft.suggestedSeoDescription.length > 80
                                    ? `${draft.suggestedSeoDescription.slice(0, 80)}…`
                                    : draft.suggestedSeoDescription}
                                  {draft.currentSeoDescription
                                    ? " (has existing text)"
                                    : " (currently empty)"}
                                </List.Item>
                              </List>
                            </div>

                            {draft.hasBadProductTitle && (
                              <TextField
                                label="Product name"
                                value={edit.productTitle}
                                onChange={(value) =>
                                  updateProductSeoField(draft.productId, "productTitle", value)
                                }
                                autoComplete="off"
                                helpText={`Suggested: ${draft.suggestedProductTitle}`}
                                disabled={isSubmitting}
                              />
                            )}

                            <TextField
                              label="SEO title"
                              value={edit.seoTitle}
                              onChange={(value) =>
                                updateProductSeoField(draft.productId, "seoTitle", value)
                              }
                              autoComplete="off"
                              helpText={`${edit.seoTitle.length}/70 characters recommended`}
                              disabled={isSubmitting}
                            />

                            <TextField
                              label="Meta description"
                              value={edit.seoDescription}
                              onChange={(value) =>
                                updateProductSeoField(draft.productId, "seoDescription", value)
                              }
                              autoComplete="off"
                              multiline={3}
                              helpText={`${edit.seoDescription.length}/320 characters recommended`}
                              disabled={isSubmitting}
                            />

                            {willSave ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                Will save: {savePreview.join(" · ")}
                              </Text>
                            ) : blockedReason ? (
                              <Text as="p" variant="bodySm" tone="critical">
                                {blockedReason}
                              </Text>
                            ) : (
                              <Text as="p" variant="bodySm" tone="subdued">
                                Skipped until you fill or edit this product.
                              </Text>
                            )}
                          </BlockStack>
                        </div>
                      );
                    })}
                  </div>
                </BlockStack>
              )}

              {fix.id === "product-seo" && !auditPlusActive && fix.items.length > 0 && (
                <List type="bullet">
                  {fix.items.map((item) => (
                    <List.Item key={item.id}>
                      {item.label}
                      {item.detail ? ` — ${item.detail}` : ""}
                    </List.Item>
                  ))}
                  {fix.itemCount > fix.items.length && (
                    <List.Item>
                      + {fix.itemCount - fix.items.length} more
                    </List.Item>
                  )}
                </List>
              )}

              {fix.id === "homepage-seo" && auditPlusActive && (
                <BlockStack gap="300">
                  <TextField
                    label="Homepage title"
                    value={seoTitle}
                    onChange={setSeoTitle}
                    autoComplete="off"
                    helpText="Shown in browser tabs and search results."
                    disabled={isSubmitting}
                  />
                  <TextField
                    label="Meta description"
                    value={seoDescription}
                    onChange={setSeoDescription}
                    autoComplete="off"
                    multiline={3}
                    helpText="Short summary shown in Google search snippets."
                    disabled={isSubmitting}
                  />
                  {fix.suggestions?.title && fix.suggestions.title.length > 0 && (
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Title suggestions
                      </Text>
                      <InlineStack gap="200" wrap>
                        {fix.suggestions.title.slice(0, 3).map((suggestion) => (
                          <Button key={suggestion} onClick={() => setSeoTitle(suggestion)}>
                            {suggestion.length > 42 ? `${suggestion.slice(0, 42)}…` : suggestion}
                          </Button>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  )}
                  {fix.suggestions?.description && fix.suggestions.description.length > 0 && (
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Description suggestions
                      </Text>
                      <InlineStack gap="200" wrap>
                        {fix.suggestions.description.slice(0, 3).map((suggestion) => (
                          <Button key={suggestion} onClick={() => setSeoDescription(suggestion)}>
                            {suggestion.length > 42 ? `${suggestion.slice(0, 42)}…` : suggestion}
                          </Button>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  )}
                </BlockStack>
              )}

              {!fix.guided && feedback && (
                <Banner
                  tone={feedback.tone}
                  title={feedback.title}
                  onDismiss={() =>
                    setFixFeedback((prev) => {
                      const next = { ...prev };
                      delete next[fix.id];
                      return next;
                    })
                  }
                >
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">
                      {feedback.message}
                    </Text>
                    {feedback.errors && feedback.errors.length > 0 && (
                      <List type="bullet">
                        {feedback.errors.slice(0, 5).map((error) => (
                          <List.Item key={error}>{error}</List.Item>
                        ))}
                      </List>
                    )}
                  </BlockStack>
                </Banner>
              )}

              {auditPlusActive && !fix.guided && (
                <Form method="post">
                  <input type="hidden" name="intent" value="apply" />
                  <input type="hidden" name="fixId" value={fix.id} />
                  {fix.id === "homepage-seo" && (
                    <>
                      <input type="hidden" name="title" value={seoTitle} />
                      <input type="hidden" name="description" value={seoDescription} />
                    </>
                  )}
                  {fix.id === "product-seo" && (
                    <input
                      type="hidden"
                      name="productSeo"
                      value={JSON.stringify(productSeoPayload)}
                    />
                  )}
                  {fix.id === "product-seo" && !productSeoCanSave && productSeoBlockedReasons.length > 0 && (
                    <Banner tone="warning">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd">
                          Fix the products you started editing, or leave them unchanged to skip
                          them. You can save as soon as at least one product is ready.
                        </Text>
                        <List type="bullet">
                          {productSeoBlockedReasons.map((reason) => (
                            <List.Item key={reason}>{reason}</List.Item>
                          ))}
                        </List>
                      </BlockStack>
                    </Banner>
                  )}
                  {fix.id === "product-seo" && !productSeoCanSave && productSeoBlockedReasons.length === 0 && (
                    <Banner tone="info">
                      <Text as="p" variant="bodyMd">
                        Edit or use Fill on at least one product to enable Save. Other products
                        in the list can stay as-is.
                      </Text>
                    </Banner>
                  )}
                  {fix.id === "product-seo" && productSeoCanSave && productSeoBlockedReasons.length > 0 && (
                    <Banner tone="info">
                      <Text as="p" variant="bodyMd">
                        Saving {productSeoSavableCount} product
                        {productSeoSavableCount === 1 ? "" : "s"}. Products you started but
                        didn&apos;t finish will be skipped.
                      </Text>
                    </Banner>
                  )}
                  <InlineStack gap="200" blockAlign="center" wrap>
                    <Button
                      submit
                      variant="primary"
                      loading={isApplying}
                      disabled={
                        (isSubmitting && !isApplying) ||
                        (fix.id === "product-seo" && !productSeoCanSave) ||
                        (fix.id === "enable-inventory" && !hasWriteInventoryScope)
                      }
                    >
                      {isApplying
                        ? "Applying to your store…"
                        : wasApplied
                          ? "Apply again"
                          : fix.id === "product-seo" && productSeoSavableCount > 0
                            ? `Save ${productSeoSavableCount} product${productSeoSavableCount === 1 ? "" : "s"}`
                            : FIX_APPLY_LABELS[fix.id](fix.itemCount)}
                    </Button>
                    <Button
                      onClick={() => setDismissTarget(fix)}
                      disabled={isSubmitting}
                    >
                      Dismiss
                    </Button>
                    {isApplying && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        This may take a minute for large catalogs.
                      </Text>
                    )}
                  </InlineStack>
                </Form>
              )}
            </BlockStack>
          </Card>
          );
        })}

        {auditPlusActive && dismissedFixes.length > 0 && (
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Dismissed fixes
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              These items are hidden from Fix Center and no longer count against your Launch
              Score. Restore them if you want Launch Doctor to track the issue again.
            </Text>
            {dismissedFixes.map((fix) => (
              <Card key={`dismissed-${fix.id}`}>
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm">
                      {fix.title}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {fix.itemCount} item{fix.itemCount === 1 ? "" : "s"} · dismissed from score
                    </Text>
                  </BlockStack>
                  <Button onClick={() => restoreDismissedFix(fix.id)} disabled={isSubmitting}>
                    Restore
                  </Button>
                </InlineStack>
              </Card>
            ))}
          </BlockStack>
        )}

        <Modal
          open={dismissTarget != null}
          onClose={() => setDismissTarget(null)}
          title={dismissTarget ? `Dismiss “${dismissTarget.title}”?` : "Dismiss fix"}
          primaryAction={{
            content: "Dismiss this fix",
            destructive: true,
            onAction: confirmDismissFix,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setDismissTarget(null) },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                Please confirm you want to dismiss this fix suggestion. Here is exactly what
                will happen:
              </Text>
              <List type="bullet">
                <List.Item>
                  <strong>Your Shopify store will not change.</strong> Nothing is edited on
                  your live storefront.
                </List.Item>
                <List.Item>
                  Launch Doctor will stop suggesting this fix pack in Fix Center.
                </List.Item>
                <List.Item>
                  Related audit findings will be hidden from your report and your Launch Score
                  will increase as if you resolved them on your own.
                </List.Item>
                <List.Item>
                  You can restore this fix anytime from the Dismissed fixes section below.
                </List.Item>
              </List>
              {dismissTarget && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Affects {FIX_RULE_CODES[dismissTarget.id]?.length ?? dismissTarget.ruleCodes.length}{" "}
                  audit check
                  {(FIX_RULE_CODES[dismissTarget.id]?.length ?? dismissTarget.ruleCodes.length) === 1
                    ? ""
                    : "s"}
                  : {FIX_RULE_CODES[dismissTarget.id]?.join(", ") ?? dismissTarget.ruleCodes.join(", ")}
                </Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </AppPage>
  );
}
