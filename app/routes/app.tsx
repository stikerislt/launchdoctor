import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import launchDoctorStyles from "../styles/launch-doctor.css?url";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: launchDoctorStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const latestCompleted = await prisma.audit.findFirst({
    where: {
      store: { shopDomain: session.shop },
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    latestAuditId: latestCompleted?.id ?? null,
  };
};

export default function App() {
  const { apiKey, latestAuditId } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">
          Dashboard
        </a>
        {latestAuditId ? (
          <a href={`/app/audit/${latestAuditId}`}>Latest report</a>
        ) : null}
        {latestAuditId ? (
          <a href={`/app/fixes/${latestAuditId}`}>Fix Center</a>
        ) : null}
        <a href="/app/audit-plus">Audit Plus</a>
        <a href="/app/history">History</a>
        <a href="/app/billing">Billing</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
