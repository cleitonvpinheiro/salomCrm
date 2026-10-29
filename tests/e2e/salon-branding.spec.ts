import { expect, test } from "@playwright/test";

const originalBranding = {
  salon_name: "Atelier Demo",
  slug: "atelier",
  logo_data: null,
  primary_color: "#8F4E34",
  accent_color: "#D97757",
};

test("salon admin can update its public name and logo", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("atelier-locale", "en"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "admin-1",
        name: "Salon Admin",
        email: "admin@example.com",
        role: "admin",
        tenant_slug: "atelier",
      }),
    })
  );
  await page.route("**/api/branding", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(originalBranding),
      });
      return;
    }

    const body = route.request().postDataJSON() as {
      salon_name: string;
      logo_data: string | null;
      primary_color: string;
      accent_color: string;
    };
    expect(body.salon_name).toBe("Studio Rose");
    expect(body.logo_data).toMatch(/^data:image\/png;base64,/);
    body.primary_color = "#2468AC";
    body.accent_color = "#DB8C28";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...body,
        slug: "atelier",
      }),
    });
  });

  await page.goto("/branding");
  await page.getByTestId("salon-brand-name").fill("Studio Rose");
  await page.getByTestId("salon-logo-upload").setInputFiles({
    name: "studio-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await page.getByTestId("save-salon-branding").click();

  await expect(page.getByText("Salon appearance saved")).toBeVisible();
  await expect(page.getByTestId("salon-brand-name")).toHaveValue("Studio Rose");
  await expect(page.locator("html")).toHaveCSS("--primary", "#2468AC");
});
