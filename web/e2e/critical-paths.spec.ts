import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to the billing operations console" })).toBeVisible();
  await page.getByRole("button", { name: "Use local demo" }).click();
  await expect(page.getByRole("heading", { name: "Billing operations console" })).toBeVisible();
}

test("catalog, simulator, and audit workflows run against the API", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: "Plans" }).click();
  await expect(page.getByRole("heading", { name: "Starter Monthly" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SAVE20" })).toBeVisible();

  await page.getByRole("link", { name: "Simulator" }).click();
  await page.getByRole("button", { name: "Simulate invoice" }).click();
  await expect(page.getByRole("heading", { name: "Invoice", exact: true })).toBeVisible();
  await expect(page.getByText("Simulated invoice")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explanation trace" })).toBeVisible();
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page.getByText(/Saved Simulation/i)).toBeVisible();
  await page.getByRole("link", { name: "Saved simulations" }).click();
  await expect(page.getByRole("heading", { name: "Selected run" })).toBeVisible();

  await page.getByRole("link", { name: "Audit" }).click();
  await page.getByRole("button", { name: "Audit invoice" }).click();
  await expect(page.getByText("Valid")).toBeVisible();
});

test("operations pages create customers, usage, scenarios, and refunds", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Customers" }).click();
  await page.getByRole("button", { name: "Create customer" }).click();
  await expect(page.getByRole("heading", { name: "Acme Finance" })).toBeVisible();
  await page.getByRole("button", { name: "Assign subscription" }).click();
  await page.getByRole("button", { name: "Load billing profile" }).click();
  await expect(page.getByText("pro_monthly")).toBeVisible();

  await page.getByRole("link", { name: "Usage" }).click();
  await page.getByRole("button", { name: "Ingest usage" }).click();
  await expect(page.getByText("Usage accepted")).toBeVisible();
  await page.getByRole("button", { name: "Aggregate usage" }).click();
  await expect(page.getByText("api_calls").first()).toBeVisible();

  await page.getByRole("link", { name: "Scenarios" }).click();
  await page.getByRole("button", { name: "Compare scenarios" }).click();
  await expect(page.getByText("Pro candidate")).toBeVisible();
  await expect(page.getByText("Stable")).toBeVisible();

  await page.getByRole("link", { name: "Refunds" }).click();
  await page.getByRole("button", { name: "Simulate refund" }).click();
  await expect(page.getByText("Credit note: $25.00")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explanation trace" })).toBeVisible();
});
