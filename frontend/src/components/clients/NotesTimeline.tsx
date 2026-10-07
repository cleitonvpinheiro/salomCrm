import { format, parseISO } from "date-fns";
import { Palette, Scissors, ShieldAlert, StickyNote } from "lucide-react";
import type { Note, NoteKind } from "@/lib/types";

const KIND_META: Record<NoteKind, { label: string; icon: typeof Scissors; className: string }> = {
  visit: { label: "Visit", icon: Scissors, className: "bg-[#EBF4EE] text-[#235937]" },
  formula: { label: "Formula", icon: Palette, className: "bg-[#FBEFE9] text-[#8F4E34]" },
  allergy: { label: "Allergy", icon: ShieldAlert, className: "bg-[#FDF2E9] text-[#9A4B1A]" },
  general: { label: "Note", icon: StickyNote, className: "bg-[#F3ECE1] text-[#57534E]" },
};

export default function NotesTimeline({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#E7DFD5] px-4 py-6 text-center text-sm text-stone-500">
        No notes yet — add the first one below.
      </p>
    );
  }

  return (
    <ol className="space-y-3" data-testid="notes-timeline">
      {notes.map((note) => {
        const meta = KIND_META[(note.kind as NoteKind) ?? "general"] ?? KIND_META.general;
        const Icon = meta.icon;
        let when = note.created_at;
        try {
          when = format(parseISO(note.created_at), "d MMM yyyy");
        } catch {
          // keep raw
        }
        return (
          <li
            key={note.id}
            data-testid={`note-item-${note.id}`}
            className="rounded-xl border border-[#EFE9DF] bg-white p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                <Icon className="h-3 w-3" />
                {meta.label}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone-400">{when}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">{note.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
