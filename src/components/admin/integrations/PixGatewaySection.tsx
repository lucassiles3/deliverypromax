import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, XCircle, Plus, ExternalLink, Trash2 } from "lucide-react";

const PROVIDERS = [
  { id: "mercadopago", label: "Mercado Pago", color: "text-sky-600", help: "Use seu Access Token de produção (APP_USR-...)." },
  { id: "asaas", label: "Asaas", color: "text-emerald-600", help: "API Key do painel Asaas. Suporta split nativo." },
] as const;

export const PixGatewaySection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState<"mercadopago" | "asaas" | null>(null);
  const [secretName, setSecretName] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitRecipient, setSplitRecipient] = useState("");
  const [feePct, setFeePct] = useState("10");
  const [sandbox, setSandbox] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: gateways = [] } = useQuery({
    queryKey: ["pay-gateways", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_gateways")
        .select("*")
        .eq("store_id", storeId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const webhookUrl = useMemo(
    () =>
      open
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-webhook?gateway=${open}&store=${storeId}`
        : "",
    [open, storeId],
  );

  const reset = () => {
    setOpen(null);
    setSecretName("");
    setSplitEnabled(false);
    setSplitRecipient("");
    setFeePct("10");
    setSandbox(true);
  };

  const save = async () => {
    if (!open) return;
    if (!secretName.trim().startsWith("MP_") && !secretName.trim().startsWith("ASAAS_")) {
      return toast.error("Use um nome de secret no padrão MP_TOKEN_<loja> ou ASAAS_TOKEN_<loja>");
    }
    setSaving(true);
    const { error } = await supabase
      .from("payment_gateways")
      .upsert(
        {
          store_id: storeId,
          provider: open,
          access_token_secret_name: secretName.trim(),
          split_enabled: splitEnabled,
          split_recipient_id: splitEnabled ? splitRecipient.trim() : null,
          marketplace_fee_percent: Number(feePct) || 0,
          sandbox,
          active: true,
          is_default: gateways.length === 0,
        },
        { onConflict: "store_id,provider" },
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Gateway conectado");
    qc.invalidateQueries({ queryKey: ["pay-gateways", storeId] });
    reset();
  };

  const setDefault = async (id: string, provider: string) => {
    await supabase.from("payment_gateways").update({ is_default: false }).eq("store_id", storeId);
    await supabase.from("payment_gateways").update({ is_default: true, active: true }).eq("id", id);
    toast.success(`${provider} definido como padrão`);
    qc.invalidateQueries({ queryKey: ["pay-gateways", storeId] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("payment_gateways").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["pay-gateways", storeId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este gateway? Os pedidos pendentes parar\u00e3o de receber confirma\u00e7\u00e3o.")) return;
    await supabase.from("payment_gateways").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["pay-gateways", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-bold">PIX automático</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte um gateway para receber confirmação automática de pagamentos PIX e ativar split de marketplace.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const cur = gateways.find((g: any) => g.provider === p.id);
            return (
              <div key={p.id} className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-bold ${p.color}`}>{p.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{p.help}</div>
                  </div>
                  {cur ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                {cur ? (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono">{cur.access_token_secret_name}</span>
                      {cur.is_default && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">padrão</span>
                      )}
                      {cur.split_enabled && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-600">
                          split {cur.marketplace_fee_percent}%
                        </span>
                      )}
                      {cur.sandbox && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-bold text-amber-600">sandbox</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {!cur.is_default && (
                        <Button size="sm" variant="outline" onClick={() => setDefault(cur.id, p.label)}>
                          Tornar padrão
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => toggleActive(cur.id, cur.active)}>
                        {cur.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(cur.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" className="mt-3" onClick={() => setOpen(p.id as any)}>
                    <Plus className="mr-1 h-3 w-3" /> Conectar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="rounded-2xl border-2 border-primary bg-card p-5">
          <h4 className="font-display text-lg font-bold">
            Conectar {PROVIDERS.find((p) => p.id === open)?.label}
          </h4>
          <ol className="mt-3 space-y-3 text-sm">
            <li>
              <div className="font-bold">1. Crie a secret no Lovable Cloud</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Use um nome único por loja, ex:{" "}
                <code className="rounded bg-muted px-1">
                  {open === "mercadopago" ? "MP_TOKEN_" : "ASAAS_TOKEN_"}
                  {storeId.slice(0, 6)}
                </code>
                .
                <br />
                Vá em <strong>Cloud → Secrets</strong>, adicione a secret com o token do gateway, e cole o nome aqui.
              </p>
              <input
                value={secretName}
                onChange={(e) => setSecretName(e.target.value.toUpperCase().replace(/\s/g, "_"))}
                placeholder={open === "mercadopago" ? "MP_TOKEN_MINHA_LOJA" : "ASAAS_TOKEN_MINHA_LOJA"}
                className="mt-2 w-full rounded-xl border-2 px-3 py-2 text-sm font-mono outline-none focus:border-primary"
              />
            </li>

            <li>
              <div className="font-bold">2. Webhook (cole no painel do gateway)</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-muted px-3 py-2 text-xs">{webhookUrl}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success("URL copiada");
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </li>

            <li>
              <div className="font-bold">3. Split marketplace (opcional)</div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={(e) => setSplitEnabled(e.target.checked)}
                />
                Ativar split automático
              </label>
              {splitEnabled && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    value={splitRecipient}
                    onChange={(e) => setSplitRecipient(e.target.value)}
                    placeholder={open === "asaas" ? "walletId Asaas" : "collector_id Mercado Pago"}
                    className="rounded-xl border-2 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={feePct}
                      onChange={(e) => setFeePct(e.target.value)}
                      className="w-24 rounded-xl border-2 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <span className="text-sm">% taxa marketplace</span>
                  </div>
                </div>
              )}
            </li>

            <li>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
                Ambiente <strong>sandbox</strong> (teste)
              </label>
            </li>
          </ol>

          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar conexão"}
            </Button>
            <Button variant="outline" onClick={reset}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
