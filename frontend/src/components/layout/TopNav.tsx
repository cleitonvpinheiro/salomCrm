import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

interface TopNavProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function TopNav({ title, subtitle, actions }: TopNavProps) {
  const { t, formatDate: formatLocaleDate } = useI18n();
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    retry: false,
  });

  return (
    <header className="sticky top-0 z-20 flex flex-shrink-0 flex-col gap-2 border-b border-[#E7DFD5] bg-[#FAF7F2]/90 px-4 py-3 backdrop-blur-md sm:px-6 md:min-h-18 md:flex-row md:items-center md:justify-between md:gap-3 md:py-3 lg:px-8">
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
