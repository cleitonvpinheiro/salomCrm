import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { Client, Stylist } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import DateField from "@/components/clients/DateField";

interface ClientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null; // null → create mode
}

export default function ClientFormModal({ open, onOpenChange, client }: ClientFormModalProps) {
  const qc = useQueryClient();
  const { data: stylists } = useQuery({
    queryKey: ["stylists"],
    queryFn: () => apiGet<Stylist[]>("/stylists"),
    enabled: open,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState<string | null>(null);
  const [stylistId, setStylistId] = useState("none");
  const [hairType, setHairType] = useState("");
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [formula, setFormula] = useState("");
  const [tagsText, setTagsText] = useState("");

  // Re-seed the fields each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(client?.name ?? "");
    setPhone(client?.phone ?? "");
    setEmail(client?.email ?? "");
    setBirthday(client?.birthday ?? null);
    setStylistId(client?.stylist_id ?? "none");
    setHairType(client?.hair_type ?? "");
    setLastVisit(client?.last_visit ?? null);
    setFormula(client?.formula ?? "");
    setTagsText((client?.tags ?? []).join(", "));
  }, [open, client]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        birthday,
        stylist_id: stylistId === "none" ? null : stylistId,
        hair_type: hairType.trim() || null,
        last_visit: lastVisit,
        formula: formula.trim() || null,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      return client
        ? apiPut<Client>(`/clients/${client.id}`, payload)
        : apiPost<Client>("/clients", payload);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["stylists"] });
      qc.invalidateQueries({ queryKey: ["client", saved.id] });
      toast.success(client ? `${saved.name} updated` : `${saved.name} added to the book`);
      onOpenChange(false);
    },
    onError: () => toast.error("Could not save the client — check the fields and try again"),
  });

  const stylistLabel = (id: string) =>
    id === "none"
      ? "Unassigned"
      : (stylists?.find((s) => s.id === id)?.name ?? "Unassigned");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto rounded-xl sm:max-w-lg"
        data-testid="client-form-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {client ? "Edit client" : "New client"}
          </DialogTitle>
          <DialogDescription>
            {client
              ? "Update details, stylist assignment, last visit and formula."
              : "Add someone new to the client book."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length === 0) {
              toast.error("A name is required");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="client-name">Full name</Label>
            <Input
              id="client-name"
              data-testid="client-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beatriz Carvalho"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                data-testid="client-phone-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 11 91234-0091"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                type="email"
                data-testid="client-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="client-birthday">Birthday</Label>
              <DateField
                testid="client-birthday-input"
                value={birthday}
                onChange={setBirthday}
                placeholder="Birthday"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="client-last-visit">Last visit</Label>
              <DateField
                testid="client-last-visit-input"
                value={lastVisit}
                onChange={setLastVisit}
                placeholder="Last visit"
                disableFuture
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="client-stylist">Preferred stylist</Label>
            <Select
              value={stylistId}
              onValueChange={(v) => setStylistId(v)}
            >
              <SelectTrigger id="client-stylist" data-testid="client-stylist-select" className="w-full">
                <SelectValue>{() => stylistLabel(stylistId)}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="client-stylist-options">
                <SelectItem value="none">Unassigned</SelectItem>
                {(stylists ?? [])
                  .filter((s) => s.active || s.id === client?.stylist_id)
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
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="client-hair-type">Hair type / texture</Label>
            <Input
              id="client-hair-type"
              data-testid="client-hair-type-input"
              value={hairType}
              onChange={(e) => setHairType(e.target.value)}
              placeholder="e.g. Fine, colour-treated"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="client-formula">Colour formula / recipe</Label>
            <Textarea
              id="client-formula"
              data-testid="client-formula-input"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="e.g. Wella Illumina 7/81 + 6% at roots, toner 9/60 gloss"
              rows={2}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="client-tags">Tags</Label>
            <Input
              id="client-tags"
              data-testid="client-tags-input"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="VIP, sensitive scalp, no ammonia"
            />
            <p className="text-xs text-stone-400">Separate tags with commas.</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-testid="client-form-cancel"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="save-client-submit">
              {mutation.isPending ? "Saving…" : client ? "Save changes" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
