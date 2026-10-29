import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, Scissors } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { salonThemeStyle } from "@/lib/booking";
import type {
  PublicAvailabilitySlot,
  PublicBookingConfirmation,
  PublicBookingInfo,
} from "@/lib/booking";
import { formatBRL } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import BrandMark from "@/components/shared/BrandMark";

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorDetail(error: unknown, fallback: string) {
  if (
    error instanceof ApiError &&
    typeof error.body === "object" &&
    error.body !== null &&
    "detail" in error.body &&
    typeof error.body.detail === "string"
  ) {
    return error.body.detail;
  }
  return fallback;
}

export default function PublicBookingPage() {
  const { slug = "" } = useParams();
  const { t, formatDate } = useI18n();
  const today = localDate(new Date());
  const lastDay = new Date();
  lastDay.setDate(lastDay.getDate() + 30);
  const [serviceId, setServiceId] = useState("");
  const [stylistId, setStylistId] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const infoQuery = useQuery({
    queryKey: ["public-booking", slug],
    queryFn: () => apiGet<PublicBookingInfo>(`/booking/public/${encodeURIComponent(slug)}`),
    retry: false,
  });
  const availabilityQuery = useQuery({
    queryKey: ["public-booking-availability", slug, serviceId, stylistId, date],
    queryFn: () => {
      const params = new URLSearchParams({ date, service_id: serviceId });
      if (stylistId) params.set("stylist_id", stylistId);
      return apiGet<PublicAvailabilitySlot[]>(
        `/booking/public/${encodeURIComponent(slug)}/availability?${params}`
      );
    },
    enabled: Boolean(serviceId && date),
    retry: false,
  });
  const bookingMutation = useMutation({
    mutationFn: () =>
      apiPost<PublicBookingConfirmation>(
        `/booking/public/${encodeURIComponent(slug)}/appointments`,
        {
          name,
          phone,
          service_id: serviceId,
          stylist_id: stylistId || null,
          date,
          time,
        }
      ),
  });

  const availableTimes = [
    ...new Set((availabilityQuery.data ?? []).map((slot) => slot.time)),
  ].sort();

  if (bookingMutation.data) {
    const confirmation = bookingMutation.data;
    return (
      <main className="min-h-screen bg-[#FAF7F2] px-4 py-10 text-stone-900">
        <section
          className="mx-auto max-w-xl rounded-3xl border border-[#E7DFD5] bg-white p-6 text-center shadow-sm sm:p-10"
          style={infoQuery.data ? salonThemeStyle(infoQuery.data) : undefined}
        >
          <BrandMark
            src={infoQuery.data?.logo_data}
            alt={infoQuery.data?.salon_name}
            className="mx-auto mb-4 h-14 w-14 rounded-full object-contain"
          />
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#477452]" />
          <h1 className="mt-4 font-heading text-3xl font-semibold">{t("Booking confirmed!")}</h1>
          <p className="mt-2 text-stone-600">{t("Your appointment is reserved.")}</p>
          <div className="mt-6 rounded-2xl bg-[#FAF7F2] p-5 text-left">
            <p className="font-semibold">{confirmation.salon_name}</p>
            <p className="mt-3">{confirmation.service_name}</p>
            <p>{t("Professional")}: {confirmation.stylist_name}</p>
            <p className="mt-2">{formatDate(new Date(`${confirmation.date}T12:00:00`), { dateStyle: "long" })}</p>
            <p>{t("Time")}: {confirmation.time}</p>
          </div>
          <p className="mt-5 text-sm text-stone-500">{t("Please contact the salon directly if you need to change your booking.")}</p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#FAF7F2] px-4 py-8 text-stone-900 sm:py-12"
      style={infoQuery.data ? salonThemeStyle(infoQuery.data) : undefined}
    >
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center gap-3">
          <BrandMark
            src={infoQuery.data?.logo_data}
            alt={infoQuery.data?.salon_name}
            className="h-12 w-12 rounded-full bg-white p-1"
          />
          <div>
            <p className="font-heading text-xl font-semibold">
              {infoQuery.data?.salon_name ?? "Atelier"}
            </p>
            <p className="text-sm text-stone-500">{t("Online appointment booking")}</p>
          </div>
        </header>

        {infoQuery.isLoading && (
          <p className="rounded-2xl bg-white p-6 text-sm text-stone-500">{t("Loading…")}</p>
        )}
        {infoQuery.isError && (
          <section className="rounded-2xl border border-[#E7DFD5] bg-white p-6">
            <h1 className="font-heading text-2xl font-semibold">{t("Online booking unavailable")}</h1>
            <p className="mt-2 text-sm text-stone-600">
              {errorDetail(infoQuery.error, "") === "Online booking is unavailable"
                ? t("Ask the salon administrator to enable online booking, set overlapping hours for the salon and a professional, and save settings.")
                : t("This salon is not accepting online bookings right now.")}
            </p>
          </section>
        )}
        {infoQuery.data && (
          <section className="overflow-hidden rounded-3xl border border-[#E7DFD5] bg-white shadow-sm">
            <div className="px-6 py-7 text-white sm:px-8" style={{ backgroundColor: infoQuery.data.primary_color, color: salonThemeStyle(infoQuery.data)["--primary-foreground"] }}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{t("Book an appointment")}</p>
              <h1 className="mt-2 font-heading text-3xl font-semibold">{infoQuery.data.salon_name}</h1>
              <p className="mt-2 text-sm text-[#D5CCC3]">{t("Choose a service, professional and available time.")}</p>
            </div>
            <form
              className="space-y-5 p-5 sm:p-8"
              onSubmit={(event) => {
                event.preventDefault();
                bookingMutation.mutate();
              }}
            >
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">{t("Service")}</span>
                <select
                  className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
                  value={serviceId}
                  required
                  onChange={(event) => {
                    setServiceId(event.target.value);
                    setTime("");
                  }}
                  data-testid="public-booking-service"
                >
                  <option value="">{t("Choose a service")}</option>
                  {infoQuery.data.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {service.duration_min} {t("min")} · {formatBRL(service.price)}
                    </option>
                  ))}
                </select>
                {infoQuery.data.services.length === 0 && (
                  <span className="block text-xs text-amber-700">{t("No services are available for online booking.")}</span>
                )}
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">{t("Professional")}</span>
                <select
                  className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
                  value={stylistId}
                  onChange={(event) => {
                    setStylistId(event.target.value);
                    setTime("");
                  }}
                  data-testid="public-booking-stylist"
                >
                  <option value="">{t("Any available professional")}</option>
                  {infoQuery.data.stylists.map((stylist) => (
                    <option key={stylist.id} value={stylist.id}>{stylist.name}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4" />{t("Date")}</span>
                <Input
                  className="h-11"
                  type="date"
                  min={today}
                  max={localDate(lastDay)}
                  value={date}
                  required
                  onChange={(event) => {
                    setDate(event.target.value);
                    setTime("");
                  }}
                  data-testid="public-booking-date"
                />
              </label>

              {serviceId && (
                <fieldset className="space-y-2">
                  <legend className="flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />{t("Available times")}</legend>
                  {availabilityQuery.isLoading && <p className="text-sm text-stone-500">{t("Loading…")}</p>}
                  {availabilityQuery.isError && <p role="alert" className="text-sm text-red-700">{t("Could not load available times.")}</p>}
                  {!availabilityQuery.isLoading && !availabilityQuery.isError && availableTimes.length === 0 && (
                    <p className="rounded-lg bg-[#FAF7F2] p-3 text-sm text-stone-600">{t("No times available on this date. Try another day.")}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availableTimes.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        aria-pressed={time === slot}
                        onClick={() => setTime(slot)}
                        className={`min-h-11 rounded-lg border text-sm font-medium transition-colors ${time === slot ? "border-[var(--primary)] bg-primary text-primary-foreground" : "border-[#E7DFD5] text-stone-700 hover:bg-[#FAF7F2]"}`}
                        data-testid={`public-booking-time-${slot}`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">{t("Your name")}</span>
                  <Input className="h-11" autoComplete="name" minLength={2} maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">{t("Phone number")}</span>
                  <Input className="h-11" type="tel" autoComplete="tel" minLength={8} maxLength={30} required value={phone} onChange={(event) => setPhone(event.target.value)} />
                </label>
              </div>
              <p className="text-xs leading-relaxed text-stone-500">
                {t("Your name and phone number will be added to the salon's client records for this booking.")}
              </p>

              {bookingMutation.isError && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  {errorDetail(bookingMutation.error, t("Could not complete the booking."))}
                </p>
              )}
              <Button
                className="h-12 w-full"
                type="submit"
                disabled={
                  bookingMutation.isPending ||
                  !serviceId ||
                  !time ||
                  !name.trim() ||
                  !phone.trim() ||
                  !availableTimes.includes(time)
                }
                data-testid="public-booking-submit"
              >
                <Scissors className="h-4 w-4" />
                {bookingMutation.isPending ? t("Booking…") : t("Confirm booking")}
              </Button>
              <p className="text-center text-xs leading-relaxed text-stone-500">{t("Your booking is confirmed immediately. Please contact the salon for changes.")}</p>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
