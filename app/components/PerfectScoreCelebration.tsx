import { Banner, BlockStack, Text } from "@shopify/polaris";
import { PERFECT_SCORE_MESSAGE, PERFECT_SCORE_TITLE } from "../lib/launch-score";

export function PerfectScoreCelebration() {
  return (
    <Banner tone="success" title={PERFECT_SCORE_TITLE}>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd">
          {PERFECT_SCORE_MESSAGE}
        </Text>
      </BlockStack>
    </Banner>
  );
}
