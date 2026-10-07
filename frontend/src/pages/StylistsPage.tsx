import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import type { Stylist } from "@/lib/types";
import { initials } from "@/lib/format";
import { useUser } from "@/lib/userContext";
import AppShell from "@/components/layout/AppShell";
import StylistFormModal from "@/components/stylists/StylistFormModal";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

const BANNER_URL =
  "https://images.unsplash.com/photo-1695527081848-1e46c06e6458?crop=entropy&cs=srgb&fm=jpg&q=85";

function StylistCard({
  stylist,
  canManage,
  onEdit,
  onDelete,
}: {
  stylist: Stylist;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-[#E5DCD0] bg-white p-5 shadow-[0_1px_3px_0_rgba(44,30,20,0.04),0_6px_16px_-4px_rgba(44,30,20,0.06)] transition-transform duration-150 ease-out hover:-translate-y-0.5"
      data-testid={`stylist-card-${stylist.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {stylist.avatar_url ? (
            <img
              src={stylist.avatar_url}
              alt={stylist.name}
              className="h-12 w-12 flex-none rounded-full object-cover ring-2 ring-[#F3ECE1]"
            />
          ) : (
            <span
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: `${stylist.color}1A`, color: stylist.color }}
            >
              {initials(stylist.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-heading text-lg font-semibold text-stone-900">
              {stylist.name}
            </p>
            <p className="truncate text-xs text-stone-500">{stylist.title || "Stylist"}</p>
          </div>
        </div>
        <span
          className={`flex-none rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            stylist.active ? "bg-[#EBF4EE] text-[#235937]" : "bg-[#F3ECE1] text-[#57534E]"
          }`}
        >
          {stylist.active ? "Active" : "Away"}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-wider text-stone-500">
          <span className="mr-1 font-heading text-base font-semibold normal-case text-stone-900">
            {stylist.client_count}
          </span>
          client{stylist.client_count === 1 ? "" : "s"}
        </p>
        {canManage ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${stylist.name}`}
              data-testid={`edit-stylist-${stylist.id}`}
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${stylist.name}`}
              data-testid={`delete-stylist-${stylist.id}`}
              className="text-stone-400 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function StylistsPage() {
  const user = useUser();
  const canManage = user.role === "admin";
  const qc = useQueryClient();
  const stylistsQuery = useQuery({
    queryKey: ["stylists"],
    queryFn: () => apiGet<Stylist[]>("/stylists"),
    retry: false,
  });
  const stylists = stylistsQuery.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Stylist | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Stylist | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/stylists/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stylists"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`${deleteTarget?.name ?? "Stylist"} removed — their clients are now unassigned`);
      setDeleteTarget(null);
    },
    onError: () => toast.error("Could not remove the stylist"),
  });

  return (
    <AppShell
      title="Stylists"
      subtitle="The roster — specialties, statuses and client loads"
      actions={
        canManage ? (
          <Button
            data-testid="add-stylist-button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add stylist
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6 px-6 py-6 lg:px-8">
        <div className="relative h-44 overflow-hidden rounded-2xl border border-[#E5DCD0]">
          <img src={BANNER_URL} alt="Inside the Atelier salon" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#221C18]/85 via-[#221C18]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#E7DFD5]">
              Atelier · The floor
            </p>
            <h2 className="mt-1 font-heading text-3xl font-semibold text-white">
              The stylist roster
            </h2>
          </div>
        </div>

        {stylistsQuery.isError && !stylistsQuery.data ? (
          <div
            className="rounded-2xl border border-[#E5DCD0] bg-white p-10 text-center"
            data-testid="stylists-error-state"
          >
            <p className="font-heading text-lg text-stone-800">The roster is out of reach</p>
            <p className="mt-1 text-sm text-stone-500">
              We couldn't load stylists. Check the connection and try again.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              data-testid="stylists-retry-button"
              onClick={() => stylistsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : stylistsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#F3ECE1]" />
            ))}
          </div>
        ) : stylists.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-[#E7DFD5] bg-white p-12 text-center"
            data-testid="stylists-empty-state"
          >
            <Scissors className="mx-auto h-8 w-8 text-stone-300" />
            <p className="mt-3 font-heading text-lg text-stone-800">No stylists yet</p>
            <p className="mt-1 text-sm text-stone-500">
              Add your first stylist, then assign clients to them.
            </p>
            <Button
              className="mt-4"
              data-testid="add-first-stylist-button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add stylist
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stylists.map((s) => (
              <StylistCard
                key={s.id}
                stylist={s}
                canManage={canManage}
                onEdit={() => {
                  setEditing(s);
                  setFormOpen(true);
                }}
                onDelete={() => setDeleteTarget(s)}
              />
            ))}
          </div>
        )}
      </div>

      <StylistFormModal open={formOpen} onOpenChange={setFormOpen} stylist={editing} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={`Remove ${deleteTarget?.name ?? "stylist"}?`}
        description="Their clients will stay in the book as unassigned, so nobody disappears from the client list."
        confirmLabel="Remove stylist"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        confirmTestId="confirm-delete-stylist-btn"
      />
    </AppShell>
  );
}
