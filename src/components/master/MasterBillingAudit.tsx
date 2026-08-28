import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

type Run = {
  id: string; job_name: string; status: string;
  started_at: string; finished_at: string | null; duration_ms: number | null;
  processed: number | null; succeeded: number | null; failed: number | null;
  error_message: string | null; summary: any;
};

type Invoice = {
  id: string; store_id: string; period_start: string; period_end: string;
  billing_model: string; orders_count: number; gross_sales: number;
  total_amount: number; status: string; due_date: string | null;
  asaas_payment_id: string | null; invoice_url: string | null;
  stores: { name: string } | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const statusColor: Record<string, string> = {
  running: "bg-blue-500/15 text-blue-700",
  success: "bg-success/15 text-success",
  partial: "bg-warning/15 text-warning",
  error: "bg-destructive/15 text-destructive",
};

const invColor: Record<string, string> = {
  open: "bg-primary/15 text-primary",
  pending: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  overdue: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export default function MasterBillingAudit() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: i }] = await Promise.all([
      supabase.from("billing_job_runs").select("*").order("started_at", { ascending: false }).limit(100),
      supabase.from("monthly_invoices")
        .select("id,store_id,period_start,period_end,billing_model,orders_count,gross_sales,total_amount,status,due_date,asaas_payment_id,invoice_url,stores(name)")
        .order("period_start", { ascending: false }).limit(200),
    ]);
    setRuns((r as Run[]) || []);
    setInvoices((i as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Auditoria de cobrança</h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Execuções dos jobs (últimas 100)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3 w-8"></th>
                  <th className="text-left p-3">Job</th>
                  <th className="text-left p-3">Início</th>
                  <th className="text-left p-3">Duração</th>
                  <th className="text-right p-3">Proc / OK / Falha</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const open = expanded === r.id;
                  return (
                    <>
                      <tr key={r.id} className="border-b hover:bg-muted/30 cursor-pointer"
                          onClick={() => setExpanded(open ? null : r.id)}>
                        <td className="p-3">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                        <td className="p-3 font-mono text-xs">{r.job_name}</td>
                        <td className="p-3 text-muted-foreground">{new Date(r.started_at).toLocaleString("pt-BR")}</td>
                        <td className="p-3 text-muted-foreground">{r.duration_ms != null ? `${(r.duration_ms/1000).toFixed(2)}s` : "—"}</td>
                        <td className="p-3 text-right font-mono text-xs">
                          {r.processed ?? 0} / <span className="text-success">{r.succeeded ?? 0}</span> / <span className="text-destructive">{r.failed ?? 0}</span>
                        </td>
                        <td className="p-3"><Badge className={statusColor[r.status] || ""}>{r.status}</Badge></td>
                      </tr>
                      {open && (
                        <tr key={r.id + "-d"} className="bg-muted/20">
                          <td colSpan={6} className="p-4">
                            {r.error_message && (
                              <div className="mb-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                                <strong>Erro:</strong> {r.error_message}
                              </div>
                            )}
                            <pre className="text-[11px] bg-background border border-border rounded-lg p-3 overflow-x-auto max-h-96">
{JSON.stringify(r.summary, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {runs.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma execução registrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Todas as faturas mensais</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3">Loja</th>
                <th className="text-left p-3">Período</th>
                <th className="text-left p-3">Modelo</th>
                <th className="text-right p-3">Pedidos</th>
                <th className="text-right p-3">Vendas</th>
                <th className="text-right p-3">Total</th>
                <th className="text-left p-3">Venc.</th>
                <th className="text-left p-3">ID Asaas</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{i.stores?.name || "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(i.period_start).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {i.billing_model === "commission" ? "Comissão" : "Por pedido"}
                  </td>
                  <td className="p-3 text-right">{i.orders_count}</td>
                  <td className="p-3 text-right text-muted-foreground">{fmt(Number(i.gross_sales))}</td>
                  <td className="p-3 text-right font-bold">{fmt(Number(i.total_amount))}</td>
                  <td className="p-3 text-muted-foreground">{i.due_date ? new Date(i.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-3">
                    {i.invoice_url ? (
                      <a href={i.invoice_url} target="_blank" rel="noreferrer"
                         className="font-mono text-xs text-primary hover:underline">
                        {i.asaas_payment_id ?? "abrir"}
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{i.asaas_payment_id ?? "—"}</span>
                    )}
                  </td>
                  <td className="p-3"><Badge className={invColor[i.status] || ""}>{i.status}</Badge></td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhuma fatura gerada.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
