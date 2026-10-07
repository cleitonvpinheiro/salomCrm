import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const label = value ? formatDateSafe(value) : (placeholder ?? "Pick a date");

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
          aria-label="Clear date"
          data-testid={`${testid}-clear`}
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function formatDateSafe(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}
