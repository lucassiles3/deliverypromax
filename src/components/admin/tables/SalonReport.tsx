import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Calendar, TrendingUp, Users, Clock, Trophy, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

type Range = "today" | "7d" | "30d";

export const SalonReport = ({ storeId }: { storeId: string }) => {
  const [range, setRange] = useState<Range>("today");

  const since = useMemo(() => {
    const d = new Date();
    if (range === "today") d.setHours(0, 0, 0, 0);
    else if (range === "7d") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, [range]);

  const { data: sessions = [] } = useQuery({
    queryKey: ["report-sessions", storeId, range],
    queryFn: async () => {
      const { data } = await supabase
        .from("table_sessions")
        .select("id, table_id, status, subtotal, total, people, opened_at, closed_at")
        .eq("store_id", storeId)
        .gte("opened_at", since)
        .eq("status", "closed");
      return data ?? [];
    },
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["report-tables", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tables")
        .select("id, number, sector_id")
        .eq("store_id", storeId);
      return data ?? [];
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["report-sectors", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("sectors").select("id, name, color").eq("store_id", storeId);
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["report-payments", storeId, range],
    queryFn: async () => {
      const { data } = await supabase
        .from("table_payments")
        .select("method, amount, created_at")
        .eq("store_id", storeId)
        .gte("created_at", since);
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const totalRev = sessions.reduce((s: number, x: any) => s + Number(x.total || 0), 0);
    const totalPeople = sessions.reduce((s: number, x: any) => s + Number(x.people || 0), 0);
    const avgTicket = sessions.length ? totalRev / sessions.length : 0;
    const avgPerPerson = totalPeople ? totalRev / totalPeople : 0;
    const durations = sessions
      .filter((s: any) => s.closed_at)
      .map((s: any) => (new Date(s.closed_at).getTime() - new Date(s.opened_at).getTime()) / 60000);
    const avgDuration = durations.length ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : 0;
    const turnover = tables.length ? sessions.length / tables.length : 0;
    return { totalRev, sessions: sessions.length, avgTicket, avgPerPerson, avgDuration, turnover, people: totalPeople };
  }, [sessions, tables]);

  const bySector = useMemo(() => {
    const tableSec = new Map(tables.map((t: any) => [t.id, t.sector_id]));
    const secName = new Map(sectors.map((s: any) => [s.id, s.name]));
    const map = new Map<string, number>();
    sessions.forEach((s: any) => {
      const sid = tableSec.get(s.table_id);
      const name = sid ? (secName.get(sid as string) as string) || "Sem setor" : "Sem setor";
      map.set(name, (map.get(name) || 0) + Number(s.total || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [sessions, tables, sectors]);

  const byHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}h`, total: 0, count: 0 }));
    sessions.forEach((s: any) => {
      const h = new Date(s.opened_at).getHours();
      buckets[h].total += Number(s.total || 0);
      buckets[h].count += 1;
    });
    // mostrar só de 8h às 23h pra ficar limpo
    return buckets.slice(8, 24);
  }, [sessions]);

  const byMethod = useMemo(() => {
    const labels: Record<string, string> = { cash: "Dinheiro", pix: "PIX", credit: "Crédito", debit: "Débito", voucher: "Vale" };
    const map = new Map<string, number>();
    payments.forEach((p: any) => {
      const k = labels[p.method] || p.method;
      map.set(k, (map.get(k) || 0) + Number(p.amount || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [payments]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {[
          { id: "today" as Range, label: "Hoje" },
          { id: "7d" as Range, label: "7 dias" },
          { id: "30d" as Range, label: "30 dias" },
        ].map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition-smooth ${
              range === r.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={TrendingUp} label="Faturamento" value={brl(kpis.totalRev)} />
        <Kpi icon={BarChart3} label="Comandas" value={String(kpis.sessions)} />
        <Kpi icon={Trophy} label="Ticket médio" value={brl(kpis.avgTicket)} />
        <Kpi icon={Users} label="Por pessoa" value={brl(kpis.avgPerPerson)} />
        <Kpi icon={Clock} label="Tempo médio" value={`${Math.round(kpis.avgDuration)} min`} />
        <Kpi icon={Users} label="Pessoas atendidas" value={String(kpis.people)} />
        <Kpi icon={BarChart3} label="Giro de mesa" value={kpis.turnover.toFixed(2)} />
        <Kpi icon={TrendingUp} label="Mesas" value={String(tables.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Faturamento por hora">
          {byHour.some((b) => b.total > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  formatter={(v: any) => brl(Number(v))}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Por setor">
          {bySector.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={bySector} dataKey="value" nameKey="name" outerRadius={90} label={(e) => brl(e.value)}>
                  {bySector.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Por forma de pagamento">
          {byMethod.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byMethod} dataKey="value" nameKey="name" outerRadius={90} label={(e) => brl(e.value)}>
                  {byMethod.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Picos de movimento">
          {byHour.some((b) => b.count > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="count" name="Comandas" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </Card>
      </div>
    </div>
  );
};

const Kpi = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="rounded-2xl border bg-card p-4">
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-1 font-display text-2xl font-bold leading-none">{value}</div>
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border bg-card p-4">
    <h3 className="mb-3 font-display text-sm font-bold">{title}</h3>
    {children}
  </div>
);

const Empty = () => (
  <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
    Sem dados no período
  </div>
);
