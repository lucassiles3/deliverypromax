import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, TrendingUp, Users, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Period = "today" | "week" | "month" | "30d";

const periodConfig: Record<Period, { label: string; from: () => Date }> = {
  today: { label: "Hoje", from: () => startOfDay(new Date()) },
  week: { label: "Esta semana", from: () => startOfWeek(new Date(), { weekStartsOn: 1 }) },
  month: { label: "Este mês", from: () => startOfMonth(new Date()) },
  "30d": { label: "Últimos 30 dias", from: () => subDays(new Date(), 30) },
};

export const ReportsTab = ({ storeId, storeName }: { storeId: string; storeName: string }) => {
  const [period, setPeriod] = useState<Period>("week");

  const { data: orders = [] } = useQuery({
    queryKey: ["report-orders", storeId, period],
    enabled: !!storeId,
    queryFn: async () => {
      const from = periodConfig[period].from().toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total, subtotal, delivery_fee, status, method, created_at, customer_name, customer_phone, order_items(product_name, quantity, unit_price)"
        )
        .eq("store_id", storeId)
        .gte("created_at", from)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const count = orders.length;
    const avg = count ? revenue / count : 0;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    return { revenue, count, avg, delivered };
  }, [orders]);

  // Vendas por dia
  const dailySales = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      const key = format(new Date(o.created_at), "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + Number(o.total));
    });
    const entries = Array.from(map.entries()).sort();
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries.slice(-14).map(([date, value]) => ({
      date,
      value,
      pct: (value / max) * 100,
      label: format(new Date(date), "dd/MM"),
    }));
  }, [orders]);

  // Top produtos
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach((o) => {
      (o.order_items ?? []).forEach((it: any) => {
        const cur = map.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += it.quantity * Number(it.unit_price);
        map.set(it.product_name, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [orders]);

  // Clientes recorrentes
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; count: number; spent: number }>();
    orders.forEach((o) => {
      const cur = map.get(o.customer_phone) ?? {
        name: o.customer_name,
        phone: o.customer_phone,
        count: 0,
        spent: 0,
      };
      cur.count += 1;
      cur.spent += Number(o.total);
      map.set(o.customer_phone, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent).slice(0, 10);
  }, [orders]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const periodLabel = periodConfig[period].label;
    doc.setFontSize(18);
    doc.text(`Relatório de Vendas — ${storeName}`, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Período: ${periodLabel} • Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [["Métrica", "Valor"]],
      body: [
        ["Faturamento", `R$ ${stats.revenue.toFixed(2)}`],
        ["Pedidos", String(stats.count)],
        ["Ticket médio", `R$ ${stats.avg.toFixed(2)}`],
        ["Entregues", String(stats.delivered)],
      ],
      theme: "grid",
      headStyles: { fillColor: [220, 38, 38] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["#", "Produto", "Qtd", "Receita"]],
      body: topProducts.map((p, i) => [
        i + 1,
        p.name,
        p.qty,
        `R$ ${p.revenue.toFixed(2)}`,
      ]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38] },
      didDrawPage: (data) => {
        doc.setFontSize(13);
        doc.text("Top produtos", 14, data.settings.startY! - 3);
      },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["#", "Cliente", "Telefone", "Pedidos", "Gasto"]],
      body: topCustomers.map((c, i) => [
        i + 1,
        c.name,
        c.phone,
        c.count,
        `R$ ${c.spent.toFixed(2)}`,
      ]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38] },
      didDrawPage: (data) => {
        doc.setFontSize(13);
        doc.text("Top clientes", 14, data.settings.startY! - 3);
      },
    });

    doc.save(`relatorio-${storeName}-${period}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const summary = [
      ["Loja", storeName],
      ["Período", periodConfig[period].label],
      ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Faturamento", stats.revenue],
      ["Pedidos", stats.count],
      ["Ticket médio", stats.avg],
      ["Entregues", stats.delivered],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resumo");

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        orders.map((o) => ({
          Pedido: `#${o.id.slice(0, 6).toUpperCase()}`,
          Data: format(new Date(o.created_at), "dd/MM/yyyy HH:mm"),
          Cliente: o.customer_name,
          Telefone: o.customer_phone,
          Método: o.method === "delivery" ? "Entrega" : "Retirada",
          Status: o.status,
          Subtotal: Number(o.subtotal),
          Entrega: Number(o.delivery_fee),
          Total: Number(o.total),
        }))
      ),
      "Pedidos"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(topProducts.map((p, i) => ({ "#": i + 1, ...p }))),
      "Top produtos"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(topCustomers.map((c, i) => ({ "#": i + 1, ...c }))),
      "Top clientes"
    );

    XLSX.writeFile(wb, `relatorio-${storeName}-${period}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header com período + export */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(periodConfig) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-smooth ${
                period === p
                  ? "gradient-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/70"
              }`}
            >
              {periodConfig[p].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileText className="mr-1.5 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {/* KPIs do período */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Faturamento" value={`R$ ${stats.revenue.toFixed(2).replace(".", ",")}`} accent />
        <Card label="Pedidos" value={String(stats.count)} />
        <Card label="Ticket médio" value={`R$ ${stats.avg.toFixed(2).replace(".", ",")}`} />
        <Card label="Entregues" value={String(stats.delivered)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Gráfico vendas */}
        <section className="rounded-2xl bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-bold">Vendas por dia</h3>
          </div>
          {dailySales.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem vendas no período.
            </p>
          ) : (
            <div className="flex h-44 items-end gap-1.5">
              {dailySales.map((d) => (
                <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="relative w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md gradient-primary transition-smooth group-hover:opacity-80"
                      style={{ height: `${Math.max(4, d.pct)}%` }}
                      title={`${d.label}: R$ ${d.value.toFixed(2)}`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top produtos */}
        <section className="rounded-2xl bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-bold">Produtos mais vendidos</h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {topProducts.slice(0, 5).map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="font-display text-xl font-bold text-muted-foreground w-6">
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.qty} unidades • R$ {p.revenue.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top clientes */}
        <section className="rounded-2xl bg-card p-5 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-bold">Clientes recorrentes & VIP</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              ⭐ VIP = 5+ pedidos no período
            </span>
          </div>
          {topCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem clientes ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Cliente</th>
                    <th className="px-2 py-2 text-left">Telefone</th>
                    <th className="px-2 py-2 text-right">Pedidos</th>
                    <th className="px-2 py-2 text-right">Gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c) => (
                    <tr key={c.phone} className="border-t">
                      <td className="px-2 py-2.5">
                        <span className="font-semibold">{c.name}</span>
                        {c.count >= 5 && (
                          <span className="ml-2 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                            ⭐ VIP
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{c.phone}</td>
                      <td className="px-2 py-2.5 text-right font-bold">{c.count}</td>
                      <td className="px-2 py-2.5 text-right font-bold">
                        R$ {c.spent.toFixed(2).replace(".", ",")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Card = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div
    className={`rounded-2xl p-4 shadow-soft ${
      accent ? "gradient-primary text-primary-foreground" : "bg-card"
    }`}
  >
    <div className="text-xs font-medium opacity-90">{label}</div>
    <div className="mt-1 font-display text-2xl font-bold">{value}</div>
  </div>
);
