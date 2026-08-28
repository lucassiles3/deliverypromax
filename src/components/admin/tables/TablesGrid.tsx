import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, QrCode, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { brl, elapsed } from "@/lib/format";
import { useOpenSessions, useSectors, useTables, type RestaurantTable, type TableStatus } from "@/hooks/useTables";
import { TableEditModal } from "./TableEditModal";
import { TableSessionDrawer } from "./TableSessionDrawer";
import { QrModal } from "./QrModal";

const statusStyle: Record<TableStatus, { bg: string; label: string }> = {
  available: { bg: "border-green-500/40 bg-green-500/10 hover:bg-green-500/20", label: "Livre" },
  occupied: { bg: "border-red-500/40 bg-red-500/10 hover:bg-red-500/20", label: "Ocupada" },
  reserved: { bg: "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20", label: "Reservada" },
  blocked: { bg: "border-muted-foreground/30 bg-muted/30 hover:bg-muted/50", label: "Bloqueada" },
};

export const TablesGrid = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const { data: tables = [] } = useTables(storeId);
  const { data: sessions = [] } = useOpenSessions(storeId);
  const { data: sectors = [] } = useSectors(storeId);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<RestaurantTable | "new" | null>(null);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [openSessionTable, setOpenSessionTable] = useState<RestaurantTable | null>(null);

  const sessionByTable = useMemo(() => {
    const m = new Map<string, typeof sessions[number]>();
    sessions.forEach((s) => m.set(s.table_id, s));
    return m;
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        String(t.number).includes(q) ||
        (t.name ?? "").toLowerCase().includes(q),
    );
  }, [tables, search]);

  const sectorMap = useMemo(() => new Map(sectors.map((s) => [s.id, s])), [sectors]);

  const remove = async (t: RestaurantTable) => {
    if (!confirm(`Excluir mesa ${t.number}?`)) return;
    const { error } = await supabase.from("tables").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Mesa excluída");
    qc.invalidateQueries({ queryKey: ["tables", storeId] });
  };

  const toggleBlock = async (t: RestaurantTable) => {
    if (t.status === "occupied") return toast.error("Mesa em uso, feche a comanda primeiro");
    const next: TableStatus = t.status === "blocked" ? "available" : "blocked";
    const { error } = await supabase.from("tables").update({ status: next }).eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tables", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar mesa por número ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="ml-auto" />
        <Button onClick={() => setEditing("new")}>
          <Plus className="mr-1 h-4 w-4" /> Criar mesa
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
          <p className="font-display text-lg font-bold">Nenhuma mesa cadastrada</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie sua primeira mesa para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((t) => {
            const sess = sessionByTable.get(t.id);
            const sector = t.sector_id ? sectorMap.get(t.sector_id) : null;
            const style = statusStyle[t.status];
            return (
              <div
                key={t.id}
                className={`group relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-foreground transition-all ${style.bg}`}
              >
                <button
                  onClick={() => setOpenSessionTable(t)}
                  className="flex flex-1 flex-col items-start text-left"
                >
                  <div className="flex w-full items-start justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">Mesa</div>
                      <div className="font-display text-3xl font-bold leading-none">{t.number}</div>
                    </div>
                    {sector && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: sector.color }}
                      >
                        {sector.name}
                      </span>
                    )}
                  </div>
                  {t.name && <div className="text-xs font-semibold opacity-80">{t.name}</div>}
                  <div className="mt-2 text-[11px] font-bold uppercase tracking-wider opacity-70">
                    {style.label} · {t.capacity}p
                  </div>
                  {sess && (
                    <div className="mt-2 w-full space-y-0.5 rounded-lg bg-background/60 p-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="opacity-70">Tempo</span>
                        <span className="font-bold">{elapsed(sess.opened_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Pessoas</span>
                        <span className="font-bold">{sess.people}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Parcial</span>
                        <span className="font-bold">{brl(Number(sess.subtotal))}</span>
                      </div>
                      {sess.waiter_name && (
                        <div className="flex justify-between">
                          <span className="opacity-70">Garçom</span>
                          <span className="font-bold truncate max-w-[60%]">{sess.waiter_name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
                <div className="flex justify-between gap-1 border-t border-foreground/10 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setQrTable(t)} title="QR Code" className="rounded p-1 hover:bg-background/60">
                    <QrCode className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleBlock(t)} title={t.status === "blocked" ? "Liberar" : "Bloquear"} className="rounded p-1 hover:bg-background/60">
                    {t.status === "blocked" ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setEditing(t)} title="Editar" className="rounded p-1 hover:bg-background/60">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(t)} title="Excluir" className="rounded p-1 text-destructive hover:bg-background/60">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TableEditModal
          storeId={storeId}
          table={editing === "new" ? null : editing}
          sectors={sectors}
          onClose={() => setEditing(null)}
        />
      )}

      {openSessionTable && (
        <TableSessionDrawer
          storeId={storeId}
          table={openSessionTable}
          onClose={() => setOpenSessionTable(null)}
        />
      )}

      {qrTable && <QrModal table={qrTable} onClose={() => setQrTable(null)} />}
    </div>
  );
};
