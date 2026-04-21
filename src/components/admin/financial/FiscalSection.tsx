import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileSignature, ScrollText, Loader2, CheckCircle2, AlertCircle, Download, Copy } from "lucide-react";
import { brl } from "@/lib/format";

const STATUS_LABEL: Record<string, { label: string; cls: string; Icon: any }> = {
  pending:    { label: "Pendente",  cls: "bg-amber-500/10 text-amber-600",  Icon: Loader2 },
  processing: { label: "Processando", cls: "bg-blue-500/10 text-blue-600",  Icon: Loader2 },
  authorized: { label: "Autorizada", cls: "bg-green-500/10 text-green-600", Icon: CheckCircle2 },
  rejected:   { label: "Rejeitada",  cls: "bg-destructive/10 text-destructive", Icon: AlertCircle },
  cancelled:  { label: "Cancelada",  cls: "bg-muted text-muted-foreground",  Icon: AlertCircle },
  error:      { label: "Erro",       cls: "bg-destructive/10 text-destructive", Icon: AlertCircle },
};

export const FiscalSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [showCfg, setShowCfg] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ["fiscal-cfg", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("store_fiscal_config").select("*").eq("store_id", storeId).maybeSingle();
      return data;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["fiscal-invoices", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_invoices")
        .select("*, orders(customer_name, customer_phone, created_at)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <FileSignature className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">NFC-e (notas fiscais)</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{invoices.length}</span>
        <div className="ml-auto flex items-center gap-2">
          {cfg?.enabled ? (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-600">
              Configurado · {cfg.provider} · {cfg.ambiente}
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600">
              Modo manual (sem provedor)
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowCfg(!showCfg)}>
            {showCfg ? "Fechar" : "Configurar"}
          </Button>
        </div>
      </header>

      {showCfg && <FiscalConfigForm storeId={storeId} cfg={cfg} onSaved={() => qc.invalidateQueries({ queryKey: ["fiscal-cfg", storeId] })} />}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Pedido</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Nº</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Nenhuma nota emitida ainda.</td></tr>
            )}
            {invoices.map((inv: any) => {
              const st = STATUS_LABEL[inv.status] ?? STATUS_LABEL.pending;
              return (
                <tr key={inv.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(inv.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs font-bold">#{inv.order_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{inv.customer_name ?? inv.orders?.customer_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{inv.numero ? `${inv.numero}/${inv.serie}` : "—"}</td>
                  <td className="px-3 py-2 text-right font-bold">{brl(Number(inv.total))}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>
                      <st.Icon className={`h-3 w-3 ${inv.status === "processing" ? "animate-spin" : ""}`} />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {inv.access_key && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(inv.access_key); toast.success("Chave copiada"); }}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Copiar chave de acesso"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Abrir DANFE">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const FiscalConfigForm = ({ storeId, cfg, onSaved }: { storeId: string; cfg: any; onSaved: () => void }) => {
  const [form, setForm] = useState({
    enabled: cfg?.enabled ?? false,
    provider: cfg?.provider ?? "manual",
    cnpj: cfg?.cnpj ?? "",
    ie: cfg?.ie ?? "",
    ie_isenta: cfg?.ie_isenta ?? false,
    regime_tributario: cfg?.regime_tributario ?? "simples_nacional",
    csc_id: cfg?.csc_id ?? "",
    csc_token_secret_name: cfg?.csc_token_secret_name ?? "",
    certificate_secret_name: cfg?.certificate_secret_name ?? "",
    ambiente: cfg?.ambiente ?? "homologacao",
    serie: cfg?.serie ?? 1,
    cfop_padrao: cfg?.cfop_padrao ?? "5102",
    ncm_padrao: cfg?.ncm_padrao ?? "",
    csosn_padrao: cfg?.csosn_padrao ?? "102",
  });

  const save = async () => {
    const { error } = await supabase.from("store_fiscal_config").upsert({ store_id: storeId, ...form });
    if (error) return toast.error(error.message);
    toast.success("Configuração fiscal salva");
    onSaved();
  };

  const set = (k: keyof typeof form, v: any) => setForm({ ...form, [k]: v });

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CNPJ"><input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} className="ip" /></Field>
        <Field label="Inscrição Estadual"><input value={form.ie} onChange={(e) => set("ie", e.target.value)} disabled={form.ie_isenta} className="ip disabled:opacity-50" /></Field>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.ie_isenta} onChange={(e) => set("ie_isenta", e.target.checked)} /> Isento de IE</label>
        <Field label="Regime tributário">
          <select value={form.regime_tributario} onChange={(e) => set("regime_tributario", e.target.value)} className="ip">
            <option value="simples_nacional">Simples Nacional</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="lucro_real">Lucro Real</option>
          </select>
        </Field>
        <Field label="Provedor">
          <select value={form.provider} onChange={(e) => set("provider", e.target.value)} className="ip">
            <option value="manual">Manual (sem integração)</option>
            <option value="focusnfe">Focus NFe</option>
            <option value="plugnotas">PlugNotas</option>
          </select>
        </Field>
        <Field label="Ambiente">
          <select value={form.ambiente} onChange={(e) => set("ambiente", e.target.value)} className="ip">
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </Field>
        <Field label="CSC ID"><input value={form.csc_id} onChange={(e) => set("csc_id", e.target.value)} className="ip" /></Field>
        <Field label="CSC Token (nome da secret)"><input value={form.csc_token_secret_name} onChange={(e) => set("csc_token_secret_name", e.target.value.toUpperCase())} className="ip font-mono" /></Field>
        <Field label="Certificado A1 (nome da secret)"><input value={form.certificate_secret_name} onChange={(e) => set("certificate_secret_name", e.target.value.toUpperCase())} className="ip font-mono" /></Field>
        <Field label="Série"><input type="number" value={form.serie} onChange={(e) => set("serie", Number(e.target.value))} className="ip" /></Field>
        <Field label="CFOP padrão"><input value={form.cfop_padrao} onChange={(e) => set("cfop_padrao", e.target.value)} className="ip" /></Field>
        <Field label="CSOSN padrão"><input value={form.csosn_padrao} onChange={(e) => set("csosn_padrao", e.target.value)} className="ip" /></Field>
        <Field label="NCM padrão"><input value={form.ncm_padrao} onChange={(e) => set("ncm_padrao", e.target.value)} className="ip" /></Field>
      </div>
      <label className="flex items-center gap-2 font-bold">
        <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        Habilitar emissão automática
      </label>
      <Button onClick={save} size="sm"><ScrollText className="mr-1 h-4 w-4" /> Salvar configuração fiscal</Button>
      <style>{`.ip{width:100%;border:2px solid hsl(var(--border));border-radius:0.75rem;padding:0.4rem 0.75rem;background:hsl(var(--background));font-size:0.875rem;outline:none}.ip:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
    {children}
  </div>
);
