import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Scissors, Tag, Users } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useUser } from "@/lib/userContext";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { to: "/", label: "Clients", icon: Users, testid: "nav-clients", adminOnly: false },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, testid: "nav-agenda", adminOnly: false },
  { to: "/stylists", label: "Stylists", icon: Scissors, testid: "nav-stylists", adminOnly: false },
  { to: "/servicos", label: "Services", icon: Tag, testid: "nav-services", adminOnly: true },
];

interface TopNavProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function TopNav({ title, subtitle, actions }: TopNavProps) {
  const location = useLocation();
  const user = useUser();
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    retry: false,
  });

  return (
    <header className="sticky top-0 z-20 flex h-18 flex-shrink-0 items-center justify-between gap-4 border-b border-[#E7DFD5] bg-[#FAF7F2]/90 px-6 backdrop-blur-md lg:px-8">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5 md:hidden">
          {MOBILE_NAV.filter((item) => !item.adminOnly || user.role === "admin").map((item) => (
            <Link
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              aria-label={item.label}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                location.pathname === item.to ? "bg-[#8F4E34] text-white" : "text-stone-500"
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
            </Link>
          ))}
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-stone-900">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-[#E7DFD5] bg-white px-3 py-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2D6A4F]" />
          <span className="font-mono text-xs uppercase tracking-wider text-stone-500">
            {stats ? formatDate(stats.today) : "—"}
          </span>
        </div>
        {actions}
      </div>
    </header>
  );
}
