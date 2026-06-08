import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Text,
  Badge,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  isAdmin,
  isPromotionActive,
  enablePromotion,
  disablePromotion,
  getSetting,
} from "../lib/admin.server";
import { AppPage } from "../components/AppPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const email = session.email;

  if (!isAdmin(email)) {
    throw new Response("Not authorized", { status: 403 });
  }

  const [promotionActive, promotionEndsAt, storeCount, auditCount, plusCount] =
    await Promise.all([
      isPromotionActive(),
      getSetting("promotion_ends_at"),
      prisma.store.count({ where: { uninstalledAt: null } }),
      prisma.audit.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
    ]);

  return json({
    shopDomain: session.shop,
    email,
    promotionActive,
    promotionEndsAt,
    storeCount,
    auditCount,
    plusCount,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!isAdmin(session.email)) {
    return json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "enable-promotion") {
    const endsAt = formData.get("endsAt");
    const endsAtValue =
      endsAt && String(endsAt).trim() ? String(endsAt).trim() : undefined;

    // Parse optionally — if empty string or not provided, it's indefinite
    if (endsAtValue) {
      // Validate it's a real date
      const parsed = new Date(endsAtValue);
      if (isNaN(parsed.getTime())) {
        return json({ error: "Invalid end date — use YYYY-MM-DD format." });
      }
    }

    await enablePromotion(endsAtValue || null);
    return json({ success: true, message: "Promotion enabled." });
  }

  if (intent === "disable-promotion") {
    await disablePromotion();
    return json({ success: true, message: "Promotion disabled." });
  }

  return json({ error: "Unknown action." });
};

export default function AdminPanel() {
  const {
    shopDomain,
    email,
    promotionActive,
    promotionEndsAt,
    storeCount,
    auditCount,
    plusCount,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const feedback =
    actionData && "success" in actionData && actionData.success
      ? { tone: "success" as const, message: actionData.message as string }
      : actionData && "error" in actionData
        ? { tone: "critical" as const, message: actionData.error as string }
        : null;

  return (
    <AppPage title="Admin" shopDomain={shopDomain}>
      <BlockStack gap="500">
        {/* ── Header ── */}
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <Text as="h2" variant="headingMd">
                Admin Panel
              </Text>
              <Badge tone="enabled">Admin</Badge>
            </InlineStack>
            <Text as="p" variant="bodyMd" tone="subdued">
              Signed in as <strong>{email}</strong>. Settings apply globally to
              all stores.
            </Text>
          </BlockStack>
        </Card>

        {/* ── Feedback ── */}
        {feedback && (
          <Banner
            tone={feedback.tone === "success" ? "success" : "critical"}
            title={feedback.tone === "success" ? "Saved" : "Error"}
          >
            {feedback.message}
          </Banner>
        )}

        {/* ── Promotion Mode ── */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Promotion Mode
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  When active, all stores get free access — Audit Plus features,
                  full report unlocks, and PDFs are free for everyone.
                </Text>
              </BlockStack>
              <Badge tone={promotionActive ? "success" : undefined}>
                {promotionActive ? "Active" : "Inactive"}
              </Badge>
            </InlineStack>

            {promotionActive && (
              <Banner tone="success" title="Promotion is live">
                {promotionEndsAt
                  ? `Ends on ${new Date(promotionEndsAt).toLocaleDateString()}. All billing gates are bypassed.`
                  : "Indefinite promotion — all billing gates are bypassed until you turn it off."}
              </Banner>
            )}

            {!promotionActive ? (
              <Form method="post">
                <input type="hidden" name="intent" value="enable-promotion" />
                <BlockStack gap="300">
                  <TextField
                    label="End date (optional)"
                    type="date"
                    name="endsAt"
                    autoComplete="off"
                    helpText="Leave blank for indefinite promotion. Set a date to auto-remind yourself to turn it off."
                    disabled={isSubmitting}
                  />
                  <InlineStack gap="200" blockAlign="center" wrap>
                    <Button submit variant="primary" loading={isSubmitting}>
                      Enable free promotion
                    </Button>
                    <Text as="span" variant="bodySm" tone="subdued">
                      This immediately makes everything free for all stores.
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Form>
            ) : (
              <Form method="post">
                <input type="hidden" name="intent" value="disable-promotion" />
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Button
                    submit
                    variant="primary"
                    tone="critical"
                    loading={isSubmitting}
                  >
                    Disable promotion
                  </Button>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Restores normal billing — only paying subscribers get Audit
                    Plus features.
                  </Text>
                </InlineStack>
              </Form>
            )}
          </BlockStack>
        </Card>

        {/* ── Stats ── */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Platform Stats
            </Text>
            <div className="ld-severity-grid">
              <div className="ld-severity-stat ld-severity-stat--low">
                <div className="ld-severity-stat-value">
                  {storeCount.toLocaleString()}
                </div>
                <div className="ld-severity-stat-label">Stores</div>
              </div>
              <div className="ld-severity-stat ld-severity-stat--medium">
                <div className="ld-severity-stat-value">
                  {auditCount.toLocaleString()}
                </div>
                <div className="ld-severity-stat-label">Audits</div>
              </div>
              <div className="ld-severity-stat ld-severity-stat--high">
                <div className="ld-severity-stat-value">
                  {plusCount.toLocaleString()}
                </div>
                <div className="ld-severity-stat-label">Active Plus</div>
              </div>
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
    </AppPage>
  );
}
