import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, Scissors, Tag, Users, UserRoundCog } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { useUser } from "@/lib/userContext";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

const MOBILE_NAV = [
  { to: "/app", label: "Clients", icon: Users, testid: "nav-clients", adminOnly: false },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, testid: "nav-agenda", adminOnly: false },
  { to: "/stylists", label: "Stylists", icon: Scissors, testid: "nav-stylists", adminOnly: false },
  { to: "/servicos", label: "Services", icon: Tag, testid: "nav-services", adminOnly: true },
  { to: "/team", label: "Team", icon: UserRoundCog, testid: "nav-team", adminOnly: true },
  { to: "/reports", label: "Reports", icon: BarChart3, testid: "nav-reports", adminOnly: true },
];

interface TopNavProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function TopNav({ title, subtitle, actions }: TopNavProps) {
  const { t, formatDate: formatLocaleDate } = useI18n();
  const location = useLocation();
  const user = useUser();
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    retry: false,
  });

  return (
    <header className="sticky top-0 z-20 flex flex-shrink-0 flex-col gap-2 border-b border-[#E7DFD5] bg-[#FAF7F2]/90 px-4 py-3 backdrop-blur-md sm:px-6 md:min-h-18 md:flex-row md:items-center md:justify-between md:gap-3 md:py-3 lg:px-8">
      <nav aria-label={t("Main navigation")} className="flex max-w-full items-center gap-1 overflow-x-auto pb-1 md:hidden">
          {MOBILE_NAV.filter((item) => !item.adminOnly || user.role === "admin").map((item) => (
            <Link
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              aria-label={t(item.label)}
              title={t(item.label)}
              className={cn(
                "flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors",
                location.pathname === item.to ? "bg-[#8F4E34] text-white" : "text-stone-500"
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
            </Link>
          ))}
      </nav>
      <div className="flex min-w-0 items-center justify-between gap-2 md:flex-1">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            {t(title)}
          </h1>
          {subtitle && <p className="hidden max-w-full truncate text-xs text-stone-500 sm:block">{t(subtitle)}</p>}
        </div>
        <div className="flex flex-none items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-[#E7DFD5] bg-white px-3 py-1.5 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2D6A4F]" />
          <span className="font-mono text-xs uppercase tracking-wider text-stone-500">
            {stats ? formatLocaleDate(new Date(`${stats.today}T12:00:00`)) : "—"}
          </span>
          </div>
          <LanguageSwitcher compact />
          {actions}
        </div>
      </div>
    </header>
  );
}
