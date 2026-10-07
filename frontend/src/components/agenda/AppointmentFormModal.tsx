import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { Appointment, Client, Service, Stylist } from "@/lib/types";
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
  const qc = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["clients", "name-all"],
    queryFn: () => apiGet<Client[]>("/clients?sort_by=name"),
    enabled: open,
    retry: false,
  });
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
      toast.success(appointment ? "Appointment updated" : `Booked ${saved.client_name} at ${saved.time}`);
      onOpenChange(false);
    },
    onError: () => toast.error("Could not save the appointment — check the fields"),
  });

  // Choosing a client defaults the professional to their preferred stylist.
  const onClientChange = (id: string) => {
    setClientId(id);
    const c = (clients ?? []).find((x) => x.id === id);
    setStylistId(c?.stylist_id ?? "none");
  };

  const clientLabel = (id: string) =>
    (clients ?? []).find((c) => c.id === id)?.name ?? "Choose a client";
  const serviceLabel = (id: string) => {
    const s = (services ?? []).find((x) => x.id === id);
    return s ? `${s.name} · ${s.duration_min} min` : "Choose a service";
  };
  const stylistLabel = (id: string) =>
    (stylists ?? []).find((s) => s.id === id)?.name ?? "Unassigned";

  const activeServices = (services ?? []).filter(
    (s) => s.active || s.id === appointment?.service_id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-lg" data-testid="appointment-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {appointment ? "Edit appointment" : "New appointment"}
          </DialogTitle>
          <DialogDescription>
            {appointment
              ? "Adjust the day, time, service or professional."
              : "The professional defaults to the client's preferred stylist — change it if needed."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (clientId === "none") {
              toast.error("Choose a client");
              return;
            }
            if (serviceId === "none") {
              toast.error("Choose a service");
              return;
            }
            if (!date || !time) {
              toast.error("Pick the date and time");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="appt-client">Client</Label>
            <Select value={clientId} onValueChange={(v) => onClientChange(v)}>
              <SelectTrigger id="appt-client" data-testid="appointment-client-select" className="w-full">
                <SelectValue>{() => clientLabel(clientId)}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="appointment-client-options">
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="appt-service">Service</Label>
            <Select value={serviceId} onValueChange={(v) => setServiceId(v)}>
              <SelectTrigger id="appt-service" data-testid="appointment-service-select" className="w-full">
                <SelectValue>{() => serviceLabel(serviceId)}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="appointment-service-options">
                {activeServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration_min} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="appt-stylist">Professional</Label>
            <Select value={stylistId} onValueChange={(v) => setStylistId(v)}>
              <SelectTrigger id="appt-stylist" data-testid="appointment-stylist-select" className="w-full">
                <SelectValue>{() => stylistLabel(stylistId)}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="appointment-stylist-options">
                <SelectItem value="none">Unassigned</SelectItem>
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
              <Label htmlFor="appt-date">Date</Label>
              <DateField
                testid="appointment-date-input"
                value={date}
                onChange={setDate}
                placeholder="Pick a day"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="appt-time">Time</Label>
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
            <Label htmlFor="appt-notes">Notes</Label>
            <Textarea
              id="appt-notes"
              data-testid="appointment-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the team should know — optional"
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
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="save-appointment-submit">
              {mutation.isPending ? "Saving…" : appointment ? "Save changes" : "Book appointment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
