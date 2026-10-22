import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import type { Stylist } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const COLOR_OPTIONS = [
  { value: "#8F4E34", label: "Terracotta" },
  { value: "#B88358", label: "Caramel" },
  { value: "#2D6A4F", label: "Forest" },
  { value: "#1E3A8A", label: "Ink blue" },
  { value: "#B45309", label: "Amber" },
  { value: "#9F1239", label: "Rosewood" },
];

interface StylistFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stylist: Stylist | null; // null → create mode
}

export default function StylistFormModal({ open, onOpenChange, stylist }: StylistFormModalProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]!.value);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(stylist?.name ?? "");
    setTitle(stylist?.title ?? "");
    setColor(stylist?.color ?? COLOR_OPTIONS[0]!.value);
    setActive(stylist?.active ?? true);
  }, [open, stylist]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        title: title.trim(),
        color,
        active,
      };
      return stylist
        ? apiPut<Stylist>(`/stylists/${stylist.id}`, payload)
        : apiPost<Stylist>("/stylists", payload);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["stylists"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(
        stylist
          ? t("{name} updated", { name: saved.name })
          : t("{name} joined the roster", { name: saved.name })
      );
      onOpenChange(false);
    },
    onError: () => toast.error(t("Could not save the stylist — check the fields and try again")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-md" data-testid="stylist-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {stylist ? t("Edit stylist") : t("New stylist")}
          </DialogTitle>
          <DialogDescription>
            {stylist
              ? t("Update the profile, colour tag and floor status.")
              : t("Add a stylist to the roster — clients can be assigned afterwards.")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length === 0) {
              toast.error(t("A name is required"));
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="stylist-name">{t("Name")}</Label>
            <Input
              id="stylist-name"
              data-testid="stylist-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("e.g. Elena Vance")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stylist-title">{t("Specialty / title")}</Label>
            <Input
              id="stylist-title"
              data-testid="stylist-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("e.g. Senior Master Stylist · Balayage")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stylist-color">{t("Colour tag")}</Label>
            <Select value={color} onValueChange={(v) => setColor(v)}>
              <SelectTrigger id="stylist-color" data-testid="stylist-color-select" className="w-full">
                <SelectValue>{() => t(COLOR_OPTIONS.find((c) => c.value === color)?.label ?? "Colour")}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="stylist-color-options">
                {COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.value }} />
                      {t(c.label)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stylist-active"
              data-testid="stylist-active-checkbox"
              checked={active}
              onCheckedChange={(c) => setActive(c === true)}
            />
            <Label htmlFor="stylist-active" className="text-sm font-normal text-stone-700">
              {t("Active on the floor")}
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-testid="stylist-form-cancel"
              onClick={() => onOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="save-stylist-submit">
              {mutation.isPending ? t("Saving…") : stylist ? t("Save changes") : t("Add stylist")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
