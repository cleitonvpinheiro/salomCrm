import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import type { Service } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";

interface ServiceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null; // null → create mode
}

export default function ServiceFormModal({ open, onOpenChange, service }: ServiceFormModalProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [price, setPrice] = useState("0");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setDurationMin(String(service?.duration_min ?? 30));
    setPrice(String(service?.price ?? 0));
    setActive(service?.active ?? true);
  }, [open, service]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        duration_min: Math.max(5, Math.round(Number(durationMin) || 30)),
        price: Math.max(0, Number(price) || 0),
        active,
      };
      return service
        ? apiPut<Service>(`/services/${service.id}`, payload)
        : apiPost<Service>("/services", payload);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(
        service
          ? t("{name} updated", { name: saved.name })
          : t("{name} added to the menu", { name: saved.name })
      );
      onOpenChange(false);
    },
    onError: () => toast.error(t("Could not save the service — check the fields")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-md" data-testid="service-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {service ? t("Edit service") : t("New service")}
          </DialogTitle>
          <DialogDescription>{t("The menu the whole team books from.")}</DialogDescription>
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
            <Label htmlFor="service-name">{t("Name")}</Label>
            <Input
              id="service-name"
              data-testid="service-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("e.g. Signature Cut & Blow-Dry")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="service-duration">{t("Duration (min)")}</Label>
              <Input
                id="service-duration"
                type="number"
                min={5}
                step={5}
                data-testid="service-duration-input"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="service-price">{t("Price (R$)")}</Label>
              <Input
                id="service-price"
                type="number"
                min={0}
                step={10}
                data-testid="service-price-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="service-description">{t("Description")}</Label>
            <Textarea
              id="service-description"
              data-testid="service-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("What's included, product lines, finish… — optional")}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="service-active"
              data-testid="service-active-checkbox"
              checked={active}
              onCheckedChange={(c) => setActive(c === true)}
            />
            <Label htmlFor="service-active" className="text-sm font-normal text-stone-700">
              {t("Active — available for booking")}
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-testid="service-form-cancel"
              onClick={() => onOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="save-service-submit">
              {mutation.isPending ? t("Saving…") : service ? t("Save changes") : t("Add service")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
