import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Clock, AlertTriangle, Loader2, RefreshCw, XCircle,
  Receipt, TrendingUp, Wallet, Calendar, ExternalLink, Percent, ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { SubscriptionPaywall } from "./SubscriptionPaywall";

type Props = { storeId: string };

type SubRow = {
  id: string;
  status: string;
  billing_model: "fixed_plus_per_order" | "commission" | null;
  monthly_amount: number | null;
  per_order_fee: number | null;
  commission_percent: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  gateway_subscription_id: string | null;
  gateway_customer_id: string | null;
};

type Invoice = {
  id: string;
  period_start: string;
  period_end: string;
  billing_model: string;
  orders_count: number;
  per_order_total: number;
  commission_total: number;
  gross_sales: number;
  total_amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  invoice_url: string | null;
};

const fmt = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusBadge: Record<string, { label: string; cls: string; icon: any }> = {
  active:   { label: "Ativa",     cls: "bg-success/15 text-success",        icon: CheckCircle2 },
  trial:    { label: "Período grátis", cls: "bg-primary/15 text-primary",   icon: Clock },
  overdue:  { label: "Em atraso", cls: "bg-destructive/15 text-destructive", icon: AlertTriangle },
  cancelled:{ label: "Cancelada", cls: "bg-muted text-muted-foreground",    icon: XCircle },
  expired:  { label: "Expirada",  cls: "bg-destructive/15 text-destructive", icon: XCircle },
};

const invoiceStatus: Record<string, { label: string; cls: string }> = {
  open:    { label: "Em aberto",  cls: "bg-primary/15 text-primary" },
  pending: { label: "Pendente",   cls: "bg-warning/15 text-warning" },
  paid:    { label: "Paga",       cls: "bg-success/15 text-success" },
  overdue: { label: "Vencida",    cls: "bg-destructive/15 text-destructive" },
  cancelled:{ label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

export const SubscriptionManager = ({ storeId }: Props) => {
  const qc = useQueryClient();
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data: sub, isLoading } = useQuery({
    queryKey: ["store-subscription", storeId],
    queryFn: async (): Promise<SubRow | null> => {
      const { data, error } = await supabase
        .from("store_subscriptions")
        .select("id, status, billing_model, monthly_amount, per_order_fee, commission_percent, trial_ends_at, current_period_end, cancelled_at, gateway_subscription_id, gateway_customer_id")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data as SubRow | null;
    },
    refetchInterval: 30000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["store-monthly-invoices", storeId],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("monthly_invoices")
        .select("id, period_start, period_end, billing_model, orders_count, per_order_total, commission_total, gross_sales, total_amount, status, due_date, paid_at, invoice_url")
        .eq("store_id", storeId)
        .order("period_start", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  // Estimativa do mês corrente (preview da fatura)
  const monthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return { start };
  }, []);

  const { data: monthStats } = useQuery({
    queryKey: ["store-month-orders", storeId, monthRange.start],
    enabled: !!sub,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("total")
        .eq("store_id", storeId)
        .eq("status", "delivered")
        .gte("created_at", monthRange.start);
      if (error) throw error;
      const orders = data ?? [];
      const gross = orders.reduce((s, o: any) => s + Number(o.total || 0), 0);
      return { count: orders.length, gross };
    },
    refetchInterval: 60_000,
  });

  if (showChangePlan) {
    return (
      <SubscriptionPaywall
        storeId={storeId}
        onActive={() => {
          setShowChangePlan(false);
          qc.invalidateQueries({ queryKey: ["store-subscription", storeId] });
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sub || !sub.billing_model) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-border bg-card p-10 text-center">
        <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold">Nenhum plano PRO ativo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ative o Plano PRO para liberar todos os recursos do painel.
        </p>
        <Button onClick={() => setShowChangePlan(true)} size="lg" className="mt-4">
          Escolher plano PRO
        </Button>
      </div>
    );
  }

  const isCommission = sub.billing_model === "commission";
  const isFixed = sub.billing_model === "fixed_plus_per_order";
  const statusKey = (sub.status || "active").toLowerCase();
  const st = statusBadge[statusKey] ?? statusBadge.active;
  const StIcon = st.icon;

  const perOrderFee = Number(sub.per_order_fee || 0);
  const commissionPct = Number(sub.commission_percent || 0);
  const monthly = Number(sub.monthly_amount || 0);

  const estOrders = monthStats?.count ?? 0;
  const estGross = monthStats?.gross ?? 0;
  const estPerOrder = +(estOrders * perOrderFee).toFixed(2);
  const estCommission = isCommission ? +(estGross * commissionPct / 100).toFixed(2) : 0;
  const estMonthlyInvoice = +(estPerOrder + estCommission).toFixed(2);
  const estTotalCost = +(estMonthlyInvoice + (isFixed ? monthly : 0)).toFixed(2);

  const cancelSubscription = async () => {
    if (!confirm("Cancelar assinatura? Você continuará com acesso até o fim do período pago.")) return;
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-cancel`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ store_id: storeId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
      toast.success("Assinatura cancelada.");
      qc.invalidateQueries({ queryKey: ["store-subscription", storeId] });
      qc.invalidateQueries({ queryKey: ["subscription-state", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível cancelar");
    } finally {
      setCancelling(false);
    }
  };

  const nextRenewal = sub.current_period_end ? new Date(sub.current_period_end) : null;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-3xl bg-card p-6 shadow-float">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${st.cls}`}>
              <StIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Plano PRO {isCommission ? "Comissão" : "Fixo + Pedido"}
              </p>
              <h1 className="font-display text-2xl font-bold">
                Assinatura {st.label.toLowerCase()}
              </h1>
              {nextRenewal && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {sub.cancelled_at
                    ? `Acesso até ${nextRenewal.toLocaleDateString("pt-BR")}`
                    : `Próxima renovação em ${nextRenewal.toLocaleDateString("pt-BR")}`}
                </p>
              )}
            </div>
          </div>
          <Badge className={st.cls}>{st.label}</Badge>
        </div>

        {/* Pricing breakdown */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {isFixed && (
            <Stat
              icon={Wallet}
              label="Mensalidade fixa"
              value={fmt(monthly)}
              hint="cobrada mensalmente"
            />
          )}
          {isCommission && (
            <Stat
              icon={Percent}
              label="Comissão sobre vendas"
              value={`${commissionPct}%`}
              hint="dos pedidos entregues"
            />
          )}
          <Stat
            icon={ShoppingBag}
            label="Taxa por pedido"
            value={fmt(perOrderFee)}
            hint="por pedido entregue"
          />
          <Stat
            icon={Calendar}
            label="Tolerância de pagamento"
            value="5 dias"
            hint="após o vencimento"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => setShowChangePlan(true)} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Trocar de plano
          </Button>
          {statusKey === "active" && (
            <Button
              variant="outline"
              onClick={cancelSubscription}
              disabled={cancelling}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {cancelling ? "Cancelando..." : "Cancelar assinatura"}
            </Button>
          )}
        </div>
      </div>

      {/* Preview do mês corrente */}
      <div className="rounded-3xl bg-card p-6 shadow-float">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Prévia do mês atual</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Pedidos entregues" value={String(estOrders)} />
          <MiniStat label="Vendas brutas" value={fmt(estGross)} />
          {isCommission && <MiniStat label={`Comissão (${commissionPct}%)`} value={fmt(estCommission)} />}
          <MiniStat label="Taxa por pedido" value={fmt(estPerOrder)} />
        </div>
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Estimativa para a próxima fatura
          </p>
          <p className="mt-1 text-3xl font-display font-bold">{fmt(estMonthlyInvoice)}</p>
          {isFixed && (
            <p className="mt-1 text-xs text-muted-foreground">
              + {fmt(monthly)} de mensalidade fixa = <strong>{fmt(estTotalCost)}</strong> no mês
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Cálculo automático com base nos pedidos do mês até agora. A fatura é gerada no dia 1° do mês seguinte.
          </p>
        </div>
      </div>

      {/* Histórico de faturas */}
      <div className="rounded-3xl bg-card p-6 shadow-float">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Histórico de faturas</h2>
        </div>

        {invoices.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma fatura emitida ainda. A primeira será gerada no dia 1° do próximo mês.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-bold">Período</th>
                  <th className="px-3 py-2 text-left font-bold">Pedidos</th>
                  <th className="px-3 py-2 text-left font-bold">Vendas</th>
                  <th className="px-3 py-2 text-left font-bold">Total</th>
                  <th className="px-3 py-2 text-left font-bold">Vencimento</th>
                  <th className="px-3 py-2 text-left font-bold">Status</th>
                  <th className="px-3 py-2 text-right font-bold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const s = invoiceStatus[inv.status] ?? invoiceStatus.open;
                  const periodLabel = new Date(inv.period_start).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                  return (
                    <tr key={inv.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3 font-semibold capitalize">{periodLabel}</td>
                      <td className="px-3 py-3">{inv.orders_count}</td>
                      <td className="px-3 py-3 text-muted-foreground">{fmt(inv.gross_sales)}</td>
                      <td className="px-3 py-3 font-bold">{fmt(inv.total_amount)}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-3 py-3"><Badge className={s.cls}>{s.label}</Badge></td>
                      <td className="px-3 py-3 text-right">
                        {inv.invoice_url ? (
                          <a href={inv.invoice_url} target="_blank" rel="noreferrer"
                             className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                            Abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Em ambos os modelos, a taxa de serviço cobrada do cliente final pertence ao itChat.
        Após o vencimento, há 5 dias de tolerância antes da loja ser pausada automaticamente.
      </p>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) => (
  <div className="rounded-2xl border border-border bg-background p-4">
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-4 w-4" /> {label}
    </div>
    <p className="mt-2 text-2xl font-display font-bold">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-muted/40 p-4">
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 text-xl font-bold">{value}</p>
  </div>
);
