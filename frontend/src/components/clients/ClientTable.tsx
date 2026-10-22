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
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#E5DCD0] bg-white shadow-[0_1px_3px_0_rgba(44,30,20,0.04),0_6px_16px_-4px_rgba(44,30,20,0.06)]"
      data-testid="client-table"
    >
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
                <TableCell>
                  <div className="h-9 w-full animate-pulse rounded-md bg-[#F3ECE1]" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-28 animate-pulse rounded-full bg-[#F3ECE1]" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-24 animate-pulse rounded-full bg-[#F3ECE1]" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-8 animate-pulse rounded bg-[#F3ECE1]" />
                </TableCell>
                <TableCell>
                  <div className="ml-auto h-5 w-16 animate-pulse rounded bg-[#F3ECE1]" />
                </TableCell>
              </TableRow>
            ))
          ) : clients.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-14 text-center">
                <p className="font-heading text-lg text-stone-800">{t("No clients found")}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {t("Try a different search or filter.")}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            clients.map((c) => {
              const meta = visitMeta(c.days_since_visit);
              return (
                <TableRow
                  key={c.id}
                  data-testid={`client-row-${c.id}`}
                  onClick={() => onView(c)}
                  className="cursor-pointer transition-colors duration-150 ease-out hover:bg-[#FAF7F2]"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor: `${(c.stylist_color ?? "#8F4E34") as string}1A`,
                          color: c.stylist_color ?? "#8F4E34",
                        }}
                      >
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-900">{c.name}</p>
                        <p className="truncate text-xs text-stone-500">
                          {c.phone ?? c.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.stylist_name ? (
                      <span className="flex items-center gap-2 text-sm text-stone-700">
                        <span
                          className="h-2 w-2 flex-none rounded-full"
                          style={{ backgroundColor: c.stylist_color ?? "#A8A29E" }}
                        />
                        {c.stylist_name}
                      </span>
                    ) : (
                      <span className="text-sm text-stone-400">{t("Unassigned")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="text-sm text-stone-700">{formatDate(c.last_visit)}</span>
                      <span
                        className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass(meta.tone)}`}
                      >
                        {t(meta.labelKey, meta.params ?? {})}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-stone-500">{c.note_count}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`View ${c.name}`}
                        data-testid={`view-client-${c.id}`}
                        onClick={() => onView(c)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {c.active ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${c.name}`}
                          data-testid={`edit-client-${c.id}`}
                          onClick={() => onEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {c.active ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Archive ${c.name}`}
                          data-testid={`delete-client-${c.id}`}
                          className="text-stone-400 hover:text-destructive"
                          onClick={() => onDelete(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Restore ${c.name}`}
                          data-testid={`restore-client-${c.id}`}
                          onClick={() => onRestore(c)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
