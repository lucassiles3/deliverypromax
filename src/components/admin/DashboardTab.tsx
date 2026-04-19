import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  ShoppingBag,
  Clock,
  Star,
  Download,
  TrendingUp,
  AlertTriangle,
  PackageX,
  Trophy,
  Store as StoreIcon,
  Tag,
  Truck,
  CheckCircle2,
  XCircle,
  Bell,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  differenceInMinutes,
  parse,
  isAfter,
  isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type RangeKey = "today" | "7d" | "30d";

const rangeConfig: Record<RangeKey, { label: string; from: () => Date }> = {
  today: { label: "Hoje", from: () => startOfDay(new Date()) },
  "7d": { label: "Últimos 7 dias", from: () => subDays(startOfDay(new Date()), 6) },
  "30d": { label: "Últimos 30 dias", from: () => subDays(startOfDay(new Date()), 29) },
};

type PaymentFilter = "all" | "pix" | "credit" | "debit" | "cash";

const PREP_TARGET_MIN = 30; // referência de tempo de preparo
const ATRASO_MIN = 45; // alerta amarelo se em preparo > 45min

export const DashboardTab = ({ storeId }: { storeId: string }) => {
  const [range, setRange] = useState<RangeKey>("today");
  const [payFilter, setPayFilter] = useState<PaymentFilter>("all");
  const [, force] = useState(0);

  // Re-render a cada 30s para atualizar cronômetros
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Loja
  const { data: store } = useQuery({
    queryKey: ["dashboard-store", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, rating, opening_hours, open")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Pedidos do range
  const { data: orders = [] } = useQuery({
    queryKey: ["dashboard-orders", storeId, range],
    enabled: !!storeId,
    refetchInterval: 20000,
    queryFn: async () => {
      const from = rangeConfig[range].from().toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total, status, method, payment_method, customer_name, customer_phone, created_at, updated_at"
        )
        .eq("store_id", storeId)
        .gte("created_at", from)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fila ao vivo (sempre últimos 50, independente de range)
  const { data: liveOrders = [] } = useQuery({
    queryKey: ["dashboard-live", storeId],
    enabled: !!storeId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, method, customer_name, total, created_at, updated_at, notes")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Produtos sem estoque
  const { data: outOfStock = [] } = useQuery({
    queryKey: ["dashboard-out-of-stock", storeId],
    enabled: !!storeId,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock, active")
        .eq("store_id", storeId)
        .eq("track_stock", true)
        .lte("stock", 0);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Filtros
  const filteredOrders = useMemo(() => {
    if (payFilter === "all") return orders;
    return orders.filter((o) => o.payment_method === payFilter);
  }, [orders, payFilter]);

  const validOrders = useMemo(
    () => filteredOrders.filter((o) => o.status !== "cancelled"),
    [filteredOrders]
  );

  // KPIs
  const todayOrders = useMemo(() => {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    return orders.filter(
      (o) =>
        o.status !== "cancelled" &&
        new Date(o.created_at) >= start &&
        new Date(o.created_at) <= end
    );
  }, [orders]);

  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const todayCount = todayOrders.length;

  const avgDeliveryMin = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    if (!delivered.length) return 0;
    const total = delivered.reduce(
      (s, o) => s + differenceInMinutes(new Date(o.updated_at), new Date(o.created_at)),
      0
    );
    return Math.round(total / delivered.length);
  }, [orders]);

  const rating = Number(store?.rating ?? 0);

  // Série do gráfico
  const chart = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    validOrders.forEach((o) => {
      const key = format(new Date(o.created_at), range === "today" ? "HH:00" : "yyyy-MM-dd");
      const cur = map.get(key) ?? { revenue: 0, count: 0 };
      cur.revenue += Number(o.total);
      cur.count += 1;
      map.set(key, cur);
    });
    const entries = Array.from(map.entries()).sort();
    const max = Math.max(1, ...entries.map(([, v]) => v.revenue));
    return entries.map(([key, v]) => ({
      key,
      label: range === "today" ? key : format(new Date(key), "dd/MM"),
      revenue: v.revenue,
      count: v.count,
      avg: v.count ? v.revenue / v.count : 0,
      pct: (v.revenue / max) * 100,
    }));
  }, [validOrders, range]);

  const totalRev = validOrders.reduce((s, o) => s + Number(o.total), 0);
  const ticket = validOrders.length ? totalRev / validOrders.length : 0;

  // Fila ao vivo agrupada
  const queue = useMemo(() => {
    const newOnes = liveOrders.filter((o) => o.status === "received" || o.status === "pending_payment");
    const preparing = liveOrders.filter((o) => o.status === "preparing");
    const onTheWay = liveOrders.filter((o) => o.status === "out_for_delivery");
    const cancelled = liveOrders.filter((o) => o.status === "cancelled").slice(0, 5);
    const delayed = preparing.filter(
      (o) => differenceInMinutes(new Date(), new Date(o.updated_at)) >= ATRASO_MIN
    );
    return { newOnes, preparing, onTheWay, cancelled, delayed };
  }, [liveOrders]);

  // Alertas
  const alerts = useMemo(() => {
    const arr: { id: string; level: "danger" | "warn" | "info" | "success"; icon: typeof Bell; text: string }[] = [];
    outOfStock.forEach((p) =>
      arr.push({
        id: `stock-${p.id}`,
        level: "danger",
        icon: PackageX,
        text: `Sem estoque: "${p.name}"${p.active ? " — pause o item" : " (já pausado)"}`,
      })
    );
    if (queue.delayed.length) {
      arr.push({
        id: "delay",
        level: "warn",
        icon: Timer,
        text: `${queue.delayed.length} pedido(s) em preparo há mais de ${ATRASO_MIN}min`,
      });
    }
    // Loja prestes a fechar
    const closing = getClosingInMinutes(store?.opening_hours);
    if (closing !== null && closing <= 30 && closing > 0) {
      arr.push({
        id: "closing",
        level: "warn",
        icon: StoreIcon,
        text: `Loja fecha em ${closing} min`,
      });
    }
    // Meta diária — heurística simples (R$ 1000/dia). Trocar por config no futuro.
    const META = 1000;
    if (todayRevenue >= META) {
      arr.push({
        id: "meta",
        level: "success",
        icon: Trophy,
        text: `🎉 Meta diária de R$ ${META} batida! Faturamento: R$ ${todayRevenue.toFixed(2)}`,
      });
    }
    return arr;
  }, [outOfStock, queue.delayed, store?.opening_hours, todayRevenue]);

  // Confete quando meta bate
  const metaHit = alerts.some((a) => a.id === "meta");
  useEffect(() => {
    if (!metaHit) return;
    const key = `meta-confetti-${storeId}-${format(new Date(), "yyyy-MM-dd")}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fireConfetti();
  }, [metaHit, storeId]);

  const exportCSV = () => {
    const header = "Período,Faturamento,Pedidos,Ticket médio\n";
    const rows = chart
      .map((r) => `${r.label},${r.revenue.toFixed(2)},${r.count},${r.avg.toFixed(2)}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-${range}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* 1.4 Alertas */}
      {alerts.length > 0 && (
        <section className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">Alertas</h3>
            <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              {alerts.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {alerts.map((a) => {
              const Icon = a.icon;
              const cls =
                a.level === "danger"
                  ? "bg-destructive/10 text-destructive"
                  : a.level === "warn"
                    ? "bg-amber-500/10 text-amber-600"
                    : a.level === "success"
                      ? "bg-green-500/10 text-green-600"
                      : "bg-blue-500/10 text-blue-600";
              return (
                <li
                  key={a.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${cls}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{a.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 1.1 KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Faturamento hoje"
          value={`R$ ${todayRevenue.toFixed(2).replace(".", ",")}`}
          accent
        />
        <KpiCard icon={ShoppingBag} label="Pedidos hoje" value={String(todayCount)} />
        <KpiCard
          icon={Clock}
          label="Tempo médio entrega"
          value={avgDeliveryMin ? `${avgDeliveryMin} min` : "—"}
        />
        <KpiCard
          icon={Star}
          label="Avaliação média"
          value={rating ? rating.toFixed(1).replace(".", ",") : "—"}
        />
      </div>

      {/* 1.2 Gráfico */}
      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-bold">Vendas</h3>
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {(Object.keys(rangeConfig) as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-smooth ${
                  range === r
                    ? "gradient-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/70"
                }`}
              >
                {rangeConfig[r].label}
              </button>
            ))}
          </div>
          <select
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value as PaymentFilter)}
            className="rounded-lg border-2 bg-background px-3 py-1.5 text-xs font-semibold outline-none focus:border-primary"
          >
            <option value="all">Todos pagamentos</option>
            <option value="pix">Pix</option>
            <option value="credit">Crédito</option>
            <option value="debit">Débito</option>
            <option value="cash">Dinheiro</option>
          </select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <MiniStat label="Faturamento" value={`R$ ${totalRev.toFixed(2).replace(".", ",")}`} />
          <MiniStat label="Pedidos" value={String(validOrders.length)} />
          <MiniStat label="Ticket médio" value={`R$ ${ticket.toFixed(2).replace(".", ",")}`} />
        </div>

        {chart.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem vendas no período.
          </p>
        ) : (
          <div className="flex h-48 items-end gap-1.5">
            {chart.map((d) => (
              <div key={d.key} className="group flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md gradient-primary transition-smooth group-hover:opacity-80"
                    style={{ height: `${Math.max(4, d.pct)}%` }}
                    title={`${d.label} • R$ ${d.revenue.toFixed(2)} • ${d.count} pedido(s)`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 1.3 Fila ao vivo */}
      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-bold">Fila ao vivo</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            atualiza a cada 15s
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QueueColumn
            title="Novos"
            icon={Bell}
            tone="primary"
            items={queue.newOnes}
            renderMeta={(o) => (
              <span className="text-xs font-medium text-muted-foreground">
                aguardando aceite • {timeAgo(o.created_at)}
              </span>
            )}
          />
          <QueueColumn
            title="Em preparo"
            icon={Timer}
            tone="amber"
            items={queue.preparing}
            renderMeta={(o) => {
              const elapsed = differenceInMinutes(new Date(), new Date(o.updated_at));
              const remaining = PREP_TARGET_MIN - elapsed;
              const isLate = elapsed >= ATRASO_MIN;
              return (
                <span
                  className={`text-xs font-bold ${
                    isLate
                      ? "text-destructive"
                      : remaining <= 5
                        ? "text-amber-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {isLate
                    ? `⚠ atrasado ${elapsed}min`
                    : remaining > 0
                      ? `⏱ ${remaining}min restante`
                      : `${elapsed}min`}
                </span>
              );
            }}
          />
          <QueueColumn
            title="Saiu p/ entrega"
            icon={Truck}
            tone="purple"
            items={queue.onTheWay}
            renderMeta={(o) => (
              <span className="text-xs font-medium text-muted-foreground">
                em rota • {timeAgo(o.updated_at)}
              </span>
            )}
          />
          <QueueColumn
            title="Cancelados"
            icon={XCircle}
            tone="destructive"
            items={queue.cancelled}
            renderMeta={(o) => (
              <span className="text-xs italic text-muted-foreground">
                {o.notes ?? "sem motivo informado"}
              </span>
            )}
          />
        </div>
      </section>
    </div>
  );
};

// ---------- helpers ----------

const KpiCard = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  accent?: boolean;
}) => (
  <div
    className={`rounded-2xl p-4 shadow-soft ${
      accent ? "gradient-primary text-primary-foreground" : "bg-card"
    }`}
  >
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 opacity-80" />
      <div className="text-xs font-medium opacity-90">{label}</div>
    </div>
    <div className="mt-2 font-display text-2xl font-bold">{value}</div>
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-muted px-3 py-2">
    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
    <div className="font-display text-base font-bold">{value}</div>
  </div>
);

type LiveOrder = {
  id: string;
  status: string;
  method: string;
  customer_name: string;
  total: number;
  created_at: string;
  updated_at: string;
  notes: string | null;
};

const QueueColumn = ({
  title,
  icon: Icon,
  tone,
  items,
  renderMeta,
}: {
  title: string;
  icon: typeof Bell;
  tone: "primary" | "amber" | "purple" | "destructive";
  items: LiveOrder[];
  renderMeta: (o: LiveOrder) => React.ReactNode;
}) => {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600",
    purple: "bg-purple-500/10 text-purple-600",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${toneCls}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h4 className="text-sm font-bold">{title}</h4>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Vazio</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 5).map((o) => (
            <li key={o.id} className="rounded-lg bg-muted/40 p-2">
              <div className="flex items-center gap-2">
                <strong className="text-xs">#{o.id.slice(0, 6).toUpperCase()}</strong>
                <span className="text-[11px] text-muted-foreground">
                  {o.method === "delivery" ? "🛵" : "🏪"}
                </span>
                <span className="ml-auto text-xs font-bold">
                  R$ {Number(o.total).toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="truncate text-[11px] font-medium">{o.customer_name}</div>
              <div className="mt-0.5">{renderMeta(o)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function timeAgo(iso: string) {
  const min = differenceInMinutes(new Date(), new Date(iso));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  return format(new Date(iso), "HH:mm");
}

function getClosingInMinutes(hours: any): number | null {
  if (!hours) return null;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = days[new Date().getDay()];
  const cfg = hours[today];
  if (!cfg?.close) return null;
  try {
    const closeStr = cfg.close as string;
    const now = new Date();
    let close = parse(closeStr, "HH:mm", now);
    // Se fechar passa da meia-noite (ex: 00:00), considerar dia seguinte
    if (closeStr === "00:00" || isBefore(close, parse(cfg.open ?? "00:00", "HH:mm", now))) {
      close = new Date(close.getTime() + 24 * 60 * 60 * 1000);
    }
    if (!isAfter(close, now)) return null;
    return differenceInMinutes(close, now);
  } catch {
    return null;
  }
}

function fireConfetti() {
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(root);
  const colors = ["#f43f5e", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7"];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 6;
    p.style.cssText = `position:absolute;top:-20px;left:${Math.random() * 100}%;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:2px;transform:rotate(${Math.random() * 360}deg);transition:transform 2.5s linear, top 2.5s linear, opacity 2.5s linear;`;
    root.appendChild(p);
    requestAnimationFrame(() => {
      p.style.top = `${100 + Math.random() * 20}%`;
      p.style.transform = `rotate(${720 + Math.random() * 360}deg) translateX(${(Math.random() - 0.5) * 200}px)`;
      p.style.opacity = "0";
    });
  }
  setTimeout(() => root.remove(), 3000);
}
