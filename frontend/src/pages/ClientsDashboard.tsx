import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import type { Client, Stats, Stylist } from "@/lib/types";
import AppShell from "@/components/layout/AppShell";
import KpiStatCards from "@/components/dashboard/KpiStatCards";
import ClientTable from "@/components/clients/ClientTable";
import ClientFormModal from "@/components/clients/ClientFormModal";
import ClientDetailDrawer from "@/components/clients/ClientDetailDrawer";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "last_visit_asc", label: "Longest since visit" },
  { value: "last_visit_desc", label: "Most recent visit" },
  { value: "name", label: "Name A–Z" },
];

export default function ClientsDashboard() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stylistFilter, setStylistFilter] = useState("all");
  const [sortBy, setSortBy] = useState("last_visit_asc");
  const [formOpen, setFormOpen] = useState(false);
  const [formClient, setFormClient] = useState<Client | null>(null);
  const [drawerClientId, setDrawerClientId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  // Instant search, lightly debounced before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    retry: false,
  });
  const { data: stylists } = useQuery({
    queryKey: ["stylists"],
    queryFn: () => apiGet<Stylist[]>("/stylists"),
    retry: false,
  });

  const clientsQuery = useQuery({
    queryKey: ["clients", { search, stylistFilter, sortBy }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (stylistFilter !== "all") params.set("stylist_id", stylistFilter);
      params.set("sort_by", sortBy);
      return apiGet<Client[]>(`/clients?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/clients/${id}`),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["stylists"] });
      setDrawerClientId((current) => (current === id ? null : current));
      toast.success(`${deleteTarget?.name ?? "Client"} removed from the book`);
      setDeleteTarget(null);
    },
    onError: () => toast.error("Could not delete the client"),
  });

  const filterTabs = [
    { id: "all", label: "All stylists", color: undefined as string | undefined, count: stats?.total_clients },
    ...(stylists ?? []).map((s) => ({
      id: s.id,
      label: s.name,
      color: s.color,
      count: s.client_count,
    })),
    { id: "none", label: "Unassigned", color: undefined as string | undefined, count: stats?.unassigned },
  ];

  const shown = clientsQuery.data ?? [];

  return (
    <AppShell
      title="Clients"
      subtitle="The client book — stylists, last visits and notes"
      actions={
        <Button
          data-testid="add-client-button"
          onClick={() => {
            setFormClient(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add client
        </Button>
      }
    >
      <div className="space-y-5 px-6 py-6 lg:px-8">
        <KpiStatCards />

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2" data-testid="stylist-filter-tabs">
            {filterTabs.map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={stylistFilter === tab.id ? "default" : "outline"}
                className={`rounded-full ${stylistFilter === tab.id ? "" : "bg-white"}`}
                data-testid={`stylist-filter-tab-${tab.id}`}
                onClick={() => setStylistFilter(tab.id)}
              >
                {tab.color && (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tab.color }} />
                )}
                {tab.label}
                {typeof tab.count === "number" && (
                  <span className="font-mono text-[11px] opacity-70">{tab.count}</span>
                )}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                id="client-search"
                data-testid="client-search-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, phone, formula…"
                className="w-full bg-white pl-9 sm:w-72"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
              <SelectTrigger data-testid="sort-select" className="w-48 bg-white">
                <SelectValue>
                  {() => SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="sort-options">
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {clientsQuery.isError && !clientsQuery.data ? (
          <div
            className="rounded-2xl border border-[#E5DCD0] bg-white p-10 text-center"
            data-testid="clients-error-state"
          >
            <p className="font-heading text-lg text-stone-800">The client book is out of reach</p>
            <p className="mt-1 text-sm text-stone-500">
              We couldn't load clients. Check the connection and try again.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              data-testid="clients-retry-button"
              onClick={() => clientsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <ClientTable
            clients={shown}
            loading={clientsQuery.isLoading}
            onView={(c) => setDrawerClientId(c.id)}
            onEdit={(c) => {
              setFormClient(c);
              setFormOpen(true);
            }}
            onDelete={(c) => setDeleteTarget(c)}
          />
        )}
      </div>

      <ClientFormModal open={formOpen} onOpenChange={setFormOpen} client={formClient} />
      <ClientDetailDrawer
        clientId={drawerClientId}
        open={drawerClientId !== null}
        onOpenChange={(o) => {
          if (!o) setDrawerClientId(null);
        }}
        onEdit={(c) => {
          setFormClient(c);
          setFormOpen(true);
        }}
        onDeleteRequest={(c) => setDeleteTarget(c)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={`Remove ${deleteTarget?.name ?? "client"}?`}
        description="This removes the client and all of their notes from the book. This cannot be undone."
        confirmLabel="Delete client"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        confirmTestId="confirm-delete-client-btn"
      />
    </AppShell>
  );
}
