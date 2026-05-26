import { Button, Card, InlineStack, Text, BlockStack } from "@shopify/polaris";

export type DashboardNavCard = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  primary?: boolean;
  badge?: string;
};

export function DashboardNavCards({ cards }: { cards: DashboardNavCard[] }) {
  return (
    <div className="ld-dashboard-nav-grid">
      {cards.map((card) => (
        <Card key={card.title}>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="start" wrap>
              <Text as="h3" variant="headingSm">
                {card.title}
              </Text>
              {card.badge && (
                <span className="ld-dashboard-nav-badge">{card.badge}</span>
              )}
            </InlineStack>
            <Text as="p" variant="bodyMd" tone="subdued">
              {card.description}
            </Text>
            <Button variant={card.primary ? "primary" : undefined} onClick={card.onAction}>
              {card.actionLabel}
            </Button>
          </BlockStack>
        </Card>
      ))}
    </div>
  );
}
