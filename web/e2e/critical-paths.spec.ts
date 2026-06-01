import { expect, test } from "@playwright/test";

test("catalog, simulator, and audit workflows run against the API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Billing operations console" })).toBeVisible();

  await page.getByRole("link", { name: "Plans" }).click();
  await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();

  await page.getByRole("link", { name: "Simulator" }).click();
  await page.getByRole("button", { name: "Simulate invoice" }).click();
  await expect(page.getByRole("heading", { name: "Invoice", exact: true })).toBeVisible();
  await expect(page.getByText("Simulated invoice")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explanation trace" })).toBeVisible();

  await page.getByRole("link", { name: "Audit" }).click();
  await page.getByRole("button", { name: "Audit invoice" }).click();
  await expect(page.getByText("Valid")).toBeVisible();
});

test("operations pages create customers, usage, scenarios, and refunds", async ({ page }) => {
  await page.goto("/customers");
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
