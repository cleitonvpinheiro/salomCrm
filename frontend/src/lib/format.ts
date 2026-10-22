import { format, parseISO } from "date-fns";

/** "2026-02-15" (or an ISO datetime) → "15 Feb 2026"; falls back to the raw string. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

export type VisitTone = "none" | "recent" | "ok" | "recall";

export interface VisitMeta {
  labelKey: string;
  tone: VisitTone;
  params?: Record<string, number>;
}

/** Relative "last visit" wording. Recall threshold matches RECALL_DAYS (56) server-side. */
export function visitMeta(days: number | null | undefined): VisitMeta {
  if (days === null || days === undefined) {
    return { labelKey: "No visit logged", tone: "none" };
  }
  if (days === 0) return { labelKey: "Visited today", tone: "recent" };
  if (days === 1) return { labelKey: "Yesterday", tone: "recent" };
  if (days <= 20) return { labelKey: "{days} days ago", tone: "recent", params: { days } };
  const weeks = Math.round(days / 7);
  if (weeks === 1) return { labelKey: "1 week ago", tone: "ok" };
  if (days <= 56) return { labelKey: "{weeks} weeks ago", tone: "ok", params: { weeks } };
  return { labelKey: "{weeks} weeks ago · recall due", tone: "recall", params: { weeks } };
}

/** Warm chip colours per visit tone (design guidelines palette). */
export function toneClass(tone: VisitTone): string {
  switch (tone) {
    case "recent":
      return "bg-[#EBF4EE] text-[#235937]";
    case "recall":
    case "none":
      return "bg-[#FDF2E9] text-[#9A4B1A]";
    default:
      return "bg-[#F3ECE1] text-[#57534E]";
  }
}

/** "Beatriz Carvalho" → "BC" */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** "14:30" + 90 → "16:00" */
export function addMinutes(time: string, minutes: number): string {
  const parts = time.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 120 → "R$ 120,00" */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
