import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import type { Client, PageResult, Stats, Stylist } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stylistFilter, setStylistFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    setPage(1);
  }, [search, stylistFilter, sortBy, showArchived]);

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
    queryKey: ["clients", { search, stylistFilter, sortBy, showArchived, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (stylistFilter !== "all") params.set("stylist_id", stylistFilter);
      if (showArchived) params.set("archived", "true");
      params.set("sort_by", sortBy);
      params.set("page", String(page));
      params.set("page_size", "25");
      return apiGet<PageResult<Client>>(`/clients?${params.toString()}`);
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
      if (shown.length === 1 && page > 1) setPage((current) => current - 1);
      toast.success(t("{name} archived", { name: deleteTarget?.name ?? t("Client") }));
      setDeleteTarget(null);
    },
    onError: () => toast.error(t("Could not archive the client")),
  });

  const restoreMutation = useMutation({
    mutationFn: (client: Client) =>
      apiPut<Client>(`/clients/${client.id}`, { active: true }),
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      if (shown.length === 1 && page > 1) setPage((current) => current - 1);
      toast.success(t("{name} restored to the client book", { name: client.name }));
    },
    onError: () => toast.error(t("Could not restore the client")),
  });

  const filterTabs = [
    { id: "all", label: t("All stylists"), color: undefined as string | undefined, count: stats?.total_clients },
    ...(stylists ?? []).map((s) => ({
      id: s.id,
      label: s.name,
      color: s.color,
      count: s.client_count,
    })),
    { id: "none", label: t("Unassigned"), color: undefined as string | undefined, count: stats?.unassigned },
  ];

  const pageResult = clientsQuery.data;
  const shown = pageResult?.items ?? [];

  return (
    <AppShell
      title={t("Clients")}
      subtitle={t("The client book — stylists, last visits and notes")}
      actions={
        <Button
          data-testid="add-client-button"
          onClick={() => {
            setFormClient(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t("Add client")}
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
            <Button
              size="sm"
              variant={showArchived ? "default" : "outline"}
              className={`rounded-full ${showArchived ? "" : "bg-white"}`}
              data-testid="show-archived-clients"
              onClick={() => setShowArchived((current) => !current)}
            >
              {showArchived ? t("Hide archived") : t("Archived clients")}
              {stats?.archived_clients ? (
                <span className="font-mono text-[11px] opacity-70">
                  {stats.archived_clients}
                </span>
              ) : null}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                id="client-search"
                data-testid="client-search-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("Search name, phone, formula…")}
                className="w-full bg-white pl-9 sm:w-72"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
              <SelectTrigger data-testid="sort-select" className="w-48 bg-white">
                <SelectValue>
                  {() => t(SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="sort-options">
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(o.label)}
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
            <p className="font-heading text-lg text-stone-800">{t("The client book is out of reach")}</p>
            <p className="mt-1 text-sm text-stone-500">
              {t("We couldn't load clients. Check the connection and try again.")}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              data-testid="clients-retry-button"
              onClick={() => clientsQuery.refetch()}
            >
              {t("Try again")}
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
            onRestore={(c) => restoreMutation.mutate(c)}
          />
        )}
        {pageResult && pageResult.total > pageResult.page_size ? (
          <div
            className="flex items-center justify-between gap-3"
            data-testid="clients-pagination"
          >
            <p className="text-sm text-stone-500">
              {t("Showing {from}–{to} of {total}", {
                from: (pageResult.page - 1) * pageResult.page_size + 1,
                to: (pageResult.page - 1) * pageResult.page_size + shown.length,
                total: pageResult.total,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageResult.page === 1 || clientsQuery.isFetching}
                data-testid="clients-previous-page"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("Previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  pageResult.page * pageResult.page_size >= pageResult.total ||
                  clientsQuery.isFetching
                }
                data-testid="clients-next-page"
                onClick={() => setPage((current) => current + 1)}
              >
                {t("Next")}
              </Button>
            </div>
          </div>
        ) : null}
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
        title={t("Archive {name}?", { name: deleteTarget?.name ?? t("client") })}
        description={t("The client will leave the active book, but their notes and appointment history will be preserved.")}
        confirmLabel={t("Archive client")}
        pending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        confirmTestId="confirm-archive-client-btn"
      />
    </AppShell>
  );
}
