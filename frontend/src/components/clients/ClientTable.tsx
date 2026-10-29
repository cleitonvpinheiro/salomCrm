import { Eye, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { Client } from "@/lib/types";
import { formatDate, initials, toneClass, visitMeta } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientTableProps {
  clients: Client[];
  loading: boolean;
  onView: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onRestore: (client: Client) => void;
}

export default function ClientTable({
  clients,
  loading,
  onView,
  onEdit,
  onDelete,
  onRestore,
}: ClientTableProps) {
  const { t } = useI18n();
  const renderActions = (client: Client, size: "icon-sm" | "icon" = "icon") => (
    <>
      <Button
        variant="ghost"
        size={size}
        className={size === "icon" ? "h-10 w-10" : undefined}
        aria-label={t("View {name}", { name: client.name })}
        data-testid={`view-client-${client.id}`}
        onClick={() => onView(client)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      {client.active ? (
        <>
          <Button
            variant="ghost"
            size={size}
            className={size === "icon" ? "h-10 w-10" : undefined}
            aria-label={t("Edit {name}", { name: client.name })}
            data-testid={`edit-client-${client.id}`}
            onClick={() => onEdit(client)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size={size}
            className={`${size === "icon" ? "h-10 w-10 " : ""}text-stone-400 hover:text-destructive`}
            aria-label={t("Archive {name}", { name: client.name })}
            data-testid={`delete-client-${client.id}`}
            onClick={() => onDelete(client)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size={size}
          className={size === "icon" ? "h-10 w-10" : undefined}
          aria-label={t("Restore {name}", { name: client.name })}
          data-testid={`restore-client-${client.id}`}
          onClick={() => onRestore(client)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
    </>
  );

  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#E5DCD0] bg-white shadow-[0_1px_3px_0_rgba(44,30,20,0.04),0_6px_16px_-4px_rgba(44,30,20,0.06)]"
      data-testid="client-table"
      aria-busy={loading}
    >
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-xs uppercase tracking-wider">{t("Client")}</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider">{t("Stylist")}</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider">{t("Last visit")}</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider">{t("Notes")}</TableHead>
              <TableHead className="text-right font-mono text-xs uppercase tracking-wider">
                {t("Actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [0, 1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-9 w-full animate-pulse rounded-md bg-[#F3ECE1]" /></TableCell>
                  <TableCell><div className="h-5 w-28 animate-pulse rounded-full bg-[#F3ECE1]" /></TableCell>
                  <TableCell><div className="h-5 w-24 animate-pulse rounded-full bg-[#F3ECE1]" /></TableCell>
                  <TableCell><div className="h-5 w-8 animate-pulse rounded bg-[#F3ECE1]" /></TableCell>
                  <TableCell><div className="ml-auto h-5 w-16 animate-pulse rounded bg-[#F3ECE1]" /></TableCell>
                </TableRow>
              ))
            ) : clients.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-14 text-center">
                  <p className="font-heading text-lg text-stone-800">{t("No clients found")}</p>
                  <p className="mt-1 text-sm text-stone-500">{t("Try a different search or filter.")}</p>
                </TableCell>
              </TableRow>
            ) : clients.map((client) => {
              const meta = visitMeta(client.days_since_visit);
              return (
                <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor: `${(client.stylist_color ?? "#8F4E34") as string}1A`,
                          color: client.stylist_color ?? "#8F4E34",
                        }}
                      >
                        {initials(client.name)}
                      </span>
                      <div className="min-w-0">
                        <Button
                          variant="ghost"
                          className="h-auto min-w-0 justify-start p-0 text-left font-medium text-stone-900 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#8F4E34)]"
                          aria-label={t("View {name}", { name: client.name })}
                          onClick={() => onView(client)}
                        >
                          <span className="truncate">{client.name}</span>
                        </Button>
                        <p className="truncate text-xs text-stone-500">{client.phone ?? client.email ?? "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.stylist_name ? (
                      <span className="flex items-center gap-2 text-sm text-stone-700">
                        <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: client.stylist_color ?? "#A8A29E" }} />
                        {client.stylist_name}
                      </span>
                    ) : <span className="text-sm text-stone-400">{t("Unassigned")}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="text-sm text-stone-700">{formatDate(client.last_visit)}</span>
                      <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass(meta.tone)}`}>
                        {t(meta.labelKey, meta.params ?? {})}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell><span className="font-mono text-xs text-stone-500">{client.note_count}</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">{renderActions(client, "icon-sm")}</div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-[#EEE7DE] p-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-[#F3ECE1]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-[#F3ECE1]" />
              <div className="h-8 w-full animate-pulse rounded bg-[#F3ECE1]" />
            </div>
          ))
        ) : clients.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-heading text-lg text-stone-800">{t("No clients found")}</p>
            <p className="mt-1 text-sm text-stone-500">{t("Try a different search or filter.")}</p>
          </div>
        ) : clients.map((client) => {
          const meta = visitMeta(client.days_since_visit);
          return (
            <article
              key={client.id}
              data-testid={`client-card-${client.id}`}
              className="rounded-xl border border-[#EEE7DE] bg-white p-4 transition-colors hover:bg-[#FAF7F2]"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: `${(client.stylist_color ?? "#8F4E34") as string}1A`,
                    color: client.stylist_color ?? "#8F4E34",
                  }}
                  aria-hidden="true"
                >
                  {initials(client.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <Button
                    variant="ghost"
                    className="h-auto min-w-0 justify-start p-0 text-left font-semibold text-stone-900 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#8F4E34)]"
                    aria-label={t("View {name}", { name: client.name })}
                    onClick={() => onView(client)}
                  >
                    <span className="truncate">{client.name}</span>
                  </Button>
                  <p className="truncate text-xs text-stone-500">{client.phone ?? client.email ?? "—"}</p>
                </div>
                <div className="flex flex-none gap-1">{renderActions(client)}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#EEE7DE] pt-3 text-sm">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">{t("Stylist")}</p>
                  <p className="mt-1 truncate text-stone-800">{client.stylist_name ?? t("Unassigned")}</p>
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">{t("Last visit")}</p>
                  <p className="mt-1 truncate text-stone-800">{formatDate(client.last_visit)}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass(meta.tone)}`}>
                    {t(meta.labelKey, meta.params ?? {})}
                  </span>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">{t("Notes")}</p>
                  <p className="mt-1 font-mono text-xs text-stone-700">{client.note_count}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
