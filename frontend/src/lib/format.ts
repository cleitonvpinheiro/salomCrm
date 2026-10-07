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
  label: string;
  tone: VisitTone;
}

/** Relative "last visit" wording. Recall threshold matches RECALL_DAYS (56) server-side. */
export function visitMeta(days: number | null | undefined): VisitMeta {
  if (days === null || days === undefined) {
    return { label: "No visit logged", tone: "none" };
  }
  if (days === 0) return { label: "Visited today", tone: "recent" };
  if (days === 1) return { label: "Yesterday", tone: "recent" };
  if (days <= 20) return { label: `${days} days ago`, tone: "recent" };
  const weeks = Math.round(days / 7);
  const base = weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  if (days <= 56) return { label: base, tone: "ok" };
  return { label: `${base} · recall due`, tone: "recall" };
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
