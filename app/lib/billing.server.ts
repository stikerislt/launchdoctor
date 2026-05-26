import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "./prisma.server";
import { cacheAuditPdfIfPossible } from "./pdf.server";

const ONE_TIME_PRICE = 19.0;
const SUBSCRIPTION_PRICE = 9.0;

/** Custom/dev apps cannot call the Billing API until the app has public distribution. */
export function isDevBillingBypassEnabled(): boolean {
  if (process.env.BILLING_DEV_BYPASS === "true") return true;
  if (process.env.BILLING_DEV_BYPASS === "false") return false;
  return process.env.NODE_ENV !== "production";
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

export async function devGrantOneTimeUnlock(shopDomain: string, auditId: string) {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    throw new Error("Store not found");
  }

  await grantAuditUnlock(store.id, auditId, `dev-unlock-${auditId}-${Date.now()}`);
  await cacheAuditPdfIfPossible(auditId);
}

export async function devGrantAuditPlus(shopDomain: string) {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    throw new Error("Store not found");
  }

  await grantAuditPlus(store.id, `dev-subscription-${Date.now()}`);
}

export async function createOneTimePurchase(
  admin: AdminApiContext,
  auditId: string,
  returnUrl: string,
  test = process.env.NODE_ENV !== "production",
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
        price: { amount: ONE_TIME_PRICE, currencyCode: "USD" },
        returnUrl,
        test,
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

export async function createSubscription(
  admin: AdminApiContext,
  returnUrl: string,
  test = process.env.NODE_ENV !== "production",
) {
  const response = await admin.graphql(
    `#graphql
    mutation AuditPlus($name: String!, $returnUrl: URL!, $test: Boolean, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(name: $name, returnUrl: $returnUrl, test: $test, lineItems: $lineItems) {
        confirmationUrl
        appSubscription { id status }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        name: "Launch Doctor — Audit Plus",
        returnUrl,
        test,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: SUBSCRIPTION_PRICE, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      },
    },
  );

  const json = await response.json();
  const errorMessage = parseGraphqlErrors(json);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const result = json.data?.appSubscriptionCreate;
  if (!result?.confirmationUrl) {
    throw new Error("Unable to start subscription — no confirmation URL returned");
  }
  return result as { confirmationUrl: string; appSubscription: { id: string; status: string } };
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
    { variables: { id: chargeId } },
  );
  const json = await response.json();
  return json.data?.node?.status === "ACTIVE";
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

export async function cancelAuditPlusSubscription(
  admin: AdminApiContext,
  storeId: string,
  subscriptionId: string,
) {
  const response = await admin.graphql(
    `#graphql
    mutation AppSubscriptionCancel($id: ID!) {
      appSubscriptionCancel(id: $id) {
        appSubscription { id status }
        userErrors { field message }
      }
    }`,
    { variables: { id: subscriptionId } },
  );

  const json = await response.json();
  const errorMessage = parseGraphqlErrors(json);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const result = json.data?.appSubscriptionCancel;
  if (!result?.appSubscription) {
    throw new Error("Unable to cancel subscription — no response from Shopify.");
  }

  await revokeAuditPlus(storeId, subscriptionId);
  return result.appSubscription as { id: string; status: string };
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
