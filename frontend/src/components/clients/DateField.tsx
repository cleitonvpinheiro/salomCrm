import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { enUS, es, ptBR } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateFieldProps {
  value: string | null; // "YYYY-MM-DD" or null
  onChange: (value: string | null) => void;
  placeholder?: string;
  testid: string;
  disableFuture?: boolean;
}

// Popover + Calendar picker; the value stays an ISO "YYYY-MM-DD" string end to end.
export default function DateField({ value, onChange, placeholder, testid, disableFuture }: DateFieldProps) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const dateLocale = locale === "pt-BR" ? ptBR : locale === "es" ? es : enUS;
  const label = value ? formatDateSafe(value, locale) : (placeholder ?? "Pick a date");

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              data-testid={testid}
              className="w-full justify-between bg-white font-normal"
            >
              <span className="flex items-center gap-2 truncate">
                <CalendarIcon className="h-4 w-4 flex-none text-stone-400" />
                <span className={value ? "text-stone-800" : "text-stone-400"}>{label}</span>
              </span>
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={dateLocale}
            selected={value ? new Date(`${value}T00:00:00`) : undefined}
            defaultMonth={value ? new Date(`${value}T00:00:00`) : undefined}
            disabled={disableFuture ? { after: new Date() } : undefined}
            onSelect={(day) => {
              onChange(day ? format(day, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={locale === "pt-BR" ? "Limpar data" : locale === "es" ? "Borrar fecha" : "Clear date"}
          data-testid={`${testid}-clear`}
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function formatDateSafe(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parseISO(iso));
  } catch {
    return iso;
  }
}
