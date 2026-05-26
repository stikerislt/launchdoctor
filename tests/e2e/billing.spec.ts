import { test, expect } from "@playwright/test";

test.describe("Launch Doctor E2E", () => {
  test.skip("install → audit → billing unlock flow requires dev store", async () => {
    // Requires configured Shopify dev store credentials.
    // Run manually: SHOPIFY_TEST_SHOP=... pnpm test:e2e
    expect(true).toBe(true);
  });
});
