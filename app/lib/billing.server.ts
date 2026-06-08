import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "./prisma.server";
import { cacheAuditPdfIfPossible } from "./pdf.server";

type GraphqlJson = {
  data?: any;
  errors?: Array<{ message: string }>;
};

function joinErrors(errors: Array<{ message: string }>): string {
  return errors.map((e) => e.message).join(", ");
}

/** Test charges in development; live charges in production for real merchant stores. */
export function isBillingTestMode(): boolean {
  if (process.env.BILLING_LIVE_CHARGES === "true") return false;
  if (process.env.BILLING_TEST_CHARGES === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/** Development Partner stores must use test charges even when the app runs on production hosting. */
export async function isShopBillingTestMode(
  admin: AdminApiContext,
): Promise<boolean> {
  if (isBillingTestMode()) return true;

  const response = await admin.graphql(`#graphql
    query ShopPlan {
      shop {
        plan {
          partnerDevelopment
        }
      }
    }
  `);
  const json = (await response.json()) as GraphqlJson;
  if (json.errors?.length) {
    console.warn(`[billing] ShopPlan query failed: ${joinErrors(json.errors)}`);
    return false;
  }
  return Boolean(json.data?.shop?.plan?.partnerDevelopment);
}

export function getBillingAppUrl(): string {
  return (process.env.SHOPIFY_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
}

/** Embedded apps should return to launchUrl after charge approval (Shopify Billing API). */
export async function getBillingReturnUrl(
  admin: AdminApiContext,
  pathnameWithQuery: string,
  shopDomain: string,
): Promise<string> {
  const response = await admin.graphql(`#graphql
    query AppLaunchUrl {
      currentAppInstallation {
        launchUrl
      }
    }
  `);
  const json = (await response.json()) as GraphqlJson;
  if (json.errors?.length) {
    console.warn(
      `[billing] AppLaunchUrl query failed, falling back to app URL: ${joinErrors(json.errors)}`,
    );
  }
  const launchUrl = String(json.data?.currentAppInstallation?.launchUrl ?? "").replace(
    /\/$/,
    "",
  );
  const base = launchUrl || getBillingAppUrl();
  const [path, query = ""] = pathnameWithQuery.split("?");
  const params = new URLSearchParams(query);
  params.set("shop", shopDomain);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}?${params.toString()}`;
}

/** Custom/dev apps cannot call the Billing API until the app has public distribution. */
export function isDevBillingBypassEnabled(): boolean {
  if (process.env.BILLING_DEV_BYPASS === "true") return true;
  if (process.env.BILLING_DEV_BYPASS === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export async function devGrantOneTimeUnlock(shopDomain: string, auditId: string) {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    throw new Error("Store not found");
  }

  await grantAuditUnlock(store.id, auditId, `dev-unlock-${auditId}-${Date.now()}`);
  await cacheAuditPdfIfPossible(auditId);
}

function parseGraphqlErrors(json: {
  errors?: Array<{ message: string }>;
  data?: Record<string, { userErrors?: Array<{ message: string }> } | null>;
}): string | null {
  if (json.errors?.length) {
    return json.errors.map((e) => e.message).join(", ");
  }

  for (const value of Object.values(json.data ?? {})) {
    if (value && "userErrors" in value && value.userErrors?.length) {
      return value.userErrors.map((e) => e.message).join(", ");
    }
  }

  return null;
}

/** One-time charges use Admin API directly — Remix billing.request does not support OneTime interval. */
export async function createOneTimePurchase(
  admin: AdminApiContext,
  returnUrl: string,
  isTest: boolean,
) {
  const response = await admin.graphql(
    `#graphql
    mutation Unlock($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
      appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
        confirmationUrl
        appPurchaseOneTime { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        name: "Launch Doctor — Full Report",
        price: { amount: 19, currencyCode: "USD" },
        returnUrl,
        test: isTest,
      },
    },
  );

  const json = await response.json();
  const errorMessage = parseGraphqlErrors(json);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const result = json.data?.appPurchaseOneTimeCreate;
  if (!result?.confirmationUrl) {
    throw new Error("Unable to start checkout — no confirmation URL returned");
  }
  return result as { confirmationUrl: string; appPurchaseOneTime: { id: string } };
}

/** Return URL sends numeric charge_id; Admin API expects a GID. */
export function appPurchaseOneTimeGid(chargeId: string): string {
  if (chargeId.startsWith("gid://")) {
    return chargeId;
  }
  return `gid://shopify/AppPurchaseOneTime/${chargeId}`;
}

export function appSubscriptionGid(chargeId: string): string {
  if (chargeId.startsWith("gid://")) {
    return chargeId;
  }
  return `gid://shopify/AppSubscription/${chargeId}`;
}

export async function confirmOneTimePurchase(
  admin: AdminApiContext,
  chargeId: string,
): Promise<boolean> {
  const response = await admin.graphql(
    `#graphql
    query ConfirmPurchase($id: ID!) {
      node(id: $id) {
        ... on AppPurchaseOneTime {
          status
        }
      }
    }`,
    { variables: { id: appPurchaseOneTimeGid(chargeId) } },
  );
  const json = (await response.json()) as GraphqlJson;
  if (json.errors?.length) {
    console.warn(`[billing] ConfirmPurchase query failed: ${joinErrors(json.errors)}`);
    return false;
  }
  return json.data?.node?.status === "ACTIVE";
}

export async function devGrantAuditPlus(shopDomain: string) {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    throw new Error("Store not found");
  }

  await grantAuditPlus(store.id, `dev-subscription-${Date.now()}`);
}

export async function grantAuditUnlock(
  storeId: string,
  auditId: string,
  chargeId: string,
) {
  await prisma.$transaction([
    prisma.entitlement.create({
      data: {
        storeId,
        type: "ONE_TIME_UNLOCK",
        chargeId,
      },
    }),
    prisma.audit.update({
      where: { id: auditId },
      data: { isUnlocked: true, unlockedAt: new Date(), oneTimeChargeId: chargeId },
    }),
  ]);
}

export async function getActiveSubscription(storeId: string) {
  return prisma.subscription.findFirst({
    where: { storeId, status: "ACTIVE" },
  });
}

export async function hasAuditPlus(storeId: string): Promise<boolean> {
  // Promotion mode: everything is free for all stores.
  const { isPromotionActive } = await import("./admin.server");
  if (await isPromotionActive()) return true;

  const sub = await getActiveSubscription(storeId);
  if (sub) return true;

  if (isDevBillingBypassEnabled()) {
    const cancelled = await prisma.subscription.findFirst({
      where: { storeId, status: "CANCELLED" },
    });
    if (cancelled) return false;
    return true;
  }

  return false;
}

export async function revokeAuditPlus(storeId: string, subscriptionId: string) {
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "CANCELLED" },
    }),
    prisma.entitlement.deleteMany({
      where: { storeId, type: "AUDIT_PLUS_MONTHLY" },
    }),
  ]);
}

export async function devCancelAuditPlus(shopDomain: string) {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    throw new Error("Store not found");
  }

  const sub = await getActiveSubscription(store.id);
  if (sub) {
    await revokeAuditPlus(store.id, sub.id);
    return;
  }

  await prisma.subscription.create({
    data: {
      id: `dev-cancelled-${Date.now()}`,
      storeId: store.id,
      status: "CANCELLED",
    },
  });
}

export async function grantAuditPlus(storeId: string, subscriptionId: string) {
  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { id: subscriptionId },
      create: { id: subscriptionId, storeId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    }),
    prisma.entitlement.create({
      data: {
        storeId,
        type: "AUDIT_PLUS_MONTHLY",
        chargeId: subscriptionId,
      },
    }),
  ]);
}
