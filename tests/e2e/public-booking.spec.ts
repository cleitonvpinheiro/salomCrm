import { expect, test } from "@playwright/test";
import type { BookingSettings, WeeklyHours } from "../../frontend/src/lib/booking";

test("disabled public link explains how the administrator can activate it", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("atelier-locale", "en"));
  await page.route("**/api/booking/public/atelier", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Online booking is unavailable" }),
    })
  );

  await page.goto("/agendar/atelier");

  await expect(page.getByRole("heading", { name: "Online booking unavailable" })).toBeVisible();
  await expect(page.getByText(
    "Ask the salon administrator to enable online booking, set overlapping hours for the salon and a professional, and save settings."
  )).toBeVisible();
});

test("salon admin can enable online booking after setting overlapping hours", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("atelier-locale", "en"));
  const closedWeek: WeeklyHours = {
    mon: { start: null, end: null },
    tue: { start: null, end: null },
    wed: { start: null, end: null },
    thu: { start: null, end: null },
    fri: { start: null, end: null },
    sat: { start: null, end: null },
    sun: { start: null, end: null },
  };
  let savedSettings: BookingSettings = {
    enabled: false,
    salon_hours: closedWeek,
    stylist_hours: { "stylist-1": closedWeek },
  };
  const stylists = [{ id: "stylist-1", name: "Marina", title: "", color: "#8F4E34" }];

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
        active_stylists: 1,
        visits_this_month: 0,
        recall_due: 0,
        unassigned: 0,
        archived_clients: 0,
      }),
    })
  );
  await page.route("**/api/booking/settings", async (route) => {
    if (route.request().method() === "PUT") {
      savedSettings = route.request().postDataJSON() as BookingSettings;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...savedSettings,
        salon_name: "Atelier Demo",
        slug: "atelier",
        stylists,
      }),
    });
  });

  await page.goto("/booking-settings");
  await page.getByRole("checkbox", { name: "Monday Open" }).nth(0).check();
  await page.getByRole("checkbox", { name: "Monday Open" }).nth(1).check();
  await page.getByTestId("booking-enabled").check();
  await page.getByTestId("save-booking-settings").click();

  await expect(page.getByText("Booking settings saved")).toBeVisible();
  expect(savedSettings.enabled).toBe(true);
  expect(savedSettings.salon_hours.mon).toEqual({ start: "09:00", end: "18:00" });
  expect(savedSettings.stylist_hours["stylist-1"].mon).toEqual({
    start: "09:00",
    end: "18:00",
  });
});

test("customer can book an available salon appointment", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("atelier-locale", "en"));
  await page.route("**/api/booking/public/atelier", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        salon_name: "Atelier Demo",
        slug: "atelier",
        logo_data: null,
        primary_color: "#2468AC",
        accent_color: "#DB8C28",
        services: [
          {
            id: "service-cut",
            name: "Haircut",
            duration_min: 60,
            price: 75,
          },
        ],
        stylists: [{ id: "stylist-1", name: "Marina", title: "", color: "#8F4E34" }],
      }),
    })
  );
  await page.route("**/api/booking/public/atelier/availability**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ time: "09:00", stylist_id: "stylist-1" }]),
    })
  );
  await page.route("**/api/booking/public/atelier/appointments", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toMatchObject({
      name: "Alex Doe",
      phone: "+1 555 123 4567",
      service_id: "service-cut",
      stylist_id: null,
      time: "09:00",
    });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        salon_name: "Atelier Demo",
        service_name: "Haircut",
        stylist_name: "Marina",
        date: "2026-10-28",
        time: "09:00",
      }),
    });
  });

  await page.goto("/agendar/atelier");
  await page.getByTestId("public-booking-service").selectOption("service-cut");
  await page.getByTestId("public-booking-time-09:00").click();
  await page.getByLabel("Your name").fill("Alex Doe");
  await page.getByLabel("Phone number").fill("+1 555 123 4567");
  await page.getByTestId("public-booking-submit").click();

  await expect(page.getByRole("heading", { name: "Booking confirmed!" })).toBeVisible();
  await expect(page.getByText("Haircut")).toBeVisible();
  await expect(page.getByText("Marina")).toBeVisible();
});
