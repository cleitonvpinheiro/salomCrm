import { expect, test, type Page } from "@playwright/test";

async function useEnglish(page: Page) {
  await page.addInitScript(() => localStorage.setItem("atelier-locale", "en"));
}

async function signInAsAdmin(page: Page) {
  await useEnglish(page);
  await page.goto("/login");
  await page.getByTestId("login-email-input").fill("admin@atelier.com");
  await page.getByTestId("login-password-input").fill("atelier123");
  await page.getByTestId("login-submit-button").click();
  await expect(page).toHaveURL("/app");
}

function dateFromToday(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

test("shows the public landing page without horizontal overflow", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Seu salão merece uma gestão tão incrível quanto o atendimento.",
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Acessar plataforma" })).toHaveAttribute(
    "href",
    "/login"
  );
  const plans = page.getByTestId("pricing-plans");
  await expect(page.getByText("Planos para cada fase")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Preços simples, sem cobrança por pessoa." })
  ).toBeVisible();
  await expect(plans).toContainText("Essencial");
  await expect(plans).toContainText("Salão");
  await expect(plans).toContainText("Studio");
  await expect(plans).toContainText("59");
  await expect(plans).toContainText("99");
  await expect(plans).toContainText("149");
  await expect(plans).toContainText("Até 2 profissionais");
  await expect(plans).toContainText("Até 5 profissionais");
  await expect(plans).toContainText("Até 10 profissionais");
  await expect(
    page.getByText(
      "Valores sugeridos para validação com salões; condições finais serão confirmadas no lançamento."
    )
  ).toBeVisible();

  const pageWidth = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(pageWidth.content).toBeLessThanOrEqual(pageWidth.viewport);
});

test("keeps company and platform sign-in on distinct routes", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/login");
  await expect(page.getByTestId("login-tenant-input")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();

  await page.getByRole("link", { name: "Platform administrator sign in" }).click();
  await expect(page).toHaveURL("/platform/login");
  await expect(page.getByTestId("login-tenant-input")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Platform administrator access" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Back to company workspace sign in" }).click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByTestId("login-tenant-input")).toBeVisible();
});

test("mobile navigation provides a visible sign-out button", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 600, "Mobile navigation only");
  await useEnglish(page);
  let logoutRequested = false;

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
  await page.route("**/api/branding", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        salon_name: "Atelier Demo",
        slug: "atelier",
        logo_data: null,
        primary_color: "#8F4E34",
        accent_color: "#D97757",
      }),
    })
  );
  await page.route("**/api/stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        today: "2026-10-27",
        total_clients: 0,
        active_stylists: 0,
        visits_this_month: 0,
        recall_due: 0,
        unassigned: 0,
        archived_clients: 0,
      }),
    })
  );
  await page.route("**/api/auth/logout", async (route) => {
    logoutRequested = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/app");
  const logoutButton = page.getByTestId("mobile-logout-button");
  await expect(logoutButton).toBeVisible();
  await expect(logoutButton).toHaveText("Sign out");
  await logoutButton.click();

  await expect(page).toHaveURL("/login");
  expect(logoutRequested).toBe(true);
});

test("mobile sign-out reports API failures without an unhandled background error", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 600, "Mobile navigation only");
  await useEnglish(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

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
  await page.route("**/api/branding", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        salon_name: "Atelier Demo",
        slug: "atelier",
        logo_data: null,
        primary_color: "#8F4E34",
        accent_color: "#D97757",
      }),
    })
  );
  await page.route("**/api/stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        today: "2026-10-27",
        total_clients: 0,
        active_stylists: 0,
        visits_this_month: 0,
        recall_due: 0,
        unassigned: 0,
        archived_clients: 0,
      }),
    })
  );
  await page.route("**/api/auth/logout", (route) => route.abort());

  await page.goto("/app");
  await page.getByTestId("mobile-logout-button").click();

  await expect(page.getByText("Could not sign out. Please try again.")).toBeVisible();
  await expect(page).toHaveURL("/app");
  expect(pageErrors).toEqual([]);
});

test("forgot-password entry preserves salon and platform account type", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password\?type=tenant/);
  await expect(page.getByLabel("Company workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();

  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.getByRole("link", { name: "Platform administrator sign in" }).click();
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL("/forgot-password?type=platform");
  await expect(page.getByLabel("Company workspace")).toHaveCount(0);
});

test("reset-password page validates matching passwords before submitting", async ({ page }) => {
  await useEnglish(page);
  const token = "test-reset-token-that-is-long-enough-to-be-valid";
  await page.goto(`/reset-password?token=${token}&type=tenant&tenant=atelier`);
  await page.getByLabel("New password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Confirm new password", { exact: true }).fill("different-password-123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toHaveText("The passwords do not match.");
  await expect(page).toHaveURL(new RegExp(`/reset-password\\?token=${token}`));
});

test("platform dashboard lists, opens, and manages salon workspaces", async ({ page }) => {
  await useEnglish(page);
  let salons = [
    {
      id: "default-id",
      name: "Main Salon",
      slug: "main-salon",
      active: true,
      is_default: true,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "salon-id",
      name: "Studio Rose",
      slug: "studio-rose",
      active: true,
      is_default: false,
      created_at: "2026-10-02T00:00:00Z",
    },
  ];

  await page.route("**/api/platform/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "platform-owner",
        name: "Platform Owner",
        email: "platform@example.com",
      }),
    })
  );
  await page.route("**/api/platform/tenants**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(salons),
      });
      return;
    }
    if (method === "PATCH") {
      const id = new URL(route.request().url()).pathname.split("/").pop();
      const update = route.request().postDataJSON() as { active: boolean };
      salons = salons.map((salon) =>
        salon.id === id ? { ...salon, active: update.active } : salon
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(salons.find((salon) => salon.id === id)),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/platform");
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
  await expect(page.getByText("Total workspaces", { exact: true })).toBeVisible();
  await expect(page.getByTestId("platform-tenant-main-salon")).toBeVisible();
  await expect(page.getByText("Default workspace", { exact: true })).toBeVisible();
  await expect(page.getByTestId("toggle-tenant-main-salon")).toHaveCount(0);
  await expect(page.getByTestId("open-tenant-studio-rose")).toHaveAttribute(
    "href",
    "/login?tenant=studio-rose"
  );

  await page.getByLabel("Search salons").fill("Rose");
  await expect(page.getByTestId("platform-tenant-studio-rose")).toBeVisible();
  await expect(page.getByTestId("platform-tenant-main-salon")).toHaveCount(0);
  await page.getByLabel("Search salons").fill("");

  await page.getByTestId("toggle-tenant-studio-rose").click();
  await page.getByTestId("confirm-tenant-status").click();
  await expect(page.getByTestId("platform-tenant-studio-rose")).toContainText("Inactive");
  await expect(page.getByTestId("open-tenant-studio-rose")).toHaveCount(0);
  await expect(page.getByTestId("toggle-tenant-studio-rose")).toHaveText("Activate");
});

test("master can open change-password form and confirm the new password", async ({ page }) => {
  await useEnglish(page);
  let passwordChangeAttempts = 0;
  await page.route("**/api/platform/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "platform-owner",
        name: "Platform Owner",
        email: "platform@example.com",
      }),
    })
  );
  await page.route("**/api/platform/tenants", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/platform/auth/password", (route) => {
    passwordChangeAttempts += 1;
    if (passwordChangeAttempts === 1) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not Found" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Password updated successfully" }),
    });
  });

  await page.goto("/platform");
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
  await page.getByTestId("open-change-platform-password").click();
  await expect(page.getByTestId("change-platform-password-dialog")).toBeVisible();
  await page.getByTestId("current-platform-password").fill("old-password-123");
  await page.getByTestId("new-platform-password").fill("new-password-123");
  await page.getByTestId("confirm-platform-password").fill("different-password-123");
  await page.getByTestId("save-platform-password").click();
  await expect(page.getByRole("alert")).toHaveText("The new passwords do not match.");
  await expect(page).toHaveURL("/platform");

  await page.getByTestId("confirm-platform-password").fill("new-password-123");
  await page.getByTestId("save-platform-password").click();
  await expect(
    page.getByText(
      "Password change is not available on this API instance. Restart the backend and try again.",
      { exact: true }
    )
  ).toBeVisible();

  const passwordChange = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/platform/auth/password") &&
      request.method() === "POST"
  );
  await page.getByTestId("save-platform-password").click();
  const request = await passwordChange;
  expect(request.postDataJSON()).toEqual({
    current_password: "old-password-123",
    new_password: "new-password-123",
  });
  await expect(page.getByTestId("change-platform-password-dialog")).toBeHidden();
});

test("creates, archives and restores a client", async ({ page }) => {
  const clientName = `E2E Client ${Date.now()}`;
  await signInAsAdmin(page);

  await page.getByTestId("add-client-button").click();
  await page.getByTestId("client-name-input").fill(clientName);
  const clientCreated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/clients") &&
      response.request().method() === "POST"
  );
  await page.getByTestId("save-client-submit").click();
  const clientResponse: { id: string } = await (await clientCreated).json();
  const clientId = clientResponse.id;

  try {
    await expect(page.getByTestId("client-form-dialog")).toBeHidden();

    await page.getByTestId("client-search-input").fill(clientName);
    const row = page.getByTestId(/^client-row-/).filter({ hasText: clientName });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: `Archive ${clientName}` }).click();
    await page.getByTestId("confirm-archive-client-btn").click();
    await expect(row).toHaveCount(0);

    await page.getByTestId("show-archived-clients").click();
    const archivedRow = page.getByTestId(/^client-row-/).filter({ hasText: clientName });
    await expect(archivedRow).toBeVisible();
    await archivedRow.getByRole("button", { name: `Restore ${clientName}` }).click();
    await expect(archivedRow).toHaveCount(0);

    await page.getByTestId("show-archived-clients").click();
    const restoredRow = page.getByTestId(/^client-row-/).filter({ hasText: clientName });
    await expect(restoredRow).toBeVisible();
    await restoredRow.getByRole("button", { name: `Archive ${clientName}` }).click();
    await page.getByTestId("confirm-archive-client-btn").click();
    await expect(restoredRow).toHaveCount(0);
  } finally {
    const baseUrl = new URL(page.url()).origin;
    await page.context().request.delete(
      new URL(`/api/clients/${clientId}`, baseUrl).toString()
    );
  }
});

test("books and completes an appointment from the agenda", async ({ page }) => {
  const clientName = `E2E Booking ${Date.now()}`;
  await signInAsAdmin(page);

  await page.getByTestId("add-client-button").click();
  await page.getByTestId("client-name-input").fill(clientName);
  const clientCreated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/clients") &&
      response.request().method() === "POST"
  );
  await page.getByTestId("save-client-submit").click();
  const clientResponse: { id: string } = await (await clientCreated).json();
  const clientId = clientResponse.id;
  let appointmentId: string | null = null;

  try {
    await expect(page.getByTestId("client-form-dialog")).toBeHidden();

    await page.goto("/agenda");
    const appointmentDate = dateFromToday(2);
    await page.getByTestId(`agenda-day-${appointmentDate}`).click();
    await page.getByTestId("new-appointment-button").click();
    await page.getByTestId("appointment-client-select").click();
    await page.getByRole("option", { name: clientName }).click();
    await page.getByTestId("appointment-service-select").click();
    await page.getByTestId("appointment-service-options").getByRole("option").first().click();
    await page.getByTestId("appointment-time-input").fill("18:00");
    const appointmentCreated = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/appointments") &&
        response.request().method() === "POST"
    );
    await page.getByTestId("save-appointment-submit").click();

    const appointment = page.getByTestId(/^appointment-card-/).filter({ hasText: clientName });
    await expect(appointment).toBeVisible();
    const appointmentTestId = await appointment.getAttribute("data-testid");
    if (!appointmentTestId) throw new Error("Appointment card is missing its test ID");
    const appointmentResponse: { id: string } = await (await appointmentCreated).json();
    appointmentId = appointmentResponse.id;
    await appointment.getByRole("button", { name: "Complete" }).click();
    await expect(
      page.getByTestId(appointmentTestId.replace("appointment-card-", "appointment-status-"))
    ).toHaveText("Completed");
  } finally {
    const baseUrl = new URL(page.url()).origin;
    if (appointmentId) {
      await page.context().request.delete(
        new URL(`/api/appointments/${appointmentId}`, baseUrl).toString()
      );
    }
    await page.context().request.delete(new URL(`/api/clients/${clientId}`, baseUrl).toString());
  }
});

test("platform owner provisions a tenant and its first administrator", async ({ page }) => {
  await useEnglish(page);
  const ownerEmail = process.env.PLAYWRIGHT_PLATFORM_OWNER_EMAIL;
  const ownerPassword = process.env.PLAYWRIGHT_PLATFORM_OWNER_PASSWORD;
  test.skip(!ownerEmail || !ownerPassword, "platform owner credentials are not configured");

  const slug = `e2e-${Date.now()}`;
  await page.goto("/platform/login");
  await page.getByTestId("login-email-input").fill(ownerEmail!);
  await page.getByTestId("login-password-input").fill(ownerPassword!);
  await page.getByTestId("login-submit-button").click();
  await expect(page).toHaveURL("/platform");
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();

  await page.getByLabel("Workspace name").fill(`E2E Workspace ${slug}`);
  await page.getByLabel("Workspace slug").fill(slug);
  await page.getByLabel("Administrator name").fill("E2E Tenant Admin");
  await page.getByLabel("Administrator e-mail").fill(`${slug}@example.com`);
  await page.getByLabel("Temporary password (10+ characters)").fill("e2e-admin-pass-908");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByText(slug, { exact: true })).toBeVisible();
  await page.getByTestId(`open-tenant-${slug}`).click();
  await expect(page).toHaveURL(`/login?tenant=${slug}`);
  await expect(page.getByTestId("login-tenant-input")).toHaveValue(slug);
  await expect(
    page.getByText("Shared by the whole team — each member with their own account.")
  ).toBeVisible();
});
