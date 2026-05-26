import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { FixResult, TrustPageKey } from "./types";
import { adminGraphql } from "./graphql.server";
import { getMissingTrustPages, parseAuditSnapshot } from "./snapshot.server";

const PAGE_CREATE = `#graphql
  mutation PageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page { id handle title }
      userErrors { field message }
    }
  }
`;

const PAGE_TEMPLATES: Record<
  TrustPageKey,
  (shopName: string, shopEmail: string | null) => { title: string; body: string }
> = {
  about: (shopName) => ({
    title: "About us",
    body: `<h1>About ${shopName}</h1><p>Welcome to ${shopName}. We are dedicated to offering quality products and a shopping experience you can trust.</p><p>Our team works hard to source great products, ship orders reliably, and support customers every step of the way.</p>`,
  }),
  contact: (shopName, shopEmail) => ({
    title: "Contact us",
    body: `<h1>Contact ${shopName}</h1><p>We are here to help with orders, products, and support questions.</p><p>${
      shopEmail
        ? `Email us at <a href="mailto:${shopEmail}">${shopEmail}</a> and we will get back to you as soon as possible.`
        : "Use the contact form on this page or reach out through your order confirmation email."
    }</p>`,
  }),
  faq: (shopName) => ({
    title: "FAQ",
    body: `<h1>Frequently asked questions</h1><h2>How long does shipping take?</h2><p>Most ${shopName} orders ship within 1–3 business days. Delivery times vary by location.</p><h2>What is your return policy?</h2><p>Please review our refund policy for details on returns and exchanges.</p><h2>How can I track my order?</h2><p>You will receive a tracking link by email once your order ships.</p>`,
  }),
};

const PAGE_LABELS: Record<TrustPageKey, string> = {
  about: "About us",
  contact: "Contact us",
  faq: "FAQ",
};

export async function applyTrustPagesFix(
  admin: AdminApiContext,
  snapshotJson: unknown,
): Promise<FixResult> {
  const snapshot = parseAuditSnapshot(snapshotJson);
  if (!snapshot) {
    return { success: false, message: "Invalid audit snapshot.", appliedCount: 0, errors: ["Invalid snapshot"] };
  }

  const missing = getMissingTrustPages(snapshot);
  if (missing.length === 0) {
    return {
      success: true,
      message: "About, Contact, and FAQ pages are already published.",
      appliedCount: 0,
      errors: [],
    };
  }

  let appliedCount = 0;
  const errors: string[] = [];
  const shopName = snapshot.shop.name;
  const shopEmail = snapshot.shop.contactEmail;

  for (const pageKey of missing) {
    const template = PAGE_TEMPLATES[pageKey](shopName, shopEmail);
    try {
      await adminGraphql(admin, PAGE_CREATE, {
        page: {
          title: template.title,
          handle: pageKey,
          body: template.body,
          isPublished: true,
        },
      });
      appliedCount += 1;
    } catch (error) {
      errors.push(
        `${PAGE_LABELS[pageKey]}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return {
    success: errors.length === 0,
    message:
      errors.length === 0
        ? `Created ${appliedCount} trust page${appliedCount === 1 ? "" : "s"}.`
        : `Created ${appliedCount} page${appliedCount === 1 ? "" : "s"} with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
    appliedCount,
    errors,
  };
}
