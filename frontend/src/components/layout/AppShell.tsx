import { useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronUp,
  LogOut,
  Palette,
  Scissors,
  Tag,
  Users,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";
import { logout } from "@/lib/session";
import { useUser } from "@/lib/userContext";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { salonThemeStyle, useSalonBranding } from "@/lib/booking";

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

// Warm editorial shell: espresso sidebar + parchment top bar over a grain-washed scroll area.
export default function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUser();
  const { t } = useI18n();
  const { data: branding } = useSalonBranding();
  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t("Signed out — see you soon"));
      navigate("/login", { replace: true });
    } catch {
      toast.error(t("Could not sign out. Please try again."));
    }
  };
  useLayoutEffect(() => {
    if (!branding) return;
    const root = document.documentElement;
    const theme = salonThemeStyle(branding);
    const previous = new Map<string, string>();
    for (const [property, value] of Object.entries(theme)) {
      previous.set(property, root.style.getPropertyValue(property));
      root.style.setProperty(property, value);
    }
    return () => {
      for (const [property, value] of previous) {
        if (value) root.style.setProperty(property, value);
        else root.style.removeProperty(property);
      }
    };
  }, [branding]);
  const primaryItems = [
    { to: "/app", label: "Clients", icon: Users, testid: "nav-clients" },
    { to: "/agenda", label: "Agenda", icon: CalendarDays, testid: "nav-agenda" },
    { to: "/stylists", label: "Stylists", icon: Scissors, testid: "nav-stylists" },
  ];
  const moreItems = [
    { to: "/servicos", label: "Services", icon: Tag, testid: "nav-services" },
    { to: "/team", label: "Team", icon: UserRoundCog, testid: "nav-team" },
    { to: "/reports", label: "Reports", icon: BarChart3, testid: "nav-reports" },
    ...(user.role === "admin"
      ? [{ to: "/booking-settings", label: "Online booking", icon: CalendarCheck, testid: "nav-booking-settings" }]
      : []),
    ...(user.role === "admin"
      ? [{ to: "/branding", label: "Salon appearance", icon: Palette, testid: "nav-branding" }]
      : []),
  ];
  const moreIsActive = moreItems.some((item) => location.pathname === item.to);

  return (
    <div
      className="flex h-dvh min-h-dvh overflow-hidden bg-background text-foreground"
      style={
        branding
          ? salonThemeStyle(branding)
          : salonThemeStyle({ primary_color: "#8F4E34", accent_color: "#D97757" })
      }
    >
      <Sidebar branding={branding} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav title={title} subtitle={subtitle} actions={actions} />
        <main className="min-h-0 flex-1 overflow-y-auto bg-grain pb-2 md:pb-0" data-testid="main-scroll-region">
          {children}
        </main>
        <nav
          aria-label={t("Main navigation")}
          data-testid="mobile-navigation"
          className="relative z-30 flex flex-none border-t border-[#E7DFD5] bg-white/95 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-4px_18px_-12px_rgba(44,30,20,0.2)] backdrop-blur-md md:hidden"
        >
          {primaryItems.map(({ to, label, icon: Icon, testid }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                data-testid={testid}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F4E34]",
                  active ? "text-[var(--brand-primary,#8F4E34)]" : "text-stone-500 hover:text-stone-900"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{t(label)}</span>
              </Link>
            );
          })}
          {user.role === "admin" && (
            <div
              className="relative flex min-w-0 flex-1"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setMoreOpen(false);
              }}
            >
              {moreOpen && (
                <div
                  id="mobile-more-menu"
                  className="absolute right-0 bottom-full mb-3 w-52 rounded-2xl border border-[#E5DCD0] bg-white p-2 shadow-xl"
                  data-testid="mobile-more-menu"
                >
                  {moreItems.map(({ to, label, icon: Icon, testid }) => {
                    const active = location.pathname === to;
                    return (
                      <Link
                        key={to}
                        to={to}
                        data-testid={testid}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#8F4E34]",
                          active ? "bg-[#F3ECE1] text-[var(--brand-primary,#8F4E34)]" : "text-stone-700 hover:bg-[#FAF7F2]"
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {t(label)}
                      </Link>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                aria-label={t("More")}
                aria-expanded={moreOpen}
                aria-controls="mobile-more-menu"
                data-testid="nav-more"
                onClick={() => setMoreOpen((open) => !open)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F4E34]",
                  moreOpen || moreIsActive ? "text-[var(--brand-primary,#8F4E34)]" : "text-stone-500 hover:text-stone-900"
                )}
              >
                <ChevronUp className={cn("h-5 w-5 transition-transform", moreOpen && "rotate-180")} aria-hidden="true" />
                <span>{t("More")}</span>
              </button>
            </div>
          )}
          <button
            type="button"
            aria-label={t("Sign out")}
            data-testid="mobile-logout-button"
            onClick={handleLogout}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium text-stone-500 transition-colors hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F4E34]"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">{t("Sign out")}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
