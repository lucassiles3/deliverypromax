import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Clock, Loader2, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type State = {
  state: "trial" | "active" | "expired" | "none";
  active: boolean;
  status?: string;
  plan_slug?: string;
  plan_name?: string;
  plan_price?: number;
  trial_days_left?: number;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  gateway_subscription_id?: string | null;
};

type PaywallProps = {
  storeId: string;
  onActive: () => void;
};

export const SubscriptionPaywall = ({ storeId, onActive }: PaywallProps) => {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [cpf, setCpf] = useState("");
  const [needsCpf, setNeedsCpf] = useState(false);
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

  // Quando ativar, libera
  useEffect(() => {
    if (state?.active && state.state === "active") onActive();
  }, [state, onActive]);

  const startSubscription = async () => {
    setCreating(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      if (needsCpf && cleanCpf.length < 11) {
        toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
        return;
      }
      const payload: any = { store_id: storeId };
      if (needsCpf && cleanCpf) payload.cpfCnpj = cleanCpf;

      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-create`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

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
      if (p?.encodedImage) {
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

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isTrial = state.state === "trial";
  const trialLeft = state.trial_days_left ?? 0;

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-glow">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-bold">
            {isTrial ? "Você está no período grátis 🎉" : "Seu período grátis acabou"}
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
              {creating ? "Gerando cobrança..." : isTrial ? "Assinar PRO agora" : "Assinar PRO para continuar"}
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
