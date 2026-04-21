import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Download, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const KIND_LABEL: Record<string, string> = {
  cmv: "CMV", operational: "Operacional", marketing: "Marketing",
  payroll: "Folha", rent: "Aluguel", utilities: "Utilidades", tax: "Impostos", other: "Outros",
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const DRESection = ({ storeId, storeName }: { storeId: string; storeName: string }) => {
  const [monthsBack, setMonthsBack] = useState(0); // 0 = mês atual
  const ref = useMemo(() => subMonths(new Date(), monthsBack), [monthsBack]);
  const from = useMemo(() => ymd(startOfMonth(ref)), [ref]);
  const to = useMemo(() => ymd(endOfMonth(ref)), [ref]);
  const prevFrom = useMemo(() => ymd(startOfMonth(subMonths(ref, 1))), [ref]);
  const prevTo = useMemo(() => ymd(endOfMonth(subMonths(ref, 1))), [ref]);

  const { data: cur, isLoading } = useQuery({
    queryKey: ["dre", storeId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dre_report" as any, { _store_id: storeId, _from: from, _to: to });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: prev } = useQuery({
    queryKey: ["dre", storeId, prevFrom, prevTo],
    queryFn: async () => {
      const { data } = await supabase.rpc("dre_report" as any, { _store_id: storeId, _from: prevFrom, _to: prevTo });
      return data as any;
    },
  });

  const exportPDF = () => {
    if (!cur) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`DRE — ${storeName}`, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Período: ${format(ref, "MMMM 'de' yyyy", { locale: ptBR })}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [["Linha", "Valor"]],
      body: [
        ["Receita bruta", brl(cur.gross_revenue)],
        ["(–) Cupons / descontos", `- ${brl(cur.deductions.coupons)}`],
        ["= Receita líquida", brl(cur.net_revenue)],
        ["(–) CMV", `- ${brl(cur.cmv)}`],
        ["= Lucro bruto", brl(cur.gross_profit)],
        [`Margem bruta`, `${cur.gross_margin_percent}%`],
        ["(–) Taxas gateway", `- ${brl(cur.gateway_fees)}`],
        ["(–) Taxa marketplace", `- ${brl(cur.marketplace_fee)}`],
        ["(–) Despesas operacionais", `- ${brl(cur.expenses_total)}`],
        ["= EBITDA", brl(cur.ebitda)],
        ["= Lucro líquido", brl(cur.net_profit)],
        ["Margem líquida", `${cur.net_margin_percent}%`],
      ],
      theme: "grid",
      headStyles: { fillColor: [220, 38, 38] },
    });
    doc.save(`dre-${storeName}-${from}.pdf`);
  };

  if (isLoading || !cur) {
    return <div className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">Carregando DRE…</div>;
  }

  const lines: { label: string; value: number; prev?: number; bold?: boolean; muted?: boolean; negative?: boolean }[] = [
    { label: "Receita bruta", value: cur.gross_revenue, prev: prev?.gross_revenue },
    { label: "(–) Cupons / descontos concedidos", value: -cur.deductions.coupons, prev: prev ? -prev.deductions.coupons : undefined, muted: true, negative: true },
    { label: "= Receita líquida", value: cur.net_revenue, prev: prev?.net_revenue, bold: true },
    { label: "(–) CMV — Custo dos produtos vendidos", value: -cur.cmv, prev: prev ? -prev.cmv : undefined, negative: true },
    { label: `= Lucro bruto (${cur.gross_margin_percent}%)`, value: cur.gross_profit, prev: prev?.gross_profit, bold: true },
    { label: "(–) Taxas de gateway de pagamento", value: -cur.gateway_fees, prev: prev ? -prev.gateway_fees : undefined, negative: true },
    { label: "(–) Taxa marketplace", value: -cur.marketplace_fee, prev: prev ? -prev.marketplace_fee : undefined, negative: true },
    { label: "(–) Despesas operacionais", value: -cur.expenses_total, prev: prev ? -prev.expenses_total : undefined, negative: true },
    { label: "= EBITDA", value: cur.ebitda, prev: prev?.ebitda, bold: true },
    { label: `= Lucro líquido (${cur.net_margin_percent}%)`, value: cur.net_profit, prev: prev?.net_profit, bold: true },
  ];

  const expensesByKind = Object.entries((cur.expenses_by_kind ?? {}) as Record<string, number>);
  const maxExp = Math.max(1, ...expensesByKind.map(([, v]) => v));

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">DRE — Demonstrativo de Resultado</h2>
        <div className="ml-auto flex items-center gap-2">
          <select value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))} className="rounded-xl border-2 px-3 py-1.5 text-sm font-semibold">
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>{format(subMonths(new Date(), i), "MMM/yyyy", { locale: ptBR })}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={exportPDF}><Download className="mr-1 h-4 w-4" /> PDF</Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <KPI label="Receita líquida" value={cur.net_revenue} prev={prev?.net_revenue} />
        <KPI label="Lucro bruto" value={cur.gross_profit} prev={prev?.gross_profit} percent={cur.gross_margin_percent} />
        <KPI label="Lucro líquido" value={cur.net_profit} prev={prev?.net_profit} percent={cur.net_margin_percent} highlight />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Linha</th>
              <th className="py-2 text-right">Atual</th>
              <th className="py-2 text-right">Período anterior</th>
              <th className="py-2 text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const delta = l.prev !== undefined ? l.value - l.prev : null;
              const deltaPct = l.prev !== undefined && l.prev !== 0 ? ((l.value - l.prev) / Math.abs(l.prev)) * 100 : null;
              return (
                <tr key={l.label} className={`border-b ${l.bold ? "bg-muted/40" : ""}`}>
                  <td className={`py-2.5 ${l.bold ? "font-display font-bold" : ""} ${l.muted ? "text-muted-foreground" : ""}`}>{l.label}</td>
                  <td className={`py-2.5 text-right tabular-nums ${l.bold ? "font-bold text-primary" : ""} ${l.negative ? "text-destructive" : ""}`}>{brl(l.value)}</td>
                  <td className="py-2.5 text-right text-muted-foreground tabular-nums">{l.prev !== undefined ? brl(l.prev) : "—"}</td>
                  <td className="py-2.5 text-right text-xs">
                    {delta !== null && deltaPct !== null ? (
                      <span className={`inline-flex items-center gap-1 ${delta >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(deltaPct).toFixed(1)}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {expensesByKind.length > 0 && (
        <div className="rounded-xl bg-muted/30 p-4">
          <div className="mb-3 font-bold">Despesas por categoria</div>
          <ul className="space-y-2">
            {expensesByKind.sort((a, b) => b[1] - a[1]).map(([kind, val]) => (
              <li key={kind}>
                <div className="flex justify-between text-xs">
                  <span className="font-bold">{KIND_LABEL[kind] ?? kind}</span>
                  <span>{brl(val)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-background overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(val / maxExp) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const KPI = ({ label, value, prev, percent, highlight }: { label: string; value: number; prev?: number; percent?: number; highlight?: boolean }) => {
  const delta = prev !== undefined && prev !== 0 ? ((value - prev) / Math.abs(prev)) * 100 : null;
  return (
    <div className={`rounded-2xl p-4 ${highlight ? "gradient-primary text-primary-foreground" : "bg-muted/40"}`}>
      <div className={`text-xs ${highlight ? "opacity-90" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{brl(value)}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {percent !== undefined && <span className={highlight ? "opacity-90" : "text-muted-foreground"}>margem {percent}%</span>}
        {delta !== null && (
          <span className={`inline-flex items-center gap-1 ${highlight ? "" : delta >= 0 ? "text-green-600" : "text-destructive"}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}% vs anterior
          </span>
        )}
      </div>
    </div>
  );
};
