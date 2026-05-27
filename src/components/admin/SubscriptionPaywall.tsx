import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Clock, Loader2, Copy, RefreshCw, CreditCard, QrCode, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type State = {
  state: "trial" | "active" | "cancelled_active" | "expired" | "none";
  active: boolean;
  status?: string;
  plan_slug?: string;
  plan_name?: string;
  plan_price?: number;
  trial_days_left?: number;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancelled_at?: string | null;
  gateway_subscription_id?: string | null;
};

type PaywallProps = {
  storeId: string;
  onActive: () => void;
};

type BillingType = "PIX" | "CREDIT_CARD";
type BillingModel = "fixed_plus_per_order" | "commission";

export const SubscriptionPaywall = ({ storeId, onActive }: PaywallProps) => {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cpf, setCpf] = useState("");
  const [needsCpf, setNeedsCpf] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [billingModel, setBillingModel] = useState<BillingModel | null>(null);
  const [pix, setPix] = useState<{ encodedImage: string; payload: string; invoiceUrl?: string } | null>(null);

  const { data: state, refetch } = useQuery({
    queryKey: ["subscription-state", storeId],
    queryFn: async (): Promise<State> => {
      const { data, error } = await supabase.rpc("store_subscription_state", { _store_id: storeId });
      if (error) throw error;
      return data as unknown as State;
    },
    refetchInterval: 15000,
  });

  const [wasActive] = useState<boolean>(() => state?.active === true);
  useEffect(() => {
    if (!wasActive && state?.active && (pix || billingModel === "commission")) onActive();
  }, [state, onActive, pix, wasActive, billingModel]);

  const callFn = async (fn: string, body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  };

  const startSubscription = async () => {
    if (!billingModel) {
      toast.error("Escolha um modelo de cobrança");
      return;
    }
    setCreating(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      if (needsCpf && cleanCpf.length < 11) {
        toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
        return;
      }
      const payload: any = { store_id: storeId, billing_type: billingType, billing_model: billingModel };
      if (needsCpf && cleanCpf) payload.cpfCnpj = cleanCpf;

      const { res, json } = await callFn("subscription-create", payload);

      if (!res.ok) {
        throw new Error(json?.error || `Erro ${res.status}`);
      }
      if (json?.data?.need_cpf_cnpj) {
        setNeedsCpf(true);
        toast.info("Informe seu CPF ou CNPJ para gerar a cobrança.");
        return;
      }

      if (billingModel === "commission") {
        toast.success("Plano Comissão ativado! Sua fatura mensal será gerada automaticamente.");
        qc.invalidateQueries({ queryKey: ["subscription-state", storeId] });
        onActive();
        return;
      }

      const p = json?.data?.pix;
      const invoiceUrl = json?.data?.invoice_url;
      if (billingType === "CREDIT_CARD") {
        if (invoiceUrl) {
          window.open(invoiceUrl, "_blank");
          toast.success("Abra a fatura para cadastrar seu cartão.");
        }
      } else if (p?.encodedImage) {
        setPix({ encodedImage: p.encodedImage, payload: p.payload, invoiceUrl });
      } else if (invoiceUrl) {
        window.open(invoiceUrl, "_blank");
      }
      qc.invalidateQueries({ queryKey: ["subscription-state", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível iniciar a assinatura");
    } finally {
      setCreating(false);
    }
  };

  const cancelSubscription = async () => {
    if (!confirm("Cancelar assinatura?")) return;
    setCancelling(true);
    try {
      const { res, json } = await callFn("subscription-cancel", { store_id: storeId });
      if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
      toast.success("Assinatura cancelada.");
      qc.invalidateQueries({ queryKey: ["subscription-state", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível cancelar");
    } finally {
      setCancelling(false);
    }
  };

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isTrial = state.state === "trial";
  const isActive = state.state === "active";
  const isCancelledActive = state.state === "cancelled_active";
  const trialLeft = state.trial_days_left ?? 0;
  const endsAt = state.current_period_end ? new Date(state.current_period_end) : null;

  if ((isActive || isCancelledActive) && !pix && !billingModel) {
    return (
      <div className="min-h-screen bg-muted/40 px-4 py-10">
        <div className="container mx-auto max-w-2xl">
          <div className="rounded-3xl bg-card p-6 shadow-float">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {state.plan_name || "Plano PRO"}
                </p>
                <h1 className="font-display text-2xl font-bold">
                  {isCancelledActive ? "Assinatura cancelada" : "Assinatura ativa"}
                </h1>
              </div>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              {isCancelledActive
                ? `Acesso liberado até ${endsAt?.toLocaleDateString("pt-BR") ?? "o fim do período"}.`
                : `Próxima renovação em ${endsAt?.toLocaleDateString("pt-BR") ?? "—"}.`}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={onActive} className="flex-1" size="lg">Voltar para o painel</Button>
              {isActive && (
                <Button variant="outline" size="lg" onClick={cancelSubscription} disabled={cancelling}
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10">
                  <XCircle className="mr-2 h-4 w-4" />
                  {cancelling ? "Cancelando..." : "Cancelar assinatura"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela 1: escolha do modelo
  if (!billingModel && !pix) {
    return (
      <div className="min-h-screen bg-muted/40 px-4 py-10">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-glow">
              <Sparkles className="h-7 w-7" />
            </div>
            <h1 className="font-display text-3xl font-bold">
              {isTrial ? "Escolha seu plano PRO 🎉" : "Escolha seu plano PRO"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isTrial
                ? `Você tem ${trialLeft} dia${trialLeft === 1 ? "" : "s"} grátis. Escolha o modelo ideal para sua loja.`
                : "Selecione o modelo de cobrança mais vantajoso para o seu momento."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Modelo A */}
            <div className="rounded-3xl bg-card p-6 shadow-float border-2 border-primary/20">
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Modelo 1 — Recomendado</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Fixo + Pedido</h2>
                <p className="text-xs text-muted-foreground">Ideal para lojas com alto volume</p>
              </div>
              <div className="mb-4">
                <p className="text-3xl font-bold">
                  R$ 150<span className="text-base font-medium text-muted-foreground">/mês</span>
                </p>
                <p className="text-sm text-muted-foreground">+ R$ 1,00 por pedido entregue</p>
              </div>
              <ul className="mb-4 space-y-2 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Mensalidade fixa de R$ 150</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Apenas R$ 1,00 por pedido entregue</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Sem comissão sobre as vendas</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Custo previsível e melhor margem</li>
              </ul>
              <div className="mb-4 rounded-xl bg-muted/40 p-3 text-xs">
                <p className="font-semibold">Exemplo (100 pedidos/mês):</p>
                <p className="text-muted-foreground">R$ 150 + R$ 100 = <strong className="text-foreground">R$ 250 total</strong></p>
              </div>
              <Button onClick={() => setBillingModel("fixed_plus_per_order")} size="lg" className="w-full">
                Escolher este plano
              </Button>
            </div>

            {/* Modelo B */}
            <div className="rounded-3xl bg-card p-6 shadow-float border-2 border-border">
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">Modelo 2 — Começando</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Comissão</h2>
                <p className="text-xs text-muted-foreground">Ideal para lojas iniciantes</p>
              </div>
              <div className="mb-4">
                <p className="text-3xl font-bold">
                  10%<span className="text-base font-medium text-muted-foreground"> por pedido</span>
                </p>
                <p className="text-sm text-muted-foreground">+ R$ 1,00 por pedido entregue • Sem mensalidade</p>
              </div>
              <ul className="mb-4 space-y-2 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Sem mensalidade — entrada sem custo</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> 10% sobre cada pedido entregue</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> + R$ 1,00 por pedido entregue</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Fatura mensal automática</li>
              </ul>
              <div className="mb-4 rounded-xl bg-muted/40 p-3 text-xs">
                <p className="font-semibold">Exemplo (100 pedidos, R$ 5.000):</p>
                <p className="text-muted-foreground">10% (R$ 500) + R$ 100 = <strong className="text-foreground">R$ 600 total</strong></p>
              </div>
              <Button onClick={() => setBillingModel("commission")} size="lg" variant="outline" className="w-full">
                Escolher este plano
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Em ambos os modelos, a taxa de serviço cobrada do cliente pertence ao itChat.<br />
            Após o vencimento da fatura, há 5 dias de tolerância antes da loja ser pausada.
          </p>

          {isTrial && (
            <div className="mt-4 text-center">
              <button onClick={onActive} className="text-xs font-semibold text-muted-foreground underline hover:text-foreground">
                Continuar usando o período grátis
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tela 2: confirmação / pagamento
  const isCommission = billingModel === "commission";
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="container mx-auto max-w-2xl">
        <button
          onClick={() => { setBillingModel(null); setPix(null); setNeedsCpf(false); }}
          className="mb-4 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar e trocar de plano
        </button>

        <div className="rounded-3xl bg-card p-6 shadow-float">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isCommission ? "Plano PRO Comissão" : "Plano PRO Fixo + Pedido"}
            </p>
            <p className="mt-1 text-3xl font-bold">
              {isCommission
                ? <>10%<span className="text-base font-medium text-muted-foreground"> por pedido</span></>
                : <>R$ 150<span className="text-base font-medium text-muted-foreground">/mês + R$1/pedido</span></>}
            </p>
          </div>

          {!isCommission && !pix && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setBillingType("PIX")}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${billingType === "PIX" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>
                  <QrCode className="h-4 w-4" /> PIX (mensal)
                </button>
                <button type="button" onClick={() => setBillingType("CREDIT_CARD")}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${billingType === "CREDIT_CARD" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>
                  <CreditCard className="h-4 w-4" /> Cartão (automático)
                </button>
              </div>
            </div>
          )}

          {isCommission && !pix && (
            <div className="mb-4 rounded-xl bg-muted/40 p-4 text-sm">
              <p className="font-semibold">Como funciona a cobrança:</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• Você não paga nada agora</li>
                <li>• No dia 1 de cada mês geramos a fatura do mês anterior</li>
                <li>• A fatura tem vencimento em 5 dias após o fim do mês</li>
                <li>• Após o vencimento, há 5 dias de tolerância antes do bloqueio</li>
              </ul>
            </div>
          )}

          {needsCpf && !pix && (
            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CPF ou CNPJ</label>
              <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Apenas números"
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
            </div>
          )}

          {pix ? (
            <div className="space-y-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
              <p className="text-sm font-semibold">Escaneie o QR Code para pagar via PIX</p>
              <img src={`data:image/png;base64,${pix.encodedImage}`} alt="QR Code PIX"
                className="mx-auto h-56 w-56 rounded-lg bg-white p-2" />
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">PIX copia e cola</p>
                <div className="flex items-center gap-2 rounded-lg bg-background p-2">
                  <code className="flex-1 truncate text-xs">{pix.payload}</code>
                  <Button size="sm" variant="ghost"
                    onClick={() => { navigator.clipboard.writeText(pix.payload); toast.success("Copiado"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {pix.invoiceUrl && (
                <a href={pix.invoiceUrl} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-primary underline">
                  Abrir fatura completa
                </a>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Já paguei, atualizar
              </Button>
            </div>
          ) : (
            <Button onClick={startSubscription}
              disabled={creating || (needsCpf && cpf.replace(/\D/g, "").length < 11)}
              size="lg"
              className="h-12 w-full rounded-xl bg-accent text-accent-foreground font-bold shadow-glow hover:bg-accent/90">
              {creating
                ? "Processando..."
                : isCommission
                  ? "Ativar plano Comissão"
                  : billingType === "CREDIT_CARD"
                    ? "Assinar com cartão"
                    : "Assinar via PIX"}
            </Button>
          )}

          {isTrial && (
            <div className="mt-4 text-center">
              <Clock className="mr-1 inline h-3 w-3" />
              <span className="text-xs text-muted-foreground">{trialLeft} dia(s) de trial restantes</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
