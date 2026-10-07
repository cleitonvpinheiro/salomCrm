import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Scissors, UserRound, UserRoundX } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Stats } from "@/lib/types";

export default function KpiStatCards() {
  const { data: stats, isError } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    retry: false,
  });

  const cards = [
    { testid: "kpi-total-clients", label: "Total clients", value: stats?.total_clients, icon: UserRound, hint: "in the book" },
    { testid: "kpi-active-stylists", label: "Active stylists", value: stats?.active_stylists, icon: Scissors, hint: "on the floor" },
    { testid: "kpi-visits-this-month", label: "Visits this month", value: stats?.visits_this_month, icon: CalendarCheck, hint: "logged so far" },
    { testid: "kpi-recall-due", label: "Recall due", value: stats?.recall_due, icon: UserRoundX, hint: "no visit in 8+ weeks" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ testid, label, value, icon: Icon, hint }) => (
        <div
          key={testid}
          data-testid={testid}
          className="rounded-2xl border border-[#E5DCD0] bg-white p-5 shadow-[0_1px_3px_0_rgba(44,30,20,0.04),0_6px_16px_-4px_rgba(44,30,20,0.06)] transition-transform duration-150 ease-out hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-stone-500">{label}</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3ECE1] text-[#8F4E34]">
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-heading text-3xl font-semibold text-stone-900">
            {isError ? "—" : (value ?? "…")}
          </p>
          <p className="mt-1 text-xs text-stone-500">{hint}</p>
        </div>
      ))}
    </div>
  );
}
