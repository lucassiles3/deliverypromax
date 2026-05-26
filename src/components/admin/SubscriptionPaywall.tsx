import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Clock, Loader2, Copy, RefreshCw, CreditCard, QrCode, XCircle } from "lucide-react";
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

export const SubscriptionPaywall = ({ storeId, onActive }: PaywallProps) => {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cpf, setCpf] = useState("");
  const [needsCpf, setNeedsCpf] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
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

  useEffect(() => {
    if (state?.active && (state.state === "active" || state.state === "cancelled_active")) {
      // Não auto-libera; permite ver tela de gestão. Mas se for renovação após pagar PIX, libera.
      if (!pix) onActive();
    }
  }, [state, onActive, pix]);

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
    setCreating(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      if (needsCpf && cleanCpf.length < 11) {
        toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
        return;
      }
      const payload: any = { store_id: storeId, billing_type: billingType };
      if (needsCpf && cleanCpf) payload.cpfCnpj = cleanCpf;

      const { res, json } = await callFn("subscription-create", payload);

      if (!res.ok) {
        if (json?.code === "need_cpf_cnpj" || /cpfcnpj/i.test(json?.error ?? "")) {
          setNeedsCpf(true);
          toast.info("Informe seu CPF ou CNPJ para gerar a cobrança.");
          return;
        }
        throw new Error(json?.error || `Erro ${res.status}`);
      }

      const p = json?.data?.pix;
      const invoiceUrl = json?.data?.invoice_url;
      if (billingType === "CREDIT_CARD") {
        if (invoiceUrl) {
          window.open(invoiceUrl, "_blank");
          toast.success("Abra a fatura para cadastrar seu cartão. As próximas cobranças serão automáticas.");
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
    if (!confirm("Cancelar assinatura? Você continua usando até o fim do período já pago.")) return;
    setCancelling(true);
    try {
      const { res, json } = await callFn("subscription-cancel", { store_id: storeId });
      if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
      toast.success("Assinatura cancelada. Você pode usar até a data de expiração.");
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

  // Tela de gestão para assinaturas ativas
  if ((isActive || isCancelledActive) && !pix) {
    return (
      <div className="min-h-screen bg-muted/40 px-4 py-10">
        <div className="container mx-auto max-w-2xl">
          <div className="rounded-3xl bg-card p-6 shadow-float">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plano PRO</p>
                <h1 className="font-display text-2xl font-bold">
                  {isCancelledActive ? "Assinatura cancelada" : "Assinatura ativa"}
                </h1>
              </div>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              {isCancelledActive
                ? `Você cancelou a assinatura. O acesso permanece liberado até ${endsAt?.toLocaleDateString("pt-BR") ?? "o fim do período"}.`
                : `Próxima renovação em ${endsAt?.toLocaleDateString("pt-BR") ?? "—"}.`}
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={onActive} className="flex-1" size="lg">
                Voltar para o painel
              </Button>
              {isActive && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={cancelSubscription}
                  disabled={cancelling}
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
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

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-glow">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-bold">
            {isTrial ? "Você está no período grátis 🎉" : "Seu período acabou"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isTrial
              ? `Faltam ${trialLeft} dia${trialLeft === 1 ? "" : "s"} de uso gratuito. Assine PRO para não perder o acesso quando acabar.`
              : "Assine o plano PRO para continuar usando seu painel e receber pedidos."}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-float">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plano PRO</p>
              <p className="mt-1 text-3xl font-bold">
                R$ 150<span className="text-base font-medium text-muted-foreground">/mês</span>
              </p>
            </div>
            {isTrial && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                <Clock className="h-3 w-3" /> {trialLeft}d grátis
              </span>
            )}
          </div>

          <ul className="mb-6 space-y-2 text-sm">
            {["Pedidos ilimitados", "Cardápio, PDV e mesas", "Marketing e fidelidade", "Suporte prioritário"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {!pix && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillingType("PIX")}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                    billingType === "PIX" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  PIX (mensal)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingType("CREDIT_CARD")}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                    billingType === "CREDIT_CARD" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Cartão (automático)
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {billingType === "PIX"
                  ? "Você paga via PIX a cada mês. Avisaremos quando vencer."
                  : "Cobrança automática no cartão todo mês. Cancele quando quiser."}
              </p>
            </div>
          )}

          {needsCpf && !pix && (
            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CPF ou CNPJ</label>
              <input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="Apenas números"
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          {pix ? (
            <div className="space-y-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
              <p className="text-sm font-semibold">Escaneie o QR Code para pagar via PIX</p>
              <img
                src={`data:image/png;base64,${pix.encodedImage}`}
                alt="QR Code PIX"
                className="mx-auto h-56 w-56 rounded-lg bg-white p-2"
              />
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">PIX copia e cola</p>
                <div className="flex items-center gap-2 rounded-lg bg-background p-2">
                  <code className="flex-1 truncate text-xs">{pix.payload}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(pix.payload);
                      toast.success("Código copiado");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {pix.invoiceUrl && (
                <a
                  href={pix.invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs font-semibold text-primary underline"
                >
                  Abrir fatura completa
                </a>
              )}
              <p className="text-xs text-muted-foreground">
                Assim que pagar, sua loja é liberada automaticamente.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Já paguei, atualizar
              </Button>
            </div>
          ) : (
            <Button
              onClick={startSubscription}
              disabled={creating || (needsCpf && cpf.replace(/\D/g, "").length < 11)}
              size="lg"
              className="h-12 w-full rounded-xl bg-accent text-accent-foreground font-bold shadow-glow hover:bg-accent/90"
            >
              {creating
                ? "Gerando cobrança..."
                : billingType === "CREDIT_CARD"
                  ? "Assinar com cartão"
                  : isTrial
                    ? "Assinar PRO via PIX"
                    : "Assinar PRO para continuar"}
            </Button>
          )}
        </div>

        {isTrial && !pix && (
          <div className="mt-4 text-center">
            <button
              onClick={onActive}
              className="text-xs font-semibold text-muted-foreground underline hover:text-foreground"
            >
              Continuar usando o período grátis
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
