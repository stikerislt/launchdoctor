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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  isAdmin,
  isPromotionActive,
  enablePromotion,
  disablePromotion,
  getSetting,
  setSetting,
} from "../lib/admin.server";
import { AppPage } from "../components/AppPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const email = session.email;

  if (!isAdmin(email, session.shop)) {
    throw new Response("Not authorized", { status: 403 });
  }

  const [promotionActive, promotionEndsAt, promotionMessage, storeCount, auditCount, plusCount] =
    await Promise.all([
      isPromotionActive(),
      getSetting("promotion_ends_at"),
      getSetting("promotion_message"),
      prisma.store.count({ where: { uninstalledAt: null } }),
      prisma.audit.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
    ]);

  return json({
    shopDomain: session.shop,
    email,
    promotionActive,
    promotionEndsAt,
    promotionMessage,
    storeCount,
    auditCount,
    plusCount,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!isAdmin(session.email, session.shop)) {
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

  if (intent === "save-message") {
    const message = String(formData.get("message") ?? "").trim();
    await setSetting("promotion_message", message);
    return json({ success: true, message: "Banner message saved." });
  }

  return json({ error: "Unknown action." });
};

export default function AdminPanel() {
  const {
    shopDomain,
    email,
    promotionActive,
    promotionEndsAt,
    promotionMessage,
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
                  <div className="ld-admin-date-field">
                    <label htmlFor="endsAt">End date (optional)</label>
                    <input
                      id="endsAt"
                      type="date"
                      name="endsAt"
                      disabled={isSubmitting}
                    />
                    <p className="ld-admin-date-help">
                      Leave blank for indefinite promotion. Set a date to
                      auto-remind yourself to turn it off.
                    </p>
                  </div>
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

        {/* ── Banner Message ── */}
        <Card>
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Banner Message
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Custom text shown on every store&rsquo;s dashboard when promotion
                is active. Leave empty for the default message.
              </Text>
            </BlockStack>
            <Form method="post">
              <input type="hidden" name="intent" value="save-message" />
              <BlockStack gap="300">
                <div className="ld-admin-textarea-field">
                  <label htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    defaultValue={promotionMessage ?? ""}
                    placeholder='e.g. "🎉 Summer launch special — everything free through July!"'
                    disabled={isSubmitting}
                  />
                </div>
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Button submit variant="primary" loading={isSubmitting}>
                    Save message
                  </Button>
                  {promotionMessage && (
                    <Text as="span" variant="bodySm" tone="subdued">
                      Current: &ldquo;{promotionMessage}&rdquo;
                    </Text>
                  )}
                </InlineStack>
              </BlockStack>
            </Form>
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
