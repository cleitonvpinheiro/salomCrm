import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Scissors, Sparkles, Users } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Clients", icon: Users, testid: "nav-clients" },
  { to: "/stylists", label: "Stylists", icon: Scissors, testid: "nav-stylists" },
];

export default function Sidebar() {
  const location = useLocation();
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    retry: false,
  });

  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col justify-between border-r border-[#2E2520] bg-[#221C18] text-[#F5EFE6] md:flex">
      <div>
        <div className="flex items-center gap-3 px-6 pb-6 pt-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D97757]/15 text-[#D97757]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-heading text-xl font-semibold tracking-tight">Atelier</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#A89F91]">
              Salon CRM
            </p>
          </div>
        </div>
        <nav className="space-y-1 px-3" data-testid="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon, testid }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                data-testid={testid}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ease-out",
                  active
                    ? "bg-[#342C26] text-[#F5EFE6]"
                    : "text-[#A89F91] hover:bg-[#342C26]/60 hover:text-[#F5EFE6]"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                {active && stats && (
                  <span className="font-mono text-xs text-[#D97757]">
                    {to === "/" ? stats.total_clients : stats.active_stylists}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="px-6 pb-6">
        <div className="rounded-xl border border-[#2E2520] bg-[#342C26]/50 p-4">
          <div className="flex items-center gap-2 text-[#D97757]">
            <CalendarClock className="h-4 w-4" />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em]">Recall due</p>
          </div>
          <p
            className="mt-2 font-heading text-3xl font-semibold text-[#F5EFE6]"
            data-testid="sidebar-recall-due"
          >
            {stats?.recall_due ?? "—"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#A89F91]">
            {stats
              ? `${stats.unassigned} client${stats.unassigned === 1 ? "" : "s"} without a stylist`
              : "Loading workspace…"}
          </p>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-[#A89F91]">
          Shared staff workspace — open to the whole team, no sign-in.
        </p>
      </div>
    </aside>
  );
}
