import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Eye, Filter, Calendar, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { OrderDetailsModal } from "./OrderDetailsModal";

const NEXT_STATUS: Partial<Record<DbStatus, { next: DbStatus; label: string }>> = {
  pending_payment: { next: "received", label: "Confirmar pgto" },
  received: { next: "preparing", label: "Iniciar preparo" },
  preparing: { next: "ready", label: "Marcar pronto" },
  ready: { next: "out_for_delivery", label: "Saiu p/ entrega" },
  out_for_delivery: { next: "delivered", label: "Entregue" },
};

type DbStatus =
  | "pending_payment"
  | "received"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

const STATUS_LABEL: Record<DbStatus, string> = {
  pending_payment: "Aguardando pgto",
  received: "Recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "A caminho",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<DbStatus, string> = {
  pending_payment: "bg-muted text-foreground",
  received: "bg-primary/10 text-primary",
  preparing: "bg-amber-500/10 text-amber-700",
  ready: "bg-blue-500/10 text-blue-700",
  out_for_delivery: "bg-purple-500/10 text-purple-700",
  delivered: "bg-green-500/10 text-green-700",
  cancelled: "bg-destructive/10 text-destructive",
};

const RANGES = [
  { id: "today", label: "Hoje", days: 1 },
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
  { id: "all", label: "Todos", days: 3650 },
] as const;

export const OrdersHistory = ({ storeId }: { storeId: string }) => {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("7d");
  const [statusFilter, setStatusFilter] = useState<DbStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const fromDate = useMemo(() => {
    const r = RANGES.find((x) => x.id === range) ?? RANGES[1];
    return new Date(Date.now() - r.days * 24 * 60 * 60 * 1000).toISOString();
  }, [range]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders-history", storeId, range, statusFilter],
    enabled: !!storeId,
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, total, status, method, payment_method, created_at, source, table_number",
        )
        .eq("store_id", storeId)
        .gte("created_at", fromDate)
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter(
      (o: any) =>
        o.customer_name?.toLowerCase().includes(s) ||
        o.customer_phone?.includes(s) ||
        o.id.toLowerCase().includes(s),
    );
  }, [orders, search]);

  const totals = useMemo(() => {
    const delivered = filtered.filter((o: any) => o.status === "delivered");
    const cancelled = filtered.filter((o: any) => o.status === "cancelled");
    const revenue = delivered.reduce((s: number, o: any) => s + Number(o.total), 0);
    return { count: filtered.length, delivered: delivered.length, cancelled: cancelled.length, revenue };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                range === r.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DbStatus | "all")}
            className="rounded-lg border bg-card px-2 py-1.5 text-xs font-semibold outline-none focus:border-primary"
          >
            <option value="all">Todos os status</option>
            {(Object.keys(STATUS_LABEL) as DbStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="relative ml-auto flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-card pl-8 pr-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Pedidos" value={totals.count.toString()} />
        <Stat label="Entregues" value={totals.delivered.toString()} tone="text-green-600" />
        <Stat label="Cancelados" value={totals.cancelled.toString()} tone="text-destructive" />
        <Stat
          label="Faturamento"
          value={`R$ ${totals.revenue.toFixed(2).replace(".", ",")}`}
          tone="text-primary"
        />
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left font-bold">Pedido</th>
                <th className="px-3 py-2 text-left font-bold">Cliente</th>
                <th className="px-3 py-2 text-left font-bold">Status</th>
                <th className="px-3 py-2 text-left font-bold hidden md:table-cell">Origem</th>
                <th className="px-3 py-2 text-left font-bold hidden sm:table-cell">
                  <Calendar className="inline h-3 w-3" /> Data
                </th>
                <th className="px-3 py-2 text-right font-bold">Total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum pedido encontrado neste período.
                  </td>
                </tr>
              ) : (
                filtered.map((o: any) => (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs font-bold">
                      #{o.id.slice(0, 6).toUpperCase()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[o.status as DbStatus]}`}
                      >
                        {STATUS_LABEL[o.status as DbStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground">
                      {o.table_number ? `Mesa ${o.table_number}` : o.source ?? o.method}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      R$ {Number(o.total).toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setDetailId(o.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-bold hover:bg-muted/70"
                      >
                        <Eye className="h-3 w-3" /> Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OrderDetailsModal orderId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
    </div>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="rounded-xl border bg-card p-3">
    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`mt-0.5 font-display text-xl font-bold ${tone ?? ""}`}>{value}</div>
  </div>
);
