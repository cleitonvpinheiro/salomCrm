import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, LogOut, Scissors, Sparkles, Tag, Users, UserRoundCog } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { logout } from "@/lib/session";
import { initials } from "@/lib/format";
import { useUser } from "@/lib/userContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUser();
  const { t } = useI18n();
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    retry: false,
  });

  const nav = [
    { to: "/app", label: "Clients", icon: Users, testid: "nav-clients" },
    { to: "/agenda", label: "Agenda", icon: CalendarDays, testid: "nav-agenda" },
    { to: "/stylists", label: "Stylists", icon: Scissors, testid: "nav-stylists" },
    ...(user.role === "admin"
      ? [{ to: "/servicos", label: "Services", icon: Tag, testid: "nav-services" }]
      : []),
    ...(user.role === "admin"
      ? [{ to: "/team", label: "Team", icon: UserRoundCog, testid: "nav-team" }]
      : []),
  ];

  const handleLogout = async () => {
    await logout();
    toast.success(t("Signed out — see you soon"));
    navigate("/login", { replace: true });
  };

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
              {user.tenant_slug} · CRM
            </p>
          </div>
        </div>
        <nav className="space-y-1 px-3" data-testid="sidebar-nav">
          {nav.map(({ to, label, icon: Icon, testid }) => {
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
                  {t(label)}
                </span>
                {active && stats && (
                  <span className="font-mono text-xs text-[#D97757]">
                    {to === "/app"
                      ? stats.total_clients
                      : to === "/stylists"
                        ? stats.active_stylists
                        : to === "/agenda"
                          ? stats.visits_this_month
                          : undefined}
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
            <CalendarDays className="h-4 w-4" />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em]">{t("Recall due")}</p>
          </div>
          <p
            className="mt-2 font-heading text-3xl font-semibold text-[#F5EFE6]"
            data-testid="sidebar-recall-due"
          >
            {stats?.recall_due ?? "—"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#A89F91]">
            {stats
              ? `${stats.unassigned} ${t(stats.unassigned === 1 ? "client" : "clients")} ${t("without a stylist")}`
              : t("Loading workspace…")}
          </p>
        </div>

        <div
          className="mt-3 flex items-center gap-3 rounded-xl border border-[#2E2520] bg-[#342C26]/50 p-3"
          data-testid="sidebar-user-chip"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#D97757]/15 font-heading text-sm font-semibold text-[#D97757]">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#F5EFE6]">{user.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A89F91]">
              {t(user.role === "admin" ? "Administrator" : "Team")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("Sign out")}
            data-testid="logout-button"
            onClick={handleLogout}
            className="flex-none text-[#A89F91] hover:text-[#F5EFE6]"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
