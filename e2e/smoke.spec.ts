import { expect, test } from "@playwright/test";

// Phase 0 E2E gate: the app boots and serves a page.
// Run: npm run test:e2e (requires `npx playwright install chromium` once).
test("app boots and the home page renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator("body")).not.toBeEmpty();
});
