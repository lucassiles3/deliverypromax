import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = { storeId: string };

const HistoryTab = ({ storeId }: Props) => {
  const [date, setDate] = useState<Date>(new Date());

  const from = startOfDay(date).toISOString();
  const to = endOfDay(date).toISOString();
  const dateLabel = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const { data, isLoading } = useQuery({
    queryKey: ["history-day", storeId, from],
    enabled: !!storeId,
    queryFn: async () => {
      const [
        ordersRes,
        expensesRes,
        cashRes,
        stockRes,
        newCustomersRes,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, subtotal, delivery_fee, status, method, payment_method, customer_phone, customer_name, created_at, order_items(product_name, quantity, unit_price)")
          .eq("store_id", storeId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("id, description, amount, expense_date, paid, category_id")
          .eq("store_id", storeId)
          .gte("expense_date", format(date, "yyyy-MM-dd"))
          .lte("expense_date", format(date, "yyyy-MM-dd")),
        supabase
          .from("cash_movements")
          .select("id, type, amount, description, payment_method, created_by_name, created_at")
          .eq("store_id", storeId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false }),
        supabase
          .from("stock_movements" as any)
          .select("id, type, quantity, unit_cost, reason, created_at, product_id, products(name)")
          .eq("store_id", storeId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false }),
        // Novos clientes do dia: telefones cuja PRIMEIRA compra na loja ocorreu hoje
        supabase
          .from("orders")
          .select("customer_phone, customer_name, created_at")
          .eq("store_id", storeId)
          .gte("created_at", from)
          .lte("created_at", to),
      ]);

      const orders = ordersRes.data ?? [];
      const expenses = expensesRes.data ?? [];
      const cash = cashRes.data ?? [];
      const stock = (stockRes.data ?? []) as any[];
      const dayCustomers = newCustomersRes.data ?? [];

      // Detectar novos clientes (primeira compra no dia)
      const phones = Array.from(new Set(dayCustomers.map((o) => o.customer_phone).filter(Boolean)));
      let newCustomers: { phone: string; name: string }[] = [];
      if (phones.length) {
        const { data: prior } = await supabase
          .from("orders")
          .select("customer_phone")
          .eq("store_id", storeId)
          .in("customer_phone", phones)
          .lt("created_at", from);
        const priorSet = new Set((prior ?? []).map((o) => o.customer_phone));
        const map = new Map<string, string>();
        dayCustomers.forEach((o) => {
          if (!priorSet.has(o.customer_phone) && !map.has(o.customer_phone)) {
            map.set(o.customer_phone, o.customer_name);
          }
        });
        newCustomers = Array.from(map.entries()).map(([phone, name]) => ({ phone, name }));
      }

      return { orders, expenses, cash, stock, newCustomers };
    },
  });

  const stats = useMemo(() => {
    const orders = data?.orders ?? [];
    const expenses = data?.expenses ?? [];
    const cash = data?.cash ?? [];
    const stock = data?.stock ?? [];

    const validOrders = orders.filter((o) => o.status !== "cancelled");
    const revenue = validOrders.reduce((s, o) => s + Number(o.total), 0);
    const deliveryFees = validOrders.reduce((s, o) => s + Number(o.delivery_fee || 0), 0);
    const subtotal = validOrders.reduce((s, o) => s + Number(o.subtotal || 0), 0);

    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const inProgress = orders.filter(
      (o) => !["delivered", "cancelled"].includes(o.status as string),
    ).length;

    const byMethod = {
      delivery: validOrders.filter((o) => o.method === "delivery").length,
      pickup: validOrders.filter((o) => o.method === "pickup").length,
    };

    // Vendas por forma de pagamento
    const payments: Record<string, number> = {};
    validOrders.forEach((o) => {
      const k = String(o.payment_method || "outro");
      payments[k] = (payments[k] ?? 0) + Number(o.total);
    });

    // Despesas
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

    // Vale / sangria / suprimento
    const sangrias = cash.filter((c) => c.type === "sangria" || c.type === "withdrawal");
    const suprimentos = cash.filter((c) => c.type === "suprimento" || c.type === "deposit");
    const vales = cash.filter((c) => c.type === "vale" || c.type === "advance");
    const sangriaTotal = sangrias.reduce((s, m) => s + Number(m.amount), 0);
    const suprimentoTotal = suprimentos.reduce((s, m) => s + Number(m.amount), 0);
    const valeTotal = vales.reduce((s, m) => s + Number(m.amount), 0);

    // Estoque
    const stockIn = stock
      .filter((m) => ["purchase", "return", "transfer_in", "adjustment_in"].includes(m.type))
      .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
    const stockOut = stock
      .filter((m) => ["sale", "loss", "transfer_out", "adjustment_out"].includes(m.type))
      .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
    const stockCost = stock
      .filter((m) => m.type === "purchase")
      .reduce((s, m) => s + Number(m.unit_cost || 0) * Math.abs(Number(m.quantity)), 0);

    // Lucro bruto estimado: faturamento - despesas - vale - sangria - custo de compras de estoque
    const netProfit = revenue - expensesTotal - valeTotal - stockCost;

    const ticket = validOrders.length ? revenue / validOrders.length : 0;

    // Top produtos do dia
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    validOrders.forEach((o) => {
      (o.order_items ?? []).forEach((it: any) => {
        const cur = productMap.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += it.quantity * Number(it.unit_price);
        productMap.set(it.product_name, cur);
      });
    });
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

    return {
      revenue,
      subtotal,
      deliveryFees,
      delivered,
      cancelled,
      inProgress,
      ordersCount: validOrders.length,
      totalOrders: orders.length,
      byMethod,
      payments,
      expensesTotal,
      sangriaTotal,
      suprimentoTotal,
      valeTotal,
      stockIn,
      stockOut,
      stockCost,
      netProfit,
      ticket,
      topProducts,
    };
  }, [data]);

  const newCustomersCount = data?.newCustomers.length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header com seletor de data */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-soft">
        <div>
          <h2 className="font-display text-xl font-bold">Histórico do dia</h2>
          <p className="text-xs text-muted-foreground capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
            Hoje
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="font-semibold">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-card p-12 text-center text-sm text-muted-foreground shadow-soft">
          Carregando histórico…
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={DollarSign} label="Faturamento" value={brl(stats.revenue)} accent />
            <Kpi icon={ShoppingBag} label="Pedidos válidos" value={String(stats.ordersCount)} sub={`${stats.totalOrders} no total`} />
            <Kpi icon={TrendingUp} label="Ticket médio" value={brl(stats.ticket)} />
            <Kpi
              icon={Wallet}
              label="Lucro estimado"
              value={brl(stats.netProfit)}
              sub="Receita − despesas − vales − compras"
              positive={stats.netProfit >= 0}
            />
          </div>

          {/* Status pedidos */}
          <section className="rounded-2xl bg-card p-5 shadow-soft">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
              <Package className="h-4 w-4 text-primary" /> Pedidos do dia
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Mini icon={CheckCircle2} label="Entregues" value={stats.delivered} tone="green" />
              <Mini icon={Clock} label="Em andamento" value={stats.inProgress} tone="amber" />
              <Mini icon={XCircle} label="Cancelados" value={stats.cancelled} tone="red" />
              <Mini icon={Receipt} label="Taxa de entrega" value={brl(stats.deliveryFees)} tone="neutral" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Split label="Delivery" left={stats.byMethod.delivery} right={stats.byMethod.pickup} rightLabel="Retirada" />
              <div className="rounded-xl border-2 border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Por forma de pagamento
                </p>
                {Object.keys(stats.payments).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem dados.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {Object.entries(stats.payments).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{k}</span>
                        <span className="font-bold">{brl(v)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* Financeiro */}
          <section className="grid gap-3 lg:grid-cols-3">
            <Block
              icon={ArrowDownCircle}
              tone="red"
              title="Despesas do dia"
              total={stats.expensesTotal}
              empty="Sem despesas lançadas."
              items={(data?.expenses ?? []).map((e) => ({
                label: e.description,
                value: Number(e.amount),
              }))}
            />
            <Block
              icon={Wallet}
              tone="amber"
              title="Vales / adiantamentos"
              total={stats.valeTotal}
              empty="Sem vales registrados."
              items={(data?.cash ?? [])
                .filter((c) => c.type === "vale" || c.type === "advance")
                .map((c) => ({
                  label: `${c.created_by_name ?? "—"} ${c.description ? `• ${c.description}` : ""}`,
                  value: Number(c.amount),
                }))}
            />
            <Block
              icon={ArrowUpCircle}
              tone="purple"
              title="Sangrias e suprimentos"
              total={stats.suprimentoTotal - stats.sangriaTotal}
              empty="Sem movimentações de caixa."
              items={(data?.cash ?? [])
                .filter((c) => ["sangria", "suprimento", "withdrawal", "deposit"].includes(c.type))
                .map((c) => ({
                  label: `${c.type} • ${c.description ?? "—"}`,
                  value: ["sangria", "withdrawal"].includes(c.type)
                    ? -Number(c.amount)
                    : Number(c.amount),
                }))}
            />
          </section>

          {/* Estoque */}
          <section className="rounded-2xl bg-card p-5 shadow-soft">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
              <Boxes className="h-4 w-4 text-primary" /> Movimentações de estoque
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Mini icon={ArrowDownCircle} label="Entradas" value={stats.stockIn} tone="green" />
              <Mini icon={ArrowUpCircle} label="Saídas" value={stats.stockOut} tone="red" />
              <Mini icon={DollarSign} label="Custo de compras" value={brl(stats.stockCost)} tone="neutral" />
            </div>
            {(data?.stock ?? []).length > 0 && (
              <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Horário</th>
                      <th className="px-3 py-2 text-left">Produto</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-right">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.stock ?? []).map((m: any) => (
                      <tr key={m.id} className="border-t">
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {format(new Date(m.created_at), "HH:mm")}
                        </td>
                        <td className="px-3 py-2">{m.products?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-xs capitalize text-muted-foreground">{m.type}</td>
                        <td className="px-3 py-2 text-right font-bold">{m.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Clientes + Top produtos */}
          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-card p-5 shadow-soft">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                <Users className="h-4 w-4 text-primary" /> Novos clientes
                <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {newCustomersCount}
                </span>
              </h3>
              {newCustomersCount === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cliente novo neste dia.</p>
              ) : (
                <ul className="space-y-2">
                  {(data?.newCustomers ?? []).map((c) => (
                    <li
                      key={c.phone}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.phone}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl bg-card p-5 shadow-soft">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                <TrendingUp className="h-4 w-4 text-primary" /> Top produtos do dia
              </h3>
              {stats.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem vendas neste dia.</p>
              ) : (
                <ul className="space-y-2.5">
                  {stats.topProducts.map((p, i) => (
                    <li key={p.name} className="flex items-center gap-3">
                      <span className="w-6 font-display text-xl font-bold text-muted-foreground">
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.qty} un • {brl(p.revenue)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

// ===== Helpers =====
const Kpi = ({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  positive,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  positive?: boolean;
}) => (
  <div
    className={cn(
      "rounded-2xl p-4 shadow-soft",
      accent ? "gradient-primary text-primary-foreground" : "bg-card",
      positive === false && "border-2 border-destructive/40",
    )}
  >
    <div className="flex items-center gap-1.5 text-xs font-bold opacity-90">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    {sub && <div className="mt-0.5 text-[11px] opacity-75">{sub}</div>}
  </div>
);

const Mini = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number | string;
  tone: "green" | "amber" | "red" | "neutral";
}) => {
  const tones: Record<string, string> = {
    green: "bg-green-500/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
    red: "bg-destructive/10 text-destructive",
    neutral: "bg-muted text-foreground",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-3">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="font-display text-lg font-bold leading-tight">{value}</div>
      </div>
    </div>
  );
};

const Split = ({
  label,
  left,
  right,
  rightLabel,
}: {
  label: string;
  left: number;
  right: number;
  rightLabel: string;
}) => {
  const total = left + right || 1;
  const lp = Math.round((left / total) * 100);
  return (
    <div className="rounded-xl border-2 border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label} vs {rightLabel}
      </p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="bg-primary" style={{ width: `${lp}%` }} />
        <div className="bg-amber-500" style={{ width: `${100 - lp}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-semibold">
        <span className="text-primary">{label}: {left}</span>
        <span className="text-amber-600">{rightLabel}: {right}</span>
      </div>
    </div>
  );
};

const Block = ({
  icon: Icon,
  tone,
  title,
  total,
  empty,
  items,
}: {
  icon: any;
  tone: "red" | "amber" | "purple";
  title: string;
  total: number;
  empty: string;
  items: { label: string; value: number }[];
}) => {
  const tones: Record<string, string> = {
    red: "bg-destructive/10 text-destructive",
    amber: "bg-amber-500/10 text-amber-600",
    purple: "bg-purple-500/10 text-purple-600",
  };
  return (
    <div className="rounded-2xl bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-bold">
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tones[tone])}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </h3>
        <span className="font-display text-lg font-bold">{brl(total)}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-44 space-y-1.5 overflow-y-auto text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 last:border-0">
              <span className="truncate text-muted-foreground">{it.label}</span>
              <span className={cn("shrink-0 font-bold", it.value < 0 && "text-destructive")}>
                {brl(it.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HistoryTab;
