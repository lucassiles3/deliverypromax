import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Store as StoreIcon,
  Users,
  AlertTriangle,
  CreditCard,
  MapPin,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

type Kpis = {
  revenue_today: number; revenue_week: number; revenue_month: number; revenue_year: number; revenue_total: number;
  orders_today: number; orders_total: number; orders_cancelled: number; orders_delivered: number;
  avg_ticket: number; by_payment: Record<string, number>;
  stores_total: number; stores_active: number; stores_trial: number; stores_overdue: number; stores_blocked: number;
  mrr: number; arr: number;
  users_total: number; users_new_month: number; stores_new_month: number; cities_active: number;
  revenue_series: { date: string; total: number }[];
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const Kpi = ({
  icon: Icon, label, value, hint, accent = "primary",
}: { icon: any; label: string; value: string; hint?: string; accent?: string }) => (
  <Card>
    <CardContent className="p-4 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </div>
      <div className={`h-10 w-10 rounded-lg bg-${accent}/10 flex items-center justify-center`}>
        <Icon className={`h-5 w-5 text-${accent}`} />
      </div>
    </CardContent>
  </Card>
);

export default function MasterDashboard() {
  const [k, setK] = useState<Kpis | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("master_dashboard_kpis");
      if (error) { setErr(error.message); return; }
      setK(data as Kpis);
    })();
  }, []);

  if (err) return <p className="text-destructive text-sm">Erro: {err}</p>;
  if (!k) return <p className="text-muted-foreground">Carregando KPIs...</p>;

  const paymentData = Object.entries(k.by_payment || {}).map(([method, total]) => ({
    method: method.toUpperCase(),
    total: Number(total),
  }));

  return (
    <div className="space-y-6">
      {/* Financeiro */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Financeiro</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={DollarSign} label="Faturamento Hoje" value={fmt(k.revenue_today)} hint={`${k.orders_today} pedidos hoje`} />
          <Kpi icon={DollarSign} label="Semana" value={fmt(k.revenue_week)} />
          <Kpi icon={DollarSign} label="Mês" value={fmt(k.revenue_month)} />
          <Kpi icon={DollarSign} label="Ano" value={fmt(k.revenue_year)} hint={`Total: ${fmt(k.revenue_total)}`} />
          <Kpi icon={TrendingUp} label="MRR" value={fmt(k.mrr)} hint="Receita mensal recorrente" />
          <Kpi icon={TrendingUp} label="ARR" value={fmt(k.arr)} />
          <Kpi icon={CreditCard} label="Ticket Médio" value={fmt(k.avg_ticket)} />
          <Kpi icon={ShoppingBag} label="Pedidos Entregues" value={String(k.orders_delivered)} hint={`${k.orders_cancelled} cancelados`} />
        </div>
      </section>

      {/* Lojas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assinaturas e Lojas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi icon={StoreIcon} label="Lojas Totais" value={String(k.stores_total)} />
          <Kpi icon={StoreIcon} label="Ativas" value={String(k.stores_active)} />
          <Kpi icon={StoreIcon} label="Em Trial" value={String(k.stores_trial)} />
          <Kpi icon={AlertTriangle} label="Inadimplentes" value={String(k.stores_overdue)} />
          <Kpi icon={AlertTriangle} label="Bloqueadas" value={String(k.stores_blocked)} />
        </div>
      </section>

      {/* Crescimento */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Crescimento</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Users} label="Usuários Totais" value={String(k.users_total)} hint={`+${k.users_new_month} este mês`} />
          <Kpi icon={StoreIcon} label="Novas Lojas (mês)" value={String(k.stores_new_month)} />
          <Kpi icon={MapPin} label="Cidades Ativas" value={String(k.cities_active)} />
          <Kpi icon={ShoppingBag} label="Pedidos Totais" value={String(k.orders_total)} />
        </div>
      </section>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Receita — últimos 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={k.revenue_series}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Transações por método</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={paymentData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="method" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
