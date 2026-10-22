import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Scissors, Trash2, X } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Appointment, AppointmentStatus, PageResult, Stats } from "@/lib/types";
import { addMinutes, formatBRL } from "@/lib/format";
import { useUser } from "@/lib/userContext";
import { useI18n } from "@/lib/i18n";
import AppShell from "@/components/layout/AppShell";
import AppointmentFormModal from "@/components/agenda/AppointmentFormModal";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

const STATUS_META: Record<AppointmentStatus, { labelKey: string; className: string }> = {
  scheduled: { labelKey: "Scheduled", className: "bg-[#F3ECE1] text-[#57534E]" },
  completed: { labelKey: "Completed", className: "bg-[#EBF4EE] text-[#235937]" },
  cancelled: { labelKey: "Cancelled", className: "bg-[#FDF2E9] text-[#9A4B1A]" },
};

export default function AgendaPage() {
  const { t, formatDate } = useI18n();
  const user = useUser();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  // "Today" comes from the server (stats.today) so the agenda anchors to salon time.
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    retry: false,
  });

  const date = selectedDate ?? stats?.today ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setPage(1);
  }, [date]);

  const apptsQuery = useQuery({
    queryKey: ["appointments", date, page],
    queryFn: () =>
      apiGet<PageResult<Appointment>>(
        `/appointments?date=${date}&page=${page}&page_size=50`
      ),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const pageResult = apptsQuery.data;
  const appts = pageResult?.items ?? [];

  const refreshAgenda = () => {
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["client"] });
    qc.invalidateQueries({ queryKey: ["notes"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiPost<Appointment>(`/appointments/${id}/complete`),
    onSuccess: () => {
      refreshAgenda();
      toast.success(t("Appointment completed"));
    },
    onError: () => toast.error(t("Could not complete the appointment")),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiPost<Appointment>(`/appointments/${id}/cancel`),
    onSuccess: () => {
      refreshAgenda();
      toast.success(t("Appointment cancelled"));
    },
    onError: () => toast.error(t("Could not cancel the appointment")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/appointments/${id}`),
    onSuccess: () => {
      refreshAgenda();
      if (appts.length === 1 && page > 1) setPage((current) => current - 1);
      toast.success(t("Appointment removed"));
      setDeleteTarget(null);
    },
    onError: () => toast.error(t("Could not remove the appointment")),
  });

  const weekStart = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <AppShell
      title={t("Agenda")}
      subtitle={t("Bookings by day — completing a visit stamps the client's last visit")}
      actions={
        <Button data-testid="new-appointment-button" onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t("New appointment")}
        </Button>
      }
    >
      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* day navigation + week strip */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              className="bg-white"
              aria-label={t("Previous")}
              data-testid="agenda-prev-week"
              onClick={() => setSelectedDate(format(addDays(parseISO(date), -7), "yyyy-MM-dd"))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full bg-white"
              data-testid="agenda-today-button"
              onClick={() => setSelectedDate(null)}
            >
              {t("Today")}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="bg-white"
              aria-label={t("Next")}
              data-testid="agenda-next-week"
              onClick={() => setSelectedDate(format(addDays(parseISO(date), 7), "yyyy-MM-dd"))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2
            className="font-heading text-xl font-semibold text-stone-900"
            data-testid="agenda-day-title"
          >
            {formatDate(parseISO(date), { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
            <span className="ml-2 font-mono text-xs font-normal uppercase tracking-wider text-stone-500">
              {apptsQuery.isLoading
                ? ""
                : `${pageResult?.total ?? 0} ${t(pageResult?.total === 1 ? "appointment" : "appointments")}`}
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="agenda-week-strip">
          {weekDays.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const activeDay = iso === date;
            return (
              <button
                key={iso}
                data-testid={`agenda-day-${iso}`}
                onClick={() => setSelectedDate(iso)}
                className={`flex h-16 w-14 flex-col items-center justify-center rounded-xl border text-center transition-colors duration-150 ease-out ${
                  activeDay
                    ? "border-transparent bg-[#8F4E34] text-white"
                    : "border-[#E7DFD5] bg-white text-stone-600 hover:bg-[#F3ECE1]"
                }`}
              >
                <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                  {formatDate(d, { weekday: "short" })}
                </span>
                <span className="font-heading text-lg font-semibold">{format(d, "d")}</span>
              </button>
            );
          })}
        </div>

        {/* the day's bookings */}
        {apptsQuery.isError && !apptsQuery.data ? (
          <div
            className="rounded-2xl border border-[#E5DCD0] bg-white p-10 text-center"
            data-testid="agenda-error-state"
          >
            <p className="font-heading text-lg text-stone-800">{t("The agenda is out of reach")}</p>
            <p className="mt-1 text-sm text-stone-500">
              {t("We couldn't load the bookings for this day.")}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              data-testid="agenda-retry-button"
              onClick={() => apptsQuery.refetch()}
            >
              {t("Try again")}
            </Button>
          </div>
        ) : apptsQuery.isLoading ? (
          <div className="grid gap-3" data-testid="agenda-loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#F3ECE1]" />
            ))}
          </div>
        ) : appts.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-[#E7DFD5] bg-white p-12 text-center"
            data-testid="agenda-empty-state"
          >
            <p className="font-heading text-lg text-stone-800">{t("Nothing booked this day")}</p>
            <p className="mt-1 text-sm text-stone-500">
              {t("Pick another day on the strip above, or book the first appointment.")}
            </p>
            <Button className="mt-4" data-testid="agenda-empty-new-appointment" onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("New appointment")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3" data-testid="agenda-day-list">
            {appts.map((a) => {
              const sm = STATUS_META[a.status] ?? STATUS_META.scheduled;
              return (
                <div
                  key={a.id}
                  data-testid={`appointment-card-${a.id}`}
                  className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-[0_1px_3px_0_rgba(44,30,20,0.04),0_6px_16px_-4px_rgba(44,30,20,0.06)] sm:flex-row sm:items-center sm:justify-between ${
                    a.status === "cancelled" ? "border-[#E7DFD5] opacity-60" : "border-[#E5DCD0]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-20 flex-none rounded-xl bg-[#F3ECE1] px-2 py-2 text-center">
                      <p className="font-mono text-sm font-semibold text-[#8F4E34]">{a.time}</p>
                      <p className="font-mono text-[10px] uppercase text-stone-500">
                        {addMinutes(a.time, a.service_duration_min)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {a.client_name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {a.service_name ?? t("Service")} · {formatBRL(a.service_price)}
                      </p>
                      {a.stylist_name ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
                          <Scissors className="h-3 w-3" />
                          {a.stylist_name}
                        </p>
                      ) : null}
                      {a.notes ? (
                        <p className="mt-1 text-xs italic text-stone-400">{a.notes}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${sm.className}`}
                      data-testid={`appointment-status-${a.id}`}
                    >
                      {t(sm.labelKey)}
                    </span>
                    {a.status === "scheduled" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white"
                          data-testid={`complete-appointment-${a.id}`}
                          disabled={completeMutation.isPending}
                          onClick={() => completeMutation.mutate(a.id)}
                        >
                          <Check className="h-4 w-4" /> {t("Complete")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`cancel-appointment-${a.id}`}
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(a.id)}
                        >
                          <X className="h-4 w-4" /> {t("Cancel")}
                        </Button>
                      </>
                    )}
                    {a.status !== "completed" && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("Edit appointment")}
                        data-testid={`edit-appointment-${a.id}`}
                        onClick={() => {
                          setEditing(a);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {user.role === "admin" && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("Remove appointment")}
                        data-testid={`delete-appointment-${a.id}`}
                        className="text-stone-400 hover:text-destructive"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pageResult && pageResult.total > pageResult.page_size ? (
          <div
            className="flex items-center justify-between gap-3"
            data-testid="agenda-pagination"
          >
            <p className="text-sm text-stone-500">
              {t("Showing {from}–{to} of {total}", {
                from: (pageResult.page - 1) * pageResult.page_size + 1,
                to: (pageResult.page - 1) * pageResult.page_size + appts.length,
                total: pageResult.total,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageResult.page === 1 || apptsQuery.isFetching}
                data-testid="agenda-previous-page"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("Previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  pageResult.page * pageResult.page_size >= pageResult.total ||
                  apptsQuery.isFetching
                }
                data-testid="agenda-next-page"
                onClick={() => setPage((current) => current + 1)}
              >
                {t("Next")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <AppointmentFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultDate={date}
        appointment={editing}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={t("Remove the {time} booking?", { time: deleteTarget?.time ?? "" })}
        description={t("This deletes the appointment from the agenda. The client's history stays untouched.")}
        confirmLabel={t("Remove")}
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        confirmTestId="confirm-delete-appointment-btn"
      />
    </AppShell>
  );
}
