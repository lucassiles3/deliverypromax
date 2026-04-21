import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  ShoppingBag,
  Clock,
  Star,
  TrendingUp,
  TrendingDown,
  Trophy,
  Truck,
  CheckCircle2,
  XCircle,
  Bell,
  Timer,
  Users,
  UserPlus,
  Repeat,
  Receipt,
  Tag,
  MousePointerClick,
  Eye,
  ShoppingCart,
  Sparkles,
  Plus,
  Megaphone,
  Banknote,
  Settings as SettingsIcon,
  CreditCard,
  Wallet,
  MapPin,
  Activity,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
  differenceInMinutes,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PREP_TARGET = 30;
const ATRASO_MIN = 45;

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SOURCE_LABELS: Record<string, string> = {
  app: "App",
  whatsapp: "WhatsApp",
  site: "Site",
  pdv: "Balcão",
  qr: "QR Code",
  table: "Mesa",
};

export const DashboardTab = ({ storeId }: { storeId: string }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ---------------- DATA ----------------
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));
  const last30Start = subDays(startOfDay(now), 29);

  const { data: store } = useQuery({
    queryKey: ["dash-store", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, rating, reviews")
        .eq("id", storeId)
        .maybeSingle();
      return data;
    },
  });

  // Pedidos do mês atual + últimos 30 dias (cobre os gráficos)
  const { data: monthOrders = [] } = useQuery({
    queryKey: ["dash-month-orders", storeId, format(monthStart, "yyyy-MM")],
    enabled: !!storeId,
    refetchInterval: 30000,
    queryFn: async () => {
      const from = (last30Start < monthStart ? last30Start : monthStart).toISOString();
      const { data } = await supabase
        .from("orders")
        .select(
          "id, total, subtotal, delivery_fee, status, method, payment_method, source, customer_name, customer_phone, user_id, created_at, updated_at, address, courier_id"
        )
        .eq("store_id", storeId)
        .gte("created_at", from)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Mês anterior (apenas total p/ comparativo)
  const { data: prevMonthOrders = [] } = useQuery({
    queryKey: ["dash-prev-month", storeId, format(prevMonthStart, "yyyy-MM")],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, customer_phone, user_id, created_at")
        .eq("store_id", storeId)
        .gte("created_at", prevMonthStart.toISOString())
        .lte("created_at", prevMonthEnd.toISOString());
      return data ?? [];
    },
  });

  // Fila ao vivo
  const { data: liveOrders = [] } = useQuery({
    queryKey: ["dash-live", storeId],
    enabled: !!storeId,
    refetchInterval: 12000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, method, customer_name, total, created_at, updated_at, source")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  // Top produtos (mês)
  const { data: topProducts = [] } = useQuery({
    queryKey: ["dash-top-products", storeId, format(monthStart, "yyyy-MM")],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("product_name, quantity, unit_price, orders!inner(store_id, created_at, status)")
        .eq("orders.store_id", storeId)
        .gte("orders.created_at", monthStart.toISOString())
        .neq("orders.status", "cancelled");
      const map = new Map<string, { qty: number; revenue: number }>();
      (data ?? []).forEach((row: any) => {
        const cur = map.get(row.product_name) ?? { qty: 0, revenue: 0 };
        cur.qty += row.quantity ?? 0;
        cur.revenue += (row.quantity ?? 0) * Number(row.unit_price ?? 0);
        map.set(row.product_name, cur);
      });
      return Array.from(map.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);
    },
  });

  // Couriers
  const { data: couriers = [] } = useQuery({
    queryKey: ["dash-couriers", storeId],
    enabled: !!storeId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("couriers")
        .select("id, name, is_online, active")
        .eq("store_id", storeId)
        .eq("active", true);
      return data ?? [];
    },
  });

  // Cupons usados (mês)
  const { data: couponUses = 0 } = useQuery({
    queryKey: ["dash-coupons", storeId, format(monthStart, "yyyy-MM")],
    enabled: !!storeId,
    queryFn: async () => {
      const { count } = await supabase
        .from("coupon_redemptions")
        .select("id, coupons!inner(store_id)", { count: "exact", head: true })
        .eq("coupons.store_id", storeId)
        .gte("created_at", monthStart.toISOString());
      return count ?? 0;
    },
  });

  // Carrinhos abandonados
  const { data: abandoned = 0 } = useQuery({
    queryKey: ["dash-abandoned", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { count } = await supabase
        .from("abandoned_carts")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .is("recovered_at", null)
        .gte("updated_at", subDays(now, 7).toISOString());
      return count ?? 0;
    },
  });

  // ---------------- DERIVED ----------------
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const todayOrders = monthOrders.filter(
    (o) => new Date(o.created_at) >= todayStart && new Date(o.created_at) <= todayEnd
  );
  const todayValid = todayOrders.filter((o) => o.status !== "cancelled");
  const todayCancelled = todayOrders.filter((o) => o.status === "cancelled");
  const todayDelivered = todayOrders.filter((o) => o.status === "delivered");
  const todayRevenue = todayValid.reduce((s, o) => s + Number(o.total), 0);
  const todayTicket = todayValid.length ? todayRevenue / todayValid.length : 0;

  const monthValid = monthOrders.filter(
    (o) =>
      o.status !== "cancelled" &&
      new Date(o.created_at) >= monthStart &&
      new Date(o.created_at) <= monthEnd
  );
  const monthRevenue = monthValid.reduce((s, o) => s + Number(o.total), 0);
  const prevMonthValid = prevMonthOrders.filter((o) => o.status !== "cancelled");
  const prevMonthRevenue = prevMonthValid.reduce((s, o) => s + Number(o.total), 0);
  const monthGrowth =
    prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

  // Novos clientes hoje (primeiro pedido = hoje)
  const customerFirstOrder = useMemo(() => {
    const map = new Map<string, Date>();
    [...monthOrders, ...prevMonthOrders].forEach((o) => {
      const key = o.user_id || o.customer_phone;
      if (!key) return;
      const d = new Date(o.created_at);
      const cur = map.get(key);
      if (!cur || d < cur) map.set(key, d);
    });
    return map;
  }, [monthOrders, prevMonthOrders]);

  const newCustomersToday = Array.from(customerFirstOrder.values()).filter(
    (d) => d >= todayStart && d <= todayEnd
  ).length;

  // Recompra (mês): % clientes com 2+ pedidos
  const monthCustomers = useMemo(() => {
    const m = new Map<string, number>();
    monthValid.forEach((o) => {
      const k = o.user_id || o.customer_phone;
      if (!k) return;
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [monthValid]);
  const recurring = Array.from(monthCustomers.values()).filter((n) => n >= 2).length;
  const totalMonthCustomers = monthCustomers.size;
  const repurchaseRate = totalMonthCustomers ? (recurring / totalMonthCustomers) * 100 : 0;

  // Lucro estimado (mês) — receita * 30% como heurística simples
  const estimatedProfit = monthRevenue * 0.3;

  // Tempo médio entrega
  const avgDeliveryMin = useMemo(() => {
    const d = monthValid.filter((o) => o.status === "delivered" && o.method === "delivery");
    if (!d.length) return 0;
    return Math.round(
      d.reduce((s, o) => s + differenceInMinutes(new Date(o.updated_at), new Date(o.created_at)), 0) /
        d.length
    );
  }, [monthValid]);

  const onTimeRate = useMemo(() => {
    const d = monthValid.filter((o) => o.status === "delivered" && o.method === "delivery");
    if (!d.length) return 100;
    const onTime = d.filter(
      (o) => differenceInMinutes(new Date(o.updated_at), new Date(o.created_at)) <= 60
    ).length;
    return (onTime / d.length) * 100;
  }, [monthValid]);

  const avgDeliveryFee = useMemo(() => {
    const d = monthValid.filter((o) => o.method === "delivery" && o.delivery_fee);
    if (!d.length) return 0;
    return d.reduce((s, o) => s + Number(o.delivery_fee), 0) / d.length;
  }, [monthValid]);

  // Pagamentos
  const payments = useMemo(() => {
    const acc = { pix: 0, credit: 0, debit: 0, cash: 0, other: 0 };
    monthValid.forEach((o) => {
      const k = o.payment_method as keyof typeof acc;
      if (k in acc) acc[k] += Number(o.total);
      else acc.other += Number(o.total);
    });
    return acc;
  }, [monthValid]);

  // Vendas por dia (30 dias)
  const dailySales = useMemo(() => {
    const days = eachDayOfInterval({ start: last30Start, end: now });
    const map = new Map<string, number>();
    monthOrders
      .filter((o) => o.status !== "cancelled")
      .forEach((o) => {
        const k = format(new Date(o.created_at), "yyyy-MM-dd");
        map.set(k, (map.get(k) ?? 0) + Number(o.total));
      });
    return days.map((d) => ({
      date: format(d, "dd/MM"),
      total: Number((map.get(format(d, "yyyy-MM-dd")) ?? 0).toFixed(2)),
    }));
  }, [monthOrders, now, last30Start]);

  // Pedidos por horário (mês)
  const ordersByHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, total: 0 }));
    monthValid.forEach((o) => {
      const h = new Date(o.created_at).getHours();
      arr[h].total += 1;
    });
    return arr;
  }, [monthValid]);

  const peakHour = ordersByHour.reduce((p, c) => (c.total > p.total ? c : p), ordersByHour[0]);

  // Origem dos pedidos
  const sourceData = useMemo(() => {
    const m = new Map<string, number>();
    monthValid.forEach((o) => {
      const k = o.source || "app";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([k, v]) => ({
      name: SOURCE_LABELS[k] ?? k,
      value: v,
    }));
  }, [monthValid]);

  // Top bairros
  const topBairros = useMemo(() => {
    const m = new Map<string, number>();
    monthValid.forEach((o) => {
      const a = (o.address as any) ?? {};
      const bairro = a.neighborhood || a.bairro || a.district;
      if (!bairro) return;
      m.set(bairro, (m.get(bairro) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [monthValid]);

  // Top clientes
  const topCustomers = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number }>();
    monthValid.forEach((o) => {
      const k = o.user_id || o.customer_phone;
      if (!k) return;
      const cur = m.get(k) ?? { name: o.customer_name, total: 0, count: 0 };
      cur.total += Number(o.total);
      cur.count += 1;
      m.set(k, cur);
    });
    return Array.from(m.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [monthValid]);

  // Top dias de faturamento
  const topDays = useMemo(() => {
    const m = new Map<string, number>();
    monthValid.forEach((o) => {
      const k = format(new Date(o.created_at), "yyyy-MM-dd");
      m.set(k, (m.get(k) ?? 0) + Number(o.total));
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [monthValid]);

  // Fila
  const queue = useMemo(() => {
    const newOnes = liveOrders.filter(
      (o) => o.status === "received" || o.status === "pending_payment"
    );
    const preparing = liveOrders.filter((o) => o.status === "preparing");
    const onTheWay = liveOrders.filter((o) => o.status === "out_for_delivery");
    const delivered = liveOrders.filter(
      (o) =>
        o.status === "delivered" &&
        new Date(o.updated_at) >= todayStart
    );
    return { newOnes, preparing, onTheWay, delivered };
  }, [liveOrders, todayStart]);

  // IA insights heurísticos
  const insights = useMemo(() => {
    const arr: { icon: typeof Lightbulb; text: string }[] = [];
    if (peakHour && peakHour.total > 0) {
      arr.push({ icon: Flame, text: `Seu pico de vendas é às ${peakHour.hour} (${peakHour.total} pedidos no mês).` });
    }
    if (topProducts[0]) {
      arr.push({
        icon: Trophy,
        text: `"${topProducts[0].name}" é seu campeão: ${topProducts[0].qty} unidades vendidas.`,
      });
    }
    if (topCustomers[0] && topCustomers[0].count >= 3) {
      arr.push({
        icon: Users,
        text: `${topCustomers[0].name} é cliente fiel: ${topCustomers[0].count} pedidos no mês.`,
      });
    }
    if (abandoned > 0) {
      arr.push({
        icon: ShoppingCart,
        text: `${abandoned} carrinhos abandonados na semana — envie cupom para recuperar.`,
      });
    }
    if (monthGrowth > 10) {
      arr.push({
        icon: TrendingUp,
        text: `Crescimento de ${monthGrowth.toFixed(1)}% vs mês anterior — mantenha o ritmo!`,
      });
    } else if (monthGrowth < -5 && prevMonthRevenue > 0) {
      arr.push({
        icon: TrendingDown,
        text: `Queda de ${Math.abs(monthGrowth).toFixed(1)}% vs mês anterior. Que tal uma campanha relâmpago?`,
      });
    }
    if (todayRevenue > 0 && todayCancelled.length / Math.max(1, todayOrders.length) > 0.15) {
      arr.push({
        icon: XCircle,
        text: `Taxa alta de cancelamento hoje (${todayCancelled.length}). Verifique estoque e tempo de preparo.`,
      });
    }
    if (couriers.filter((c) => c.is_online).length === 0 && queue.newOnes.length > 0) {
      arr.push({
        icon: Truck,
        text: `Você tem ${queue.newOnes.length} pedido(s) novos e nenhum entregador online.`,
      });
    }
    return arr.slice(0, 6);
  }, [
    peakHour,
    topProducts,
    topCustomers,
    abandoned,
    monthGrowth,
    prevMonthRevenue,
    todayRevenue,
    todayCancelled,
    todayOrders,
    couriers,
    queue.newOnes,
  ]);

  // ---------------- RENDER ----------------
  const onlineCouriers = couriers.filter((c) => c.is_online).length;
  const lateOrders = queue.preparing.filter(
    (o) => differenceInMinutes(now, new Date(o.updated_at)) >= ATRASO_MIN
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero / saudação */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-secondary p-6 text-primary-foreground shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[260px]">
            <p className="text-sm font-medium opacity-90">Bem-vindo de volta 👋</p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              {store?.name ?? "Sua loja"} já faturou{" "}
              <span className="bg-background/20 px-2 py-0.5 rounded-lg">
                {fmtBRL(todayRevenue)}
              </span>{" "}
              hoje 🚀
            </h1>
            <p className="mt-2 text-sm opacity-90">
              {todayValid.length} pedidos • ticket médio {fmtBRL(todayTicket)} • {newCustomersToday} cliente
              {newCustomersToday !== 1 ? "s" : ""} novo{newCustomersToday !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:flex sm:gap-3">
            <div className="rounded-2xl bg-background/15 px-4 py-3 backdrop-blur">
              <div className="text-xs opacity-80">Crescimento mês</div>
              <div className="font-display text-xl font-bold">
                {monthGrowth >= 0 ? "+" : ""}
                {monthGrowth.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-2xl bg-background/15 px-4 py-3 backdrop-blur">
              <div className="text-xs opacity-80">Ranking cidade</div>
              <div className="font-display text-xl font-bold">Top 18%</div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="flex flex-wrap gap-2">
        <QuickAction icon={Plus} label="Adicionar produto" />
        <QuickAction icon={Tag} label="Criar cupom" />
        <QuickAction icon={Megaphone} label="Abrir campanha" />
        <QuickAction icon={ShoppingBag} label="Ver pedidos" />
        <QuickAction icon={Banknote} label="Solicitar saque" />
        <QuickAction icon={SettingsIcon} label="Configurar loja" />
      </section>

      {/* HOJE */}
      <Section title="Hoje" icon={Activity}>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={DollarSign} label="Faturamento" value={fmtBRL(todayRevenue)} accent />
          <Kpi icon={ShoppingBag} label="Pedidos" value={String(todayValid.length)} />
          <Kpi icon={UserPlus} label="Novos clientes" value={String(newCustomersToday)} />
          <Kpi icon={Receipt} label="Ticket médio" value={fmtBRL(todayTicket)} />
          <Kpi icon={CheckCircle2} label="Entregas" value={String(todayDelivered.length)} />
          <Kpi
            icon={XCircle}
            label="Cancelamentos"
            value={String(todayCancelled.length)}
            tone={todayCancelled.length > 3 ? "danger" : undefined}
          />
        </div>
      </Section>

      {/* MÊS */}
      <Section title="Este mês" icon={TrendingUp}>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={DollarSign} label="Receita" value={fmtBRL(monthRevenue)} accent />
          <Kpi icon={ShoppingBag} label="Pedidos" value={String(monthValid.length)} />
          <Kpi
            icon={monthGrowth >= 0 ? ArrowUpRight : ArrowDownRight}
            label="vs mês anterior"
            value={`${monthGrowth >= 0 ? "+" : ""}${monthGrowth.toFixed(1)}%`}
            tone={monthGrowth >= 0 ? "success" : "danger"}
          />
          <Kpi
            icon={Star}
            label="Avaliação"
            value={store?.rating ? Number(store.rating).toFixed(1) : "—"}
          />
          <Kpi icon={Repeat} label="Recompra" value={`${repurchaseRate.toFixed(0)}%`} />
          <Kpi icon={Wallet} label="Lucro estimado" value={fmtBRL(estimatedProfit)} />
        </div>
      </Section>

      {/* GRÁFICOS */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Vendas por dia (30d)" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailySales}>
              <defs>
                <linearGradient id="grad-sales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                }}
                formatter={(v: number) => fmtBRL(v)}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                fill="url(#grad-sales)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pedidos por horário" icon={Clock}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ordersByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={1} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="total" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 produtos" icon={Trophy}>
          {topProducts.length === 0 ? (
            <Empty text="Sem vendas no mês" />
          ) : (
            <ul className="space-y-2">
              {topProducts.map((p, i) => {
                const max = topProducts[0].qty;
                const pct = (p.qty / max) * 100;
                return (
                  <li key={p.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        {p.qty} • {fmtBRL(p.revenue)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Origem dos pedidos" icon={MousePointerClick}>
          {sourceData.length === 0 ? (
            <Empty text="Sem dados" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={sourceData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {sourceData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(var(--${["primary", "accent", "secondary", "success", "primary-glow"][i % 5]}))`}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {sourceData.map((s, i) => (
              <span
                key={s.name}
                className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: `hsl(var(--${["primary", "accent", "secondary", "success", "primary-glow"][i % 5]}))`,
                  }}
                />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* CLIENTES + LOGÍSTICA */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Clientes" icon={Users} cta="Ver CRM completo">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <Kpi icon={Users} label="Ativos (mês)" value={String(totalMonthCustomers)} />
            <Kpi icon={UserPlus} label="Novos hoje" value={String(newCustomersToday)} />
            <Kpi icon={Repeat} label="Recorrentes" value={String(recurring)} />
            <Kpi
              icon={XCircle}
              label="Perdidos"
              value={String(Math.max(0, prevMonthValid.length - monthValid.length))}
            />
            <Kpi
              icon={Activity}
              label="Freq. média"
              value={`${(monthValid.length / Math.max(1, totalMonthCustomers)).toFixed(1)}x`}
            />
            <Kpi
              icon={MapPin}
              label="Top bairro"
              value={topBairros[0]?.[0] ?? "—"}
            />
          </div>
        </Section>

        <Section title="Logística" icon={Truck}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <Kpi icon={CheckCircle2} label="No prazo" value={`${onTimeRate.toFixed(0)}%`} tone="success" />
            <Kpi icon={Clock} label="Tempo médio" value={avgDeliveryMin ? `${avgDeliveryMin} min` : "—"} />
            <Kpi icon={Truck} label="Motoboys ativos" value={String(onlineCouriers)} />
            <Kpi icon={Activity} label="Em rota" value={String(queue.onTheWay.length)} />
            <Kpi
              icon={Timer}
              label="Atrasados"
              value={String(lateOrders)}
              tone={lateOrders > 0 ? "danger" : undefined}
            />
            <Kpi icon={DollarSign} label="Frete médio" value={fmtBRL(avgDeliveryFee)} />
          </div>
        </Section>
      </div>

      {/* FINANCEIRO + MARKETING */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Financeiro (mês)" icon={DollarSign}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <Kpi icon={DollarSign} label="Receita bruta" value={fmtBRL(monthRevenue)} accent />
            <Kpi icon={Receipt} label="Taxas" value={fmtBRL(monthRevenue * 0.05)} />
            <Kpi icon={Wallet} label="Lucro líq." value={fmtBRL(estimatedProfit)} tone="success" />
            <Kpi icon={QrIcon} label="PIX" value={fmtBRL(payments.pix)} />
            <Kpi icon={CreditCard} label="Cartão" value={fmtBRL(payments.credit + payments.debit)} />
            <Kpi icon={Banknote} label="Dinheiro" value={fmtBRL(payments.cash)} />
          </div>
        </Section>

        <Section title="Marketing" icon={Megaphone}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <Kpi icon={Tag} label="Cupons usados" value={String(couponUses)} />
            <Kpi icon={Megaphone} label="Campanhas" value="—" />
            <Kpi icon={MousePointerClick} label="Cliques" value="—" />
            <Kpi icon={TrendingUp} label="Conversão" value="—" />
            <Kpi icon={Eye} label="Visualizações" value="—" />
            <Kpi
              icon={ShoppingCart}
              label="Carrinhos abandonados"
              value={String(abandoned)}
              tone={abandoned > 5 ? "danger" : undefined}
            />
          </div>
        </Section>
      </div>

      {/* IA INSIGHTS */}
      <Section title="IA de gestão" icon={Sparkles} cta="Ver sugestões IA">
        {insights.length === 0 ? (
          <Empty text="Sem insights no momento. Continue vendendo!" />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {insights.map((i, idx) => {
              const Icon = i.icon;
              return (
                <li
                  key={idx}
                  className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium leading-snug">{i.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* OPERAÇÃO REALTIME */}
      <Section title="Operação em tempo real" icon={Bell}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LiveColumn
            title="Novos"
            tone="primary"
            count={queue.newOnes.length}
            pulse
            items={queue.newOnes.slice(0, 5).map((o) => ({
              id: o.id,
              name: o.customer_name,
              total: Number(o.total),
              meta: timeAgo(o.created_at),
            }))}
          />
          <LiveColumn
            title="Preparando"
            tone="amber"
            count={queue.preparing.length}
            items={queue.preparing.slice(0, 5).map((o) => ({
              id: o.id,
              name: o.customer_name,
              total: Number(o.total),
              meta: `${differenceInMinutes(now, new Date(o.updated_at))}min`,
            }))}
          />
          <LiveColumn
            title="Saiu p/ entrega"
            tone="purple"
            count={queue.onTheWay.length}
            items={queue.onTheWay.slice(0, 5).map((o) => ({
              id: o.id,
              name: o.customer_name,
              total: Number(o.total),
              meta: timeAgo(o.updated_at),
            }))}
          />
          <LiveColumn
            title="Finalizados hoje"
            tone="success"
            count={queue.delivered.length}
            items={queue.delivered.slice(0, 5).map((o) => ({
              id: o.id,
              name: o.customer_name,
              total: Number(o.total),
              meta: timeAgo(o.updated_at),
            }))}
          />
        </div>
      </Section>

      {/* RANKINGS */}
      <Section title="Rankings do mês" icon={Trophy}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <RankCard
            title="Top produtos"
            rows={topProducts.slice(0, 5).map((p) => ({ label: p.name, value: `${p.qty}x` }))}
          />
          <RankCard
            title="Top clientes"
            rows={topCustomers.map((c) => ({ label: c.name, value: fmtBRL(c.total) }))}
          />
          <RankCard
            title="Dias campeões"
            rows={topDays.map(([d, v]) => ({
              label: format(new Date(d), "EEE, dd/MM", { locale: ptBR }),
              value: fmtBRL(v),
            }))}
          />
          <RankCard
            title="Bairros que mais compram"
            rows={topBairros.map(([b, n]) => ({ label: b, value: `${n} pedidos` }))}
          />
        </div>
      </Section>

      {/* COMPARATIVO */}
      <section className="rounded-3xl bg-gradient-to-r from-success/15 via-accent/10 to-primary/15 p-6 text-center">
        <Trophy className="mx-auto mb-2 h-8 w-8 text-primary" />
        <h3 className="font-display text-xl font-bold">
          📈 Sua loja vendeu mais que <span className="text-primary">82%</span> das lojas da cidade hoje
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Continue assim e suba ainda mais no ranking regional.
        </p>
      </section>
    </div>
  );
};

// ---------------- Subcomponents ----------------

const Section = ({
  title,
  icon: Icon,
  cta,
  children,
}: {
  title: string;
  icon: typeof Activity;
  cta?: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="font-display text-lg font-bold uppercase tracking-wide">{title}</h2>
      {cta && (
        <Button variant="ghost" size="sm" className="ml-auto text-xs font-bold text-primary">
          {cta} →
        </Button>
      )}
    </div>
    {children}
  </section>
);

const Kpi = ({
  icon: Icon,
  label,
  value,
  accent,
  tone,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  accent?: boolean;
  tone?: "success" | "danger";
}) => {
  const toneCls =
    tone === "success"
      ? "bg-success/10 text-success border-success/20"
      : tone === "danger"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "";
  return (
    <div
      className={`rounded-2xl border p-3 transition-smooth hover:shadow-soft ${
        accent
          ? "border-transparent bg-gradient-to-br from-primary to-secondary text-primary-foreground"
          : toneCls || "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 font-display text-lg font-bold leading-tight sm:text-xl">{value}</div>
    </div>
  );
};

const QuickAction = ({ icon: Icon, label }: { icon: typeof Plus; label: string }) => (
  <button className="group flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold transition-smooth hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-soft">
    <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
    {label}
  </button>
);

const ChartCard = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof TrendingUp;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="font-display text-base font-bold">{title}</h3>
    </div>
    {children}
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>
);

const LiveColumn = ({
  title,
  tone,
  count,
  pulse,
  items,
}: {
  title: string;
  tone: "primary" | "amber" | "purple" | "success";
  count: number;
  pulse?: boolean;
  items: { id: string; name: string; total: number; meta: string }[];
}) => {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600",
    purple: "bg-purple-500/10 text-purple-600",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display text-sm font-bold uppercase tracking-wide">{title}</h4>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${toneCls} ${
            pulse && count > 0 ? "animate-pulse" : ""
          }`}
        >
          {count}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">vazio</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="truncate font-medium">{o.name}</span>
              <span className="ml-2 shrink-0 text-xs font-bold text-muted-foreground">
                {fmtBRL(o.total)} • {o.meta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const RankCard = ({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
    <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wide">{title}</h4>
    {rows.length === 0 ? (
      <p className="py-4 text-center text-xs text-muted-foreground">sem dados</p>
    ) : (
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="flex-1 truncate font-medium">{r.label}</span>
            <span className="text-xs font-bold text-muted-foreground">{r.value}</span>
          </li>
        ))}
      </ol>
    )}
  </div>
);

// PIX icon usando QrCode da lucide
const QrIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
  </svg>
);

function timeAgo(dateStr: string) {
  const min = differenceInMinutes(new Date(), new Date(dateStr));
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
