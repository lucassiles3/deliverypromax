import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DollarSign,
  Percent,
  Wallet,
  CheckCircle2,
  Search,
  Download,
  FileText,
  Calendar as CalendarIcon,
  RefreshCw,
  FileSignature,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentFilter = "all" | "pix" | "credit" | "debit" | "cash";
type StatusFilter = "all" | "paid" | "pending" | "cancelled";

const fmt = (n: number) =>
  `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const fmtDT = (d: string | Date) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Map order status -> financial status
const finStatus = (s: string): "paid" | "pending" | "cancelled" => {
  if (s === "delivered") return "paid";
  if (s === "cancelled") return "cancelled";
  return "pending";
};

const payoutStatusLabel: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Agendado", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  processing: { label: "Processando", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  paid: { label: "Depositado", cls: "bg-green-500/10 text-green-600 border-green-500/30" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const FinancialTab = ({ storeId, storeName }: { storeId: string; storeName: string }) => {
  const qc = useQueryClient();
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const { data: store } = useQuery({
    queryKey: ["store-fee", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("marketplace_fee_percent")
        .eq("id", storeId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const feePct = Number(store?.marketplace_fee_percent ?? 10);

  const { data: orders = [] } = useQuery({
    queryKey: ["fin-orders", storeId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, payment_method, created_at, customer_name")
        .eq("store_id", storeId)
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payouts = [], refetch: refetchPayouts } = useQuery({
    queryKey: ["payouts", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("store_id", storeId)
        .order("period_end", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const paid = orders.filter((o) => o.status === "delivered");
    const gross = paid.reduce((s, o) => s + Number(o.total), 0);
    const fee = +(gross * feePct / 100).toFixed(2);
    const net = +(gross - fee).toFixed(2);
    const transferred = payouts
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + Number(p.net_amount), 0);
    const toReceive = net - transferred;
    return { gross, fee, net: Math.max(0, toReceive), transferred };
  }, [orders, payouts, feePct]);

  const filteredTx = useMemo(() => {
    return orders.filter((o) => {
      if (paymentFilter !== "all" && o.payment_method !== paymentFilter) return false;
      if (statusFilter !== "all" && finStatus(o.status) !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!o.id.toLowerCase().includes(q) && !(o.customer_name ?? "").toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [orders, paymentFilter, statusFilter, search]);

  const handleGeneratePayouts = async () => {
    const { data, error } = await supabase.rpc("generate_weekly_payouts", { _store_id: storeId });
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} repasse(s) gerado(s)/atualizado(s)`);
    qc.invalidateQueries({ queryKey: ["payouts", storeId] });
  };

  const markPayoutPaid = async (id: string) => {
    const { error } = await supabase
      .from("payouts")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Repasse marcado como depositado");
    refetchPayouts();
  };

  const exportCSV = () => {
    const header = ["data_hora", "pedido", "cliente", "pagamento", "status", "bruto", "taxa_pct", "liquido"];
    const rows = filteredTx.map((o) => {
      const bruto = Number(o.total);
      const taxa = +(bruto * feePct / 100).toFixed(2);
      const liq = +(bruto - taxa).toFixed(2);
      return [
        new Date(o.created_at).toISOString(),
        `#${o.id.slice(0, 8)}`,
        (o.customer_name ?? "").replace(/[,;\n]/g, " "),
        o.payment_method,
        finStatus(o.status),
        bruto.toFixed(2),
        feePct.toFixed(2),
        liq.toFixed(2),
      ];
    });
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato_${storeName.replace(/\s+/g, "_")}_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = (title: string, lines: string[]) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:40px;color:#111}
        h1{margin:0 0 4px;font-size:22px}
        .sub{color:#666;margin-bottom:24px;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #eee}
        th{background:#fafafa;font-size:11px;text-transform:uppercase;color:#666}
        .total{margin-top:24px;font-weight:700;font-size:14px}
        .foot{margin-top:40px;font-size:11px;color:#888}
      </style></head><body>
      <h1>${title}</h1>
      <div class="sub">${storeName} • Emitido em ${new Date().toLocaleString("pt-BR")}</div>
      ${lines.join("")}
      <div class="foot">Documento gerado pelo FoodFlash. Não substitui Nota Fiscal Eletrônica oficial.</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Permita pop-ups para gerar o PDF");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const exportMonthlyPDF = () => {
    const rowsHtml = filteredTx
      .map((o) => {
        const bruto = Number(o.total);
        const taxa = +(bruto * feePct / 100).toFixed(2);
        const liq = +(bruto - taxa).toFixed(2);
        return `<tr><td>${fmtDT(o.created_at)}</td><td>#${o.id.slice(0, 8)}</td><td>${o.customer_name ?? ""}</td><td>${o.payment_method}</td><td>${finStatus(o.status)}</td><td>${fmt(bruto)}</td><td>${feePct.toFixed(1)}%</td><td>${fmt(liq)}</td></tr>`;
      })
      .join("");
    const totGross = filteredTx.reduce((s, o) => s + Number(o.total), 0);
    const totFee = +(totGross * feePct / 100).toFixed(2);
    exportPDF(`Extrato ${from} a ${to}`, [
      `<table><thead><tr><th>Data</th><th>Pedido</th><th>Cliente</th><th>Pagto</th><th>Status</th><th>Bruto</th><th>Taxa</th><th>Líquido</th></tr></thead><tbody>${rowsHtml}</tbody></table>`,
      `<div class="total">Total bruto: ${fmt(totGross)} • Taxa marketplace: ${fmt(totFee)} • Líquido: ${fmt(totGross - totFee)}</div>`,
    ]);
  };

  const exportPayoutReceipt = (p: any) => {
    exportPDF(`Comprovante de repasse #${p.id.slice(0, 8)}`, [
      `<table><tbody>
        <tr><th>Período</th><td>${fmtDate(p.period_start)} a ${fmtDate(p.period_end)}</td></tr>
        <tr><th>Pedidos inclusos</th><td>${p.orders_count}</td></tr>
        <tr><th>Bruto</th><td>${fmt(Number(p.gross_amount))}</td></tr>
        <tr><th>Taxa marketplace</th><td>${fmt(Number(p.fee_amount))} (${feePct}%)</td></tr>
        <tr><th>Líquido depositado</th><td><strong>${fmt(Number(p.net_amount))}</strong></td></tr>
        <tr><th>Status</th><td>${payoutStatusLabel[p.status]?.label ?? p.status}</td></tr>
        <tr><th>Data prevista</th><td>${fmtDate(p.scheduled_for)}</td></tr>
        ${p.paid_at ? `<tr><th>Depositado em</th><td>${fmtDT(p.paid_at)}</td></tr>` : ""}
      </tbody></table>`,
    ]);
  };

  const exportInvoice = (o: any) => {
    const bruto = Number(o.total);
    const taxa = +(bruto * feePct / 100).toFixed(2);
    exportPDF(`Recibo do pedido #${o.id.slice(0, 8)}`, [
      `<table><tbody>
        <tr><th>Cliente</th><td>${o.customer_name ?? ""}</td></tr>
        <tr><th>Data</th><td>${fmtDT(o.created_at)}</td></tr>
        <tr><th>Forma de pagamento</th><td>${o.payment_method}</td></tr>
        <tr><th>Valor bruto</th><td>${fmt(bruto)}</td></tr>
        <tr><th>Taxa marketplace</th><td>${fmt(taxa)} (${feePct}%)</td></tr>
        <tr><th>Líquido para a loja</th><td><strong>${fmt(bruto - taxa)}</strong></td></tr>
      </tbody></table>`,
    ]);
  };

  const exportRevenueDeclaration = () => {
    const totGross = orders
      .filter((o) => o.status === "delivered")
      .reduce((s, o) => s + Number(o.total), 0);
    exportPDF(`Declaração de Faturamento`, [
      `<p>Declaramos para os devidos fins que o estabelecimento <strong>${storeName}</strong> apurou, no período de ${fmtDate(from)} a ${fmtDate(to)}, o faturamento bruto total de <strong>${fmt(totGross)}</strong>, considerando exclusivamente os pedidos efetivamente entregues através da plataforma FoodFlash.</p>
       <p>Quantidade de pedidos entregues: <strong>${orders.filter((o) => o.status === "delivered").length}</strong></p>
       <p>Taxa de marketplace praticada no período: <strong>${feePct}%</strong></p>`,
    ]);
  };

  return (
    <div className="space-y-6">
      {/* 4.1 KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FinKpi icon={DollarSign} label="Bruto no período" value={fmt(kpis.gross)} tone="primary" />
        <FinKpi icon={Percent} label="Taxas marketplace" value={fmt(kpis.fee)} tone="amber" hint={`${feePct}%`} />
        <FinKpi icon={Wallet} label="Líquido a receber" value={fmt(kpis.net)} tone="blue" />
        <FinKpi icon={CheckCircle2} label="Já repassado" value={fmt(kpis.transferred)} tone="green" />
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border-2 px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border-2 px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportMonthlyPDF}>
            <FileText className="mr-1 h-4 w-4" /> Extrato PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportRevenueDeclaration}>
            <FileSignature className="mr-1 h-4 w-4" /> Declaração
          </Button>
        </div>
      </div>

      {/* 4.2 Transactions */}
      <section className="rounded-2xl border bg-card overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b p-4">
          <h2 className="font-display text-lg font-bold">Extrato de transações</h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">{filteredTx.length}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Buscar pedido…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 rounded-xl border-2 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
              className="rounded-xl border-2 px-2 py-1.5 text-sm font-semibold outline-none focus:border-primary"
            >
              <option value="all">Todos pagamentos</option>
              <option value="pix">Pix</option>
              <option value="credit">Crédito</option>
              <option value="debit">Débito</option>
              <option value="cash">Dinheiro</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-xl border-2 px-2 py-1.5 text-sm font-semibold outline-none focus:border-primary"
            >
              <option value="all">Todos status</option>
              <option value="paid">Pagos</option>
              <option value="pending">Pendentes</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Data/hora</th>
                <th className="px-4 py-2.5 text-left">Pedido</th>
                <th className="px-4 py-2.5 text-left">Pagamento</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Bruto</th>
                <th className="px-4 py-2.5 text-right">Taxa</th>
                <th className="px-4 py-2.5 text-right">Líquido</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma transação no período.
                  </td>
                </tr>
              )}
              {filteredTx.map((o) => {
                const bruto = Number(o.total);
                const taxa = +(bruto * feePct / 100).toFixed(2);
                const st = finStatus(o.status);
                return (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDT(o.created_at)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">#{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5 capitalize">{o.payment_method}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          st === "paid"
                            ? "bg-green-500/10 text-green-600"
                            : st === "cancelled"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {st === "paid" ? "Pago" : st === "cancelled" ? "Cancelado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmt(bruto)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {fmt(taxa)}
                      <span className="ml-1 text-[10px]">({feePct}%)</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary">{fmt(bruto - taxa)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => exportInvoice(o)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Emitir recibo (NF-e stub)"
                      >
                        <ScrollText className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4.3 Payouts */}
      <section className="rounded-2xl border bg-card overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b p-4">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Calendário de repasses</h2>
          <span className="text-xs text-muted-foreground">Agrupados por semana de pedidos entregues</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={handleGeneratePayouts}>
            <RefreshCw className="mr-1 h-4 w-4" /> Gerar repasses
          </Button>
        </header>

        {payouts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum repasse ainda. Pedidos entregues de semanas passadas serão agrupados em repasses semanais.
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {payouts.map((p) => {
              const cfg = payoutStatusLabel[p.status];
              return (
                <div key={p.id} className="rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {fmtDate(p.period_start)} → {fmtDate(p.period_end)}
                      </div>
                      <div className="mt-1 font-display text-2xl font-bold text-primary">
                        {fmt(Number(p.net_amount))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.orders_count} pedido(s) • bruto {fmt(Number(p.gross_amount))}
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${cfg?.cls}`}>
                      {cfg?.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {p.status === "paid" && p.paid_at
                      ? `Depositado em ${fmtDT(p.paid_at)}`
                      : `Previsto: ${fmtDate(p.scheduled_for)}`}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {p.status !== "paid" && (
                      <Button size="sm" variant="default" onClick={() => markPayoutPaid(p.id)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar pago
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => exportPayoutReceipt(p)}>
                      <Download className="mr-1 h-4 w-4" /> Comprovante
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4.4 Documents */}
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-bold">Documentos</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <DocCard
            icon={FileText}
            title="Extrato mensal (PDF)"
            desc="Resumo completo do período selecionado"
            onClick={exportMonthlyPDF}
          />
          <DocCard
            icon={Download}
            title="Extrato mensal (CSV/Excel)"
            desc="Para sua contabilidade"
            onClick={exportCSV}
          />
          <DocCard
            icon={FileSignature}
            title="Declaração de faturamento"
            desc="Por período"
            onClick={exportRevenueDeclaration}
          />
          <DocCard
            icon={ScrollText}
            title="NF-e por pedido"
            desc="Emita recibos diretamente da tabela acima"
          />
          <DocCard
            icon={FileText}
            title="Contrato com o marketplace"
            desc="Termo padrão FoodFlash"
            onClick={() =>
              exportPDF("Contrato de credenciamento — FoodFlash", [
                `<p>Pelo presente instrumento, <strong>${storeName}</strong> ("Estabelecimento") credencia-se à plataforma FoodFlash para intermediação de pedidos.</p>
                 <p><strong>1.</strong> A plataforma cobrará taxa de <strong>${feePct}%</strong> sobre o valor bruto de cada pedido entregue.</p>
                 <p><strong>2.</strong> Os repasses ocorrerão semanalmente, em até 2 dias úteis após o encerramento do período.</p>
                 <p><strong>3.</strong> O Estabelecimento é o único responsável pela emissão das notas fiscais aos consumidores finais.</p>
                 <p><strong>4.</strong> Este contrato pode ser rescindido por qualquer das partes mediante aviso prévio de 30 dias.</p>`,
              ])
            }
          />
          <DocCard
            icon={Percent}
            title={`Política de taxas (${feePct}%)`}
            desc="Taxa vigente do marketplace"
            onClick={() =>
              exportPDF("Política de Taxas — FoodFlash", [
                `<p>A taxa de marketplace vigente para <strong>${storeName}</strong> é de <strong>${feePct}%</strong> sobre o valor bruto de cada pedido entregue.</p>
                 <p>A taxa é debitada automaticamente no momento da composição de cada repasse semanal.</p>
                 <p>Alterações de taxa são comunicadas com 30 dias de antecedência.</p>`,
              ])
            }
          />
        </div>
      </section>
    </div>
  );
};

const FinKpi = ({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "amber" | "blue" | "green";
}) => {
  const toneCls = {
    primary: "from-primary/10 to-primary/5 text-primary",
    amber: "from-amber-500/10 to-amber-500/5 text-amber-600",
    blue: "from-blue-500/10 to-blue-500/5 text-blue-600",
    green: "from-green-500/10 to-green-500/5 text-green-600",
  }[tone];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${toneCls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
        {hint && <span className="ml-auto rounded-full bg-current/10 px-1.5 py-0.5 text-[10px]">{hint}</span>}
      </div>
      <div className="mt-2 font-display text-2xl font-bold leading-tight text-foreground">{value}</div>
    </div>
  );
};

const DocCard = ({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  desc: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className="group flex items-start gap-3 rounded-xl border bg-background p-3 text-left transition-smooth hover:border-primary hover:shadow-soft disabled:cursor-default disabled:opacity-70"
  >
    <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex-1">
      <div className="text-sm font-bold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
    {onClick && <Download className="h-4 w-4 text-muted-foreground" />}
  </button>
);
