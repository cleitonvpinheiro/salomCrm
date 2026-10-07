import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import type { Service } from "@/lib/types";
import { formatBRL } from "@/lib/format";
import { useUser } from "@/lib/userContext";
import AppShell from "@/components/layout/AppShell";
import ServiceFormModal from "@/components/services/ServiceFormModal";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ServicesPage() {
  const user = useUser();
  const qc = useQueryClient();
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => apiGet<Service[]>("/services"),
    retry: false,
  });
  const services = servicesQuery.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/services/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(`${deleteTarget?.name ?? "Service"} removed from the menu`);
      setDeleteTarget(null);
    },
    onError: () => toast.error("Could not remove the service"),
  });

  // Admin gate — team members are redirected to the agenda.
  if (user.role !== "admin") return <Navigate to="/agenda" replace />;

  return (
    <AppShell
      title="Services"
      subtitle="The menu — managed by administrators"
      actions={
        <Button
          data-testid="add-service-button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add service
        </Button>
      }
    >
      <div className="space-y-4 px-6 py-6 lg:px-8">
        {servicesQuery.isError && !servicesQuery.data ? (
          <div
            className="rounded-2xl border border-[#E5DCD0] bg-white p-10 text-center"
            data-testid="services-error-state"
          >
            <p className="font-heading text-lg text-stone-800">The menu is out of reach</p>
            <p className="mt-1 text-sm text-stone-500">
              We couldn't load the services. Check the connection and try again.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              data-testid="services-retry-button"
              onClick={() => servicesQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl border border-[#E5DCD0] bg-white shadow-[0_1px_3px_0_rgba(44,30,20,0.04),0_6px_16px_-4px_rgba(44,30,20,0.06)]"
            data-testid="services-table"
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase tracking-wider">Service</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider">Duration</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider">Price</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-right font-mono text-xs uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicesQuery.isLoading ? (
                  [0, 1, 2].map((i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="h-6 w-full animate-pulse rounded bg-[#F3ECE1]" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-16 animate-pulse rounded bg-[#F3ECE1]" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-20 animate-pulse rounded bg-[#F3ECE1]" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-16 animate-pulse rounded-full bg-[#F3ECE1]" />
                      </TableCell>
                      <TableCell>
                        <div className="ml-auto h-5 w-14 animate-pulse rounded bg-[#F3ECE1]" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : services.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-12 text-center">
                      <p className="font-heading text-lg text-stone-800">No services yet</p>
                      <p className="mt-1 text-sm text-stone-500">
                        Add the first service so the team can start booking.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  services.map((s) => (
                    <TableRow key={s.id} data-testid={`service-row-${s.id}`}>
                      <TableCell>
                        <p className="text-sm font-medium text-stone-900">{s.name}</p>
                        {s.description ? (
                          <p className="text-xs text-stone-500">{s.description}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-stone-600">
                        {s.duration_min} min
                      </TableCell>
                      <TableCell className="font-mono text-xs text-stone-600">
                        {formatBRL(s.price)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            s.active
                              ? "bg-[#EBF4EE] text-[#235937]"
                              : "bg-[#F3ECE1] text-[#57534E]"
                          }`}
                        >
                          {s.active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${s.name}`}
                            data-testid={`edit-service-${s.id}`}
                            onClick={() => {
                              setEditing(s);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${s.name}`}
                            data-testid={`delete-service-${s.id}`}
                            className="text-stone-400 hover:text-destructive"
                            onClick={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ServiceFormModal open={formOpen} onOpenChange={setFormOpen} service={editing} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={`Remove ${deleteTarget?.name ?? "service"}?`}
        description="Existing appointments keep their records — the service just leaves the booking menu."
        confirmLabel="Remove service"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        confirmTestId="confirm-delete-service-btn"
      />
    </AppShell>
  );
}
