import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Appointment, Client, PageResult, Service, Stylist } from "@/lib/types";
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

interface AppointmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  appointment: Appointment | null; // null → create mode
}

export default function AppointmentFormModal({
  open,
  onOpenChange,
  defaultDate,
  appointment,
}: AppointmentFormModalProps) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const clientsQuery = useInfiniteQuery({
    queryKey: ["clients", "name-all"],
    queryFn: ({ pageParam }) =>
      apiGet<PageResult<Client>>(
        `/clients?sort_by=name&page=${pageParam}&page_size=50`
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.page_size < lastPage.total
        ? lastPage.page + 1
        : undefined,
    enabled: open,
    retry: false,
  });
  const { data: selectedClient } = useQuery({
    queryKey: ["client", appointment?.client_id],
    queryFn: () => apiGet<Client>(`/clients/${appointment?.client_id}`),
    enabled: open && Boolean(appointment?.client_id),
    retry: false,
  });
  const clients = useMemo(() => {
    const loaded = clientsQuery.data?.pages.flatMap((result) => result.items) ?? [];
    const all = selectedClient ? [...loaded, selectedClient] : loaded;
    return [...new Map(all.map((client) => [client.id, client])).values()];
  }, [clientsQuery.data, selectedClient]);
  const { data: stylists } = useQuery({
    queryKey: ["stylists"],
    queryFn: () => apiGet<Stylist[]>("/stylists"),
    enabled: open,
    retry: false,
  });
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: () => apiGet<Service[]>("/services"),
    enabled: open,
    retry: false,
  });

  const [clientId, setClientId] = useState("none");
  const [stylistId, setStylistId] = useState("none");
  const [serviceId, setServiceId] = useState("none");
  const [date, setDate] = useState<string | null>(defaultDate);
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  // Re-seed the fields each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setClientId(appointment?.client_id ?? "none");
    setStylistId(appointment?.stylist_id ?? "none");
    setServiceId(appointment?.service_id ?? "none");
    setDate(appointment?.date ?? defaultDate);
    setTime(appointment?.time ?? "09:00");
    setNotes(appointment?.notes ?? "");
  }, [open, appointment, defaultDate]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        client_id: clientId,
        stylist_id: stylistId === "none" ? null : stylistId,
        service_id: serviceId,
        date,
        time,
        notes: notes.trim() || null,
      };
      return appointment
        ? apiPut<Appointment>(`/appointments/${appointment.id}`, payload)
        : apiPost<Appointment>("/appointments", payload);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(
        appointment
          ? t("Appointment updated")
          : t("Booked {client} at {time}", {
              client: saved.client_name ?? t("client"),
              time: saved.time,
            })
      );
      onOpenChange(false);
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError &&
        typeof error.body === "object" &&
        error.body !== null &&
        "detail" in error.body &&
        typeof error.body.detail === "string"
          ? error.body.detail
          : null;
      toast.error(detail ?? t("Could not save the appointment — check the fields"));
    },
  });

  // Choosing a client defaults the professional to their preferred stylist.
  const onClientChange = (id: string) => {
    setClientId(id);
    const c = (clients ?? []).find((x) => x.id === id);
    setStylistId(c?.stylist_id ?? "none");
  };

  const clientLabel = (id: string) =>
    (clients ?? []).find((c) => c.id === id)?.name ?? t("Choose a client");
  const serviceLabel = (id: string) => {
    const s = (services ?? []).find((x) => x.id === id);
    return s ? `${s.name} · ${s.duration_min} ${t("min")}` : t("Choose a service");
  };
  const stylistLabel = (id: string) =>
    (stylists ?? []).find((s) => s.id === id)?.name ?? t("Unassigned");

  const activeServices = (services ?? []).filter(
    (s) => s.active || s.id === appointment?.service_id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-lg" data-testid="appointment-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {appointment ? t("Edit appointment") : t("New appointment")}
          </DialogTitle>
          <DialogDescription>
            {appointment
              ? t("Adjust the day, time, service or professional.")
              : t("The professional defaults to the client's preferred stylist — change it if needed.")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (clientId === "none") {
              toast.error(t("Choose a client"));
              return;
            }
            if (serviceId === "none") {
              toast.error(t("Choose a service"));
              return;
            }
            if (!date || !time) {
              toast.error(t("Pick the date and time"));
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="appt-client">{t("Client")}</Label>
            <Select value={clientId} onValueChange={(v) => onClientChange(v)}>
              <SelectTrigger id="appt-client" data-testid="appointment-client-select" className="w-full">
                <SelectValue>{() => clientLabel(clientId)}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="appointment-client-options">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientsQuery.hasNextPage ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-fit"
                disabled={clientsQuery.isFetchingNextPage}
                data-testid="load-more-appointment-clients"
                onClick={() => clientsQuery.fetchNextPage()}
              >
                {clientsQuery.isFetchingNextPage ? t("Loading clients…") : t("Load more clients")}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="appt-service">{t("Service")}</Label>
            <Select value={serviceId} onValueChange={(v) => setServiceId(v)}>
              <SelectTrigger id="appt-service" data-testid="appointment-service-select" className="w-full">
                <SelectValue>{() => serviceLabel(serviceId)}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="appointment-service-options">
                {activeServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration_min} {t("min")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="appt-stylist">{t("Professional")}</Label>
            <Select value={stylistId} onValueChange={(v) => setStylistId(v)}>
              <SelectTrigger id="appt-stylist" data-testid="appointment-stylist-select" className="w-full">
                <SelectValue>{() => stylistLabel(stylistId)}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="appointment-stylist-options">
                <SelectItem value="none">{t("Unassigned")}</SelectItem>
                {(stylists ?? [])
                  .filter((s) => s.active || s.id === appointment?.stylist_id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="appt-date">{t("Date")}</Label>
              <DateField
                testid="appointment-date-input"
                value={date}
                onChange={setDate}
                placeholder={t("Pick a day")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="appt-time">{t("Time")}</Label>
              <Input
                id="appt-time"
                type="time"
                data-testid="appointment-time-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="appt-notes">{t("Notes")}</Label>
            <Textarea
              id="appt-notes"
              data-testid="appointment-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("Anything the team should know — optional")}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-testid="appointment-form-cancel"
              onClick={() => onOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="save-appointment-submit">
              {mutation.isPending ? t("Saving…") : appointment ? t("Save changes") : t("Book appointment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
