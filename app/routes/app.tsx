import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useNavigation, useRouteError } from "@remix-run/react";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu, useAppBridge } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import launchDoctorStyles from "../styles/launch-doctor.css?url";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { isAdmin } from "../lib/admin.server";
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

  const admin = isAdmin(session.email, session.shop);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    latestAuditId: latestCompleted?.id ?? null,
    shopDomain: session.shop,
    isAdmin: admin,
  };
};

/**
 * Drives the Shopify admin's top loading bar from Remix navigation state so a
 * nav click gives instant feedback even while the destination loader runs.
 */
function NavigationIndicator() {
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const isLoading = navigation.state !== "idle";

  useEffect(() => {
    shopify.loading(isLoading);
    return () => shopify.loading(false);
  }, [shopify, isLoading]);

  return null;
}

export default function App() {
  const { apiKey, latestAuditId, isAdmin: showAdminLink } = useLoaderData<typeof loader>();

  // Use Remix <Link> (not raw <a>) inside NavMenu, matching Shopify's official
  // template. This lets App Bridge perform client-side (soft) navigation via the
  // `shopify:navigate` event instead of full-document iframe reloads. Paths must
  // be plain and relative — App Bridge injects shop/host/id_token itself.
  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavigationIndicator />
      <NavMenu>
        <Link to="/app" rel="home">
          Dashboard
        </Link>
        {latestAuditId ? (
          <Link to={`/app/audit/${latestAuditId}`}>Report</Link>
        ) : null}
        <Link to="/app/audit-plus">Tools</Link>
        <Link to="/app/history">History</Link>
        <Link to="/app/billing">Billing</Link>
        <Link to="/app/settings">Settings</Link>
        {showAdminLink ? <Link to="/app/admin">Admin</Link> : null}
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
