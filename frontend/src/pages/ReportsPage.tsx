import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { formatBRL } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/userContext";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BreakdownRow {
  name: string;
  appointments: number;
  revenue: number;
}

const statusLabel: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function ReportsDashboard() {
  const { t, formatDate } = useI18n();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const monthDate = parseISO(`${month}-01T12:00:00`);
  const fromDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const toDate = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const reportQuery = useQuery({
    queryKey: ["reports", month],
    queryFn: () =>
      apiGet<Appointment[]>(
        `/appointments?from_date=${fromDate}&to_date=${toDate}`
      ),
    retry: false,
  });
  const appointments = reportQuery.data ?? [];
  const completed = appointments.filter((appointment) => appointment.status === "completed");
  const scheduledCount = appointments.filter((appointment) => appointment.status === "scheduled").length;
  const cancelledCount = appointments.filter((appointment) => appointment.status === "cancelled").length;
  const revenue = completed.reduce((total, appointment) => total + appointment.service_price, 0);

  const { byStylist, byService } = useMemo(() => {
    const aggregate = (getName: (appointment: Appointment) => string) => {
      const rows = new Map<string, BreakdownRow>();
      for (const appointment of completed) {
        const name = getName(appointment);
        const row = rows.get(name) ?? { name, appointments: 0, revenue: 0 };
        row.appointments += 1;
        row.revenue += appointment.service_price;
        rows.set(name, row);
      }
      return [...rows.values()].sort(
        (a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name)
      );
    };

    return {
      byStylist: aggregate((appointment) => appointment.stylist_name ?? t("Unassigned")),
      byService: aggregate((appointment) => appointment.service_name ?? t("Service")),
    };
  }, [completed, t]);

  const exportCsv = () => {
    try {
      const headers = [t("Date"), t("Time"), t("Client"), t("Stylist"), t("Service"), t("Status"), t("Revenue")];
      const rows = appointments.map((appointment) => [
        appointment.date,
        appointment.time,
        appointment.client_name ?? "",
        appointment.stylist_name ?? t("Unassigned"),
        appointment.service_name ?? t("Service"),
        t(statusLabel[appointment.status]),
        appointment.status === "completed" ? appointment.service_price.toFixed(2).replace(".", ",") : "0,00",
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map(csvCell).join(";"))
        .join("\r\n");
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `atelier-relatorio-${month}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t("Could not export this report."));
    }
  };

  const cards = [
    {
      label: t("Completed revenue"),
      value: formatBRL(revenue),
      hint: t("from completed appointments"),
      accent: true,
    },
    {
      label: t("Completed appointments"),
      value: completed.length,
      hint: t("Appointments"),
    },
    {
      label: t("Scheduled appointments"),
      value: scheduledCount,
      hint: t("Appointments"),
    },
    {
      label: t("Cancelled appointments"),
      value: cancelledCount,
      hint: t("Appointments"),
    },
  ];

  const renderBreakdown = (title: string, rows: BreakdownRow[]) => (
    <section className="overflow-hidden rounded-2xl border border-[#E5DCD0] bg-white">
      <div className="border-b border-[#EEE7DE] px-5 py-4">
        <h2 className="font-heading text-lg font-semibold text-stone-900">{t(title)}</h2>
      </div>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{title === "Appointments by stylist" ? t("Stylist") : t("Service")}</TableHead>
              <TableHead className="text-right">{t("Appointments")}</TableHead>
              <TableHead className="text-right">{t("Revenue")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium text-stone-800">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row.appointments}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(row.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-stone-500">{t("No appointments in this period.")}</p>
      )}
    </section>
  );

  const monthLabel = formatDate(new Date(`${month}-01T12:00:00`), { month: "long", year: "numeric" });

  return (
    <AppShell
      title={t("Reports")}
      subtitle={t("Review appointments and completed revenue for the selected month.")}
      actions={
        <Button
          variant="outline"
          data-testid="report-export-button"
          disabled={!appointments.length || reportQuery.isError}
          onClick={exportCsv}
          className="bg-white"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{t("Export CSV")}</span>
        </Button>
      }
    >
      <div className="space-y-6 px-6 py-6 lg:px-8" data-testid="reports-page">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-stone-500">{t("Month")}</p>
            <p className="mt-1 font-heading text-xl font-semibold capitalize text-stone-900">
              {monthLabel}
            </p>
          </div>
          <Input
            type="month"
            aria-label={t("Month")}
            data-testid="report-month-input"
            value={month}
            max={format(new Date(), "yyyy-MM")}
            onChange={(event) => {
              if (event.target.value) setMonth(event.target.value);
            }}
            className="w-full bg-white sm:w-48"
          />
        </div>

        {reportQuery.isError ? (
          <div className="rounded-2xl border border-[#E5DCD0] bg-white px-6 py-12 text-center">
            <p className="text-sm text-stone-600">{t("Could not load this report.")}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void reportQuery.refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              {t("Try again")}
            </Button>
          </div>
        ) : reportQuery.isPending ? (
          <div className="rounded-2xl border border-[#E5DCD0] bg-white px-6 py-12 text-center text-sm text-stone-500">
            {t("Loading…")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map(({ label, value, hint, accent }) => (
                <article
                  key={label}
                  className="rounded-2xl border border-[#E5DCD0] bg-white p-5 shadow-[0_1px_3px_0_rgba(44,30,20,0.04),0_6px_16px_-4px_rgba(44,30,20,0.06)]"
                >
                  <p className="font-mono text-xs uppercase tracking-wider text-stone-500">{label}</p>
                  <p className={`mt-3 font-heading text-3xl font-semibold ${accent ? "text-[#8F4E34]" : "text-stone-900"}`}>
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">{hint}</p>
                </article>
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              {renderBreakdown("Appointments by stylist", byStylist)}
              {renderBreakdown("Service performance", byService)}
            </div>
            {appointments.length > 0 && (
              <p className="text-right text-xs text-stone-500">
                <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
                {formatDate(parseISO(`${fromDate}T12:00:00`))} – {formatDate(parseISO(`${toDate}T12:00:00`))}
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function ReportsPage() {
  const user = useUser();
  if (user.role !== "admin") return <Navigate to="/agenda" replace />;
  return <ReportsDashboard />;
}
