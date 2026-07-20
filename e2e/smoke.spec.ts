import { expect, test } from "@playwright/test";

// E2E gate: the old mock MVP shell must not show at all — every non-POC route
// collapses to /poc, which lands on the login when POC_PASSWORD is set.
// Run: npm run test:e2e (requires `npx playwright install chromium` once).
test("the root redirects to the POC console (old shell hidden)", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/(poc|login)/);
  await expect(page.locator("body")).not.toBeEmpty();
});

test("an old MVP route also collapses to the console", async ({ page }) => {
  await page.goto("/partners");
  await expect(page).toHaveURL(/\/(poc|login)/);
});
