import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Cake, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { Client, Note, NoteKind, Stylist } from "@/lib/types";
import { formatDate, initials, toneClass, visitMeta } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import NotesTimeline from "@/components/clients/NotesTimeline";

const KIND_LABELS: Record<NoteKind, string> = {
  visit: "Visit log",
  formula: "Formula",
  allergy: "Allergy alert",
  general: "General note",
};

interface ClientDetailDrawerProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: Client) => void;
  onDeleteRequest: (client: Client) => void;
}

export default function ClientDetailDrawer({
  clientId,
  open,
  onOpenChange,
  onEdit,
  onDeleteRequest,
}: ClientDetailDrawerProps) {
  const qc = useQueryClient();
  const [noteBody, setNoteBody] = useState("");
  const [noteKind, setNoteKind] = useState<NoteKind>("general");

  const enabled = open && clientId !== null;

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => apiGet<Client>(`/clients/${clientId}`),
    enabled,
    retry: false,
  });
  const { data: stylists } = useQuery({
    queryKey: ["stylists"],
    queryFn: () => apiGet<Stylist[]>("/stylists"),
    enabled,
    retry: false,
  });
  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ["notes", clientId],
    queryFn: () => apiGet<Note[]>(`/clients/${clientId}/notes`),
    enabled,
    retry: false,
  });

  const refreshClient = () => {
    qc.invalidateQueries({ queryKey: ["client", clientId] });
    qc.invalidateQueries({ queryKey: ["notes", clientId] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["stylists"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const reassign = useMutation({
    mutationFn: (stylist_id: string | null) => {
      if (!clientId) throw new Error("no client selected");
      return apiPut<Client>(`/clients/${clientId}`, { stylist_id });
    },
    onSuccess: (updated) => {
      refreshClient();
      toast.success(updated.stylist_name ? `Reassigned to ${updated.stylist_name}` : "Stylist unassigned");
    },
    onError: () => toast.error("Could not reassign the stylist"),
  });

  const addNote = useMutation({
    mutationFn: () => {
      if (!clientId) throw new Error("no client selected");
      return apiPost<Note>(`/clients/${clientId}/notes`, {
        body: noteBody.trim(),
        kind: noteKind,
      });
    },
    onSuccess: () => {
      setNoteBody("");
      setNoteKind("general");
      refreshClient();
      toast.success("Note added");
    },
    onError: () => toast.error("Could not add the note"),
  });

  const logVisit = useMutation({
    mutationFn: () => {
      if (!clientId) throw new Error("no client selected");
      return apiPost<Note>(`/clients/${clientId}/notes`, {
        body: "Visit logged from the client book.",
        kind: "visit",
      });
    },
    onSuccess: () => {
      refreshClient();
      toast.success(`Visit logged for ${client?.name ?? "client"}`);
    },
    onError: () => toast.error("Could not log the visit"),
  });

  const meta = visitMeta(client?.days_since_visit);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto sm:max-w-xl"
        data-testid="client-detail-drawer"
      >
        {!client ? (
          <div className="p-6 text-sm text-stone-500">
            {isLoading ? "Loading client…" : "Select a client to see their history."}
          </div>
        ) : (
          <div className="flex min-h-full flex-col">
            <SheetHeader className="border-b border-[#EFE9DF] pb-4">
              <div className="flex items-center gap-3 pr-8">
                <span
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-full font-heading text-lg font-semibold"
                  style={{
                    backgroundColor: `${(client.stylist_color ?? "#8F4E34") as string}1A`,
                    color: client.stylist_color ?? "#8F4E34",
                  }}
                >
                  {initials(client.name)}
                </span>
                <div className="min-w-0">
                  <SheetTitle className="font-heading text-2xl font-semibold text-stone-900">
                    {client.name}
                  </SheetTitle>
                  <SheetDescription>
                    {client.stylist_name
                      ? `Client of ${client.stylist_name}`
                      : "No preferred stylist yet"}
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${toneClass(meta.tone)}`}
                  data-testid="drawer-visit-badge"
                >
                  {meta.label}
                </span>
                {client.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#FBEFE9] px-2.5 py-0.5 text-[11px] font-medium text-[#8F4E34]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </SheetHeader>

            <div className="grid gap-5 p-4">
              <section className="grid gap-2">
                <h3 className="font-mono text-xs uppercase tracking-widest text-stone-500">
                  Contact
                </h3>
                <div className="grid gap-1.5 text-sm text-stone-700">
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-none text-stone-400" />
                    {client.phone ?? "—"}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 flex-none text-stone-400" />
                    {client.email ?? "—"}
                  </p>
                  <p className="flex items-center gap-2">
                    <Cake className="h-4 w-4 flex-none text-stone-400" />
                    Born {formatDate(client.birthday)}
                  </p>
                </div>
              </section>

              <section className="grid gap-2">
                <h3 className="font-mono text-xs uppercase tracking-widest text-stone-500">
                  Hair profile
                </h3>
                <p className="text-sm text-stone-700">
                  <span className="text-stone-500">Type:</span> {client.hair_type ?? "—"}
                </p>
                {client.formula && (
                  <div className="rounded-lg bg-[#F3ECE1] p-3 font-mono text-xs leading-relaxed text-[#57534E]">
                    {client.formula}
                  </div>
                )}
              </section>

              <section className="grid gap-2">
                <h3 className="font-mono text-xs uppercase tracking-widest text-stone-500">
                  Preferred stylist
                </h3>
                <Select
                  value={client.stylist_id ?? "none"}
                  onValueChange={(v) => reassign.mutate(v === "none" ? null : v)}
                >
                  <SelectTrigger data-testid="drawer-stylist-select" className="w-full bg-white">
                    <SelectValue>{() => client.stylist_name ?? "Unassigned"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent data-testid="drawer-stylist-options">
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(stylists ?? [])
                      .filter((s) => s.active || s.id === client.stylist_id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </section>

              <section className="flex items-center justify-between gap-3 rounded-xl border border-[#EFE9DF] bg-white p-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-stone-500">
                    Last visit
                  </p>
                  <p className="text-sm font-medium text-stone-900">
                    {formatDate(client.last_visit)}
                  </p>
                  <p className="text-xs text-stone-500">{meta.label}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => logVisit.mutate()}
                  disabled={logVisit.isPending}
                  data-testid="log-visit-btn"
                >
                  <CalendarCheck className="h-4 w-4" />
                  {logVisit.isPending ? "Logging…" : "Log today"}
                </Button>
              </section>

              <section className="grid gap-3">
                <h3 className="font-mono text-xs uppercase tracking-widest text-stone-500">
                  Notes & history
                </h3>
                {notesLoading ? (
                  <div className="grid gap-2">
                    <div className="h-16 animate-pulse rounded-xl bg-[#F3ECE1]" />
                    <div className="h-16 animate-pulse rounded-xl bg-[#F3ECE1]" />
                  </div>
                ) : (
                  <NotesTimeline notes={notes ?? []} />
                )}
                <div className="grid gap-2 rounded-xl border border-[#E7DFD5] bg-[#FAF7F2] p-3">
                  <Textarea
                    data-testid="note-input"
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Add a note — formulas, preferences, allergies…"
                    rows={3}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Select
                      value={noteKind}
                      onValueChange={(v) => setNoteKind(v as NoteKind)}
                    >
                      <SelectTrigger size="sm" data-testid="note-kind-select" className="w-40 bg-white">
                        <SelectValue>{() => KIND_LABELS[noteKind]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent data-testid="note-kind-options">
                        {(Object.keys(KIND_LABELS) as NoteKind[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={addNote.isPending}
                      data-testid="add-note-btn"
                      onClick={() => {
                        if (noteBody.trim().length === 0) {
                          toast.error("Write the note first");
                          return;
                        }
                        addNote.mutate();
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {addNote.isPending ? "Adding…" : "Add note"}
                    </Button>
                  </div>
                </div>
              </section>
            </div>

            <SheetFooter className="border-t border-[#EFE9DF]">
              <Button
                variant="outline"
                onClick={() => onEdit(client)}
                data-testid="edit-client-btn"
              >
                <Pencil className="h-4 w-4" /> Edit client
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onDeleteRequest(client)}
                data-testid="delete-client-btn"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
