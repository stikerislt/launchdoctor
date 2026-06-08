import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Card,
  DataTable,
  Badge,
  Button,
  BlockStack,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { resolveScoresFromFindings } from "../lib/audit-access.server";
import { getDismissedRuleCodes } from "../lib/fixes/dismissals.server";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { AppPage } from "../components/AppPage";
import { shopifyAppPath } from "../lib/app-routes";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
    include: {
      audits: {
        orderBy: { completedAt: "desc" },
        take: 20,
        include: {
          findings: { select: { ruleCode: true, severity: true } },
          _count: {
            select: {
              findings: { where: { severity: "CRITICAL" } },
            },
          },
        },
      },
    },
  });

  const dismissedRuleCodes = store
    ? await getDismissedRuleCodes(store.id)
    : new Set<string>();

  return json({
    audits: (store?.audits ?? []).map((audit) => ({
      ...audit,
      ...resolveScoresFromFindings(
        audit.findings,
        audit.launchScore,
        store ? dismissedRuleCodes : new Set(),
      ),
    })),
    shopDomain: session.shop,
  });
};

export default function History() {
  const { audits, shopDomain } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rows = audits.map((audit) => [
    audit.completedAt
      ? new Date(audit.completedAt).toLocaleDateString()
      : "—",
    audit.launchScore?.toString() ?? "—",
    audit._count.findings.toString(),
    <Badge key={audit.id} tone={audit.status === "COMPLETED" ? "success" : audit.status === "FAILED" ? "critical" : "info"}>
      {audit.status}
    </Badge>,
    audit.status === "COMPLETED" ? (
      <Button
        key={`btn-${audit.id}`}
        onClick={() => navigate(shopifyAppPath(`/app/audit/${audit.id}`, shopDomain))}
        variant="plain"
      >
        View
      </Button>
    ) : "—",
  ]);

  return (
    <AppPage title="Audit History" shopDomain={shopDomain}>
      <BlockStack gap="400">
        <AppBrandHeader title="Audit History" subtitle="Past scans and scores" />
        <Card>
          {audits.length === 0 ? (
            <EmptyState
              heading="No audits yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{
                content: "Run your first audit",
                onAction: () => navigate(shopifyAppPath("/app", shopDomain)),
              }}
            >
              <p>
                Run your first store audit from the dashboard to see your Launch
                Score and history here.
              </p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={["text", "numeric", "numeric", "text", "text"]}
              headings={["Date", "Score", "Critical", "Status", ""]}
              rows={rows}
            />
          )}
        </Card>
      </BlockStack>
    </AppPage>
  );
}
