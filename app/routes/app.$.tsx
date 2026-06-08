import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Card, BlockStack, Text, EmptyState } from "@shopify/polaris";

const NOT_FOUND_IMAGE =
  "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png";
import { authenticate } from "../shopify.server";
import { AppPage } from "../components/AppPage";
import { shopifyAppPath } from "../lib/app-routes";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return json({ shopDomain: session.shop }, { status: 404 });
};

export default function AppNotFound() {
  const { shopDomain } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <AppPage title="Page not found" shopDomain={shopDomain}>
      <Card>
        <BlockStack gap="400">
          <EmptyState
            heading="We couldn't find that page"
            image={NOT_FOUND_IMAGE}
            action={{
              content: "Go to dashboard",
              onAction: () => navigate(shopifyAppPath("/app", shopDomain)),
            }}
          >
            <Text as="p" variant="bodyMd" tone="subdued">
              The page you were looking for doesn't exist or may have moved.
              Head back to your dashboard to run an audit or open a report.
            </Text>
          </EmptyState>
        </BlockStack>
      </Card>
    </AppPage>
  );
}
