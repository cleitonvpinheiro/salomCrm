import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiGet, apiPut } from "@/lib/api";
import type {
  BookingSettings,
  BookingSettingsResponse,
  HoursWindow,
  Weekday,
  WeeklyHours,
} from "@/lib/booking";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/userContext";

const DAYS: { id: Weekday; label: string }[] = [
  { id: "mon", label: "Monday" },
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" },
];

function emptyWeek(): WeeklyHours {
  return Object.fromEntries(
    DAYS.map(({ id }) => [id, { start: null, end: null }])
  ) as WeeklyHours;
}

function normalizeWeek(week?: WeeklyHours): WeeklyHours {
  const defaults = emptyWeek();
  return Object.fromEntries(
    DAYS.map(({ id }) => [id, week?.[id] ?? defaults[id]])
  ) as WeeklyHours;
}

function ScheduleEditor({
  title,
  description,
  value,
  onChange,
  testId,
}: {
  title: string;
  description?: string;
  value: WeeklyHours;
  onChange: (day: Weekday, window: HoursWindow) => void;
  testId: string;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-[#E7DFD5] bg-white p-4 sm:p-6" data-testid={testId}>
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-stone-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      <div className="space-y-2">
        {DAYS.map(({ id, label }) => {
          const hours = value[id] ?? { start: null, end: null };
          const isOpen = Boolean(hours.start && hours.end);
          return (
            <div key={id} className="grid grid-cols-[minmax(90px,1fr)_auto_minmax(110px,1fr)] items-center gap-3 border-t border-stone-100 py-2.5">
              <span className="text-sm font-medium text-stone-700">{t(label)}</span>
              <label className="flex items-center gap-2 text-xs text-stone-500">
                <input
                  type="checkbox"
                  checked={isOpen}
                  aria-label={`${t(label)} ${t("Open")}`}
                  onChange={(event) =>
                    onChange(
                      id,
                      event.target.checked
                        ? { start: "09:00", end: "18:00" }
                        : { start: null, end: null }
                    )
                  }
                />
                {t("Open")}
              </label>
              {isOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    className="h-10"
                    type="time"
                    aria-label={`${t(label)} ${t("Opening time")}`}
                    value={hours.start ?? ""}
                    onChange={(event) =>
                      onChange(id, { ...hours, start: event.target.value || null })
                    }
                  />
                  <span className="text-stone-400">–</span>
                  <Input
                    className="h-10"
                    type="time"
                    aria-label={`${t(label)} ${t("Closing time")}`}
                    value={hours.end ?? ""}
                    onChange={(event) =>
                      onChange(id, { ...hours, end: event.target.value || null })
                    }
                  />
                </div>
              ) : (
                <span className="text-right text-sm text-stone-400">{t("Closed")}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function BookingSettingsPage() {
  const { t } = useI18n();
  const user = useUser();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["booking-settings"],
    queryFn: () => apiGet<BookingSettingsResponse>("/booking/settings"),
    retry: false,
  });
  const [settings, setSettings] = useState<BookingSettings | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettings({
      enabled: settingsQuery.data.enabled,
      salon_hours: normalizeWeek(settingsQuery.data.salon_hours),
      stylist_hours: Object.fromEntries(
        settingsQuery.data.stylists.map((stylist) => [
          stylist.id,
          normalizeWeek(settingsQuery.data.stylist_hours[stylist.id]),
        ])
      ),
    });
  }, [settingsQuery.data]);

  const publicUrl = useMemo(
    () =>
      settingsQuery.data
        ? `${window.location.origin}/agendar/${encodeURIComponent(settingsQuery.data.slug)}`
        : "",
    [settingsQuery.data]
  );

  const saveMutation = useMutation({
    mutationFn: (next: BookingSettings) => apiPut<{ ok: boolean }>("/booking/settings", next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      toast.success(t("Booking settings saved"));
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError &&
        typeof error.body === "object" &&
        error.body !== null &&
        "detail" in error.body &&
        typeof error.body.detail === "string"
          ? error.body.detail
          : null;
      toast.error(detail ? t(detail) : t("Could not save booking settings"));
    },
  });

  const updateSalonHours = (day: Weekday, hours: HoursWindow) => {
    setSettings((current) =>
      current
        ? { ...current, salon_hours: { ...current.salon_hours, [day]: hours } }
        : current
    );
  };

  const updateStylistHours = (stylistId: string, day: Weekday, hours: HoursWindow) => {
    setSettings((current) =>
      current
        ? {
            ...current,
            stylist_hours: {
              ...current.stylist_hours,
              [stylistId]: {
                ...normalizeWeek(current.stylist_hours[stylistId]),
                [day]: hours,
              },
            },
          }
        : current
    );
  };

  if (user.role !== "admin") {
    return (
      <AppShell title={t("Online booking")} subtitle={t("Administrator access required")}>
        <p className="p-8 text-sm text-stone-600">{t("Only salon administrators can change booking settings.")}</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Online booking")} subtitle={t("Set when customers can book online.")}>
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {settingsQuery.isLoading && <p className="text-sm text-stone-500">{t("Loading…")}</p>}
        {settingsQuery.isError && (
          <div className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-800">
            {t("Could not load booking settings.")}
            <Button className="ml-3" variant="outline" onClick={() => settingsQuery.refetch()}>
              {t("Retry")}
            </Button>
          </div>
        )}
        {settings && settingsQuery.data && (
          <>
            <section className="rounded-2xl border border-[#E7DFD5] bg-white p-4 sm:p-6">
              <label className="flex items-start gap-3">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, enabled: event.target.checked } : current
                    )
                  }
                  data-testid="booking-enabled"
                />
                <span>
                  <span className="block font-heading text-lg font-semibold text-stone-900">
                    {t("Enable online booking")}
                  </span>
                  <span className="mt-1 block text-sm text-stone-500">
                    {t("Customers can reserve available times instantly.")}
                  </span>
                  <span className="mt-1 block text-sm text-stone-500">
                    {t("To activate the public link, enable this option and save settings after configuring overlapping hours.")}
                  </span>
                </span>
              </label>
              <div className="mt-5 rounded-xl bg-[#FAF7F2] p-3 sm:flex sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("Public booking link")}</p>
                  <p className="mt-1 truncate text-sm text-stone-800" data-testid="public-booking-url">{publicUrl}</p>
                </div>
                <div className="mt-3 flex flex-none gap-2 sm:mt-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(publicUrl);
                        toast.success(t("Booking link copied"));
                      } catch {
                        toast.error(t("Could not copy the booking link"));
                      }
                    }}
                    aria-label={t("Copy booking link")}
                  >
                    <Copy className="h-4 w-4" /> {t("Copy")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
                    aria-label={t("Open booking link")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>
            <ScheduleEditor
              title={t("Salon opening hours")}
              description={t("Online slots are only offered while the salon is open.")}
              value={settings.salon_hours}
              onChange={updateSalonHours}
              testId="salon-hours"
            />
            {settingsQuery.data.stylists.map((stylist) => (
              <ScheduleEditor
                key={stylist.id}
                title={stylist.name}
                description={t("Professional availability")}
                value={normalizeWeek(settings.stylist_hours[stylist.id])}
                onChange={(day, hours) => updateStylistHours(stylist.id, day, hours)}
                testId={`stylist-hours-${stylist.id}`}
              />
            ))}
            {settingsQuery.data.stylists.length === 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t("Add an active professional before enabling online bookings.")}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                disabled={saveMutation.isPending || settingsQuery.data.stylists.length === 0}
                data-testid="save-booking-settings"
                onClick={() => saveMutation.mutate(settings)}
              >
                {saveMutation.isPending ? t("Saving…") : <><Check className="h-4 w-4" /> {t("Save settings")}</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
