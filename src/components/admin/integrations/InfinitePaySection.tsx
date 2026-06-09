import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Save, ChevronDown, ChevronUp, CheckCircle2, Copy, Zap, Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  storeId: string;
}

const WEBHOOK_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/infinitepay-webhook`;

export const InfinitePaySection = ({ storeId }: Props) => {
  const [handle, setHandle] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [initial, setInitial] = useState({ handle: "", redirect: "", webhook: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTest, setShowTest] = useState(false);
  type TestItem = { description: string; quantity: number; price: number };
  const [testItems, setTestItems] = useState<TestItem[]>([
    { description: "Pedido de teste", quantity: 1, price: 10 },
  ]);
  const [testCustomerName, setTestCustomerName] = useState("Cliente Teste");
  const [testCustomerEmail, setTestCustomerEmail] = useState("teste@exemplo.com");

  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("stores")
      .select("infinitepay_handle, infinitepay_redirect_url, infinitepay_webhook_url")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        const d: any = data || {};
        const h = d.infinitepay_handle ?? "";
        const r = d.infinitepay_redirect_url ?? "";
        const w = d.infinitepay_webhook_url ?? WEBHOOK_BASE;
        setHandle(h);
        setRedirectUrl(r);
        setWebhookUrl(w);
        setInitial({ handle: h, redirect: r, webhook: w });
        setLoading(false);
      });
  }, [storeId]);

  const save = async () => {
    setSaving(true);
    const clean = handle.trim().replace(/^\$/, "");
    const { error } = await supabase
      .from("stores")
      .update({
        infinitepay_handle: clean || null,
        infinitepay_redirect_url: redirectUrl.trim() || null,
        infinitepay_webhook_url: webhookUrl.trim() || null,
      } as any)
      .eq("id", storeId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setInitial({ handle: clean, redirect: redirectUrl.trim(), webhook: webhookUrl.trim() });
    setHandle(clean);
    toast.success("Configurações salvas!");
  };

  const testLink = async () => {
    if (!handle.trim()) {
      toast.error("Configure e salve sua InfiniteTag antes de testar.");
      return;
    }
    if (handle.trim() !== initial.handle) {
      toast.error("Salve as alterações antes de testar.");
      return;
    }
    const items = testItems
      .map((i) => ({
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
        price: Math.round(Number(i.price || 0) * 100), // reais → centavos
        description: (i.description || "Item").trim(),
      }))
      .filter((i) => i.price > 0);
    if (items.length === 0) {
      toast.error("Adicione ao menos um item com valor maior que zero.");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("infinitepay-create-link", {
        body: {
          store_id: storeId,
          order_nsu: `test-${Date.now()}`,
          items,
          customer: { name: testCustomerName || "Cliente Teste", email: testCustomerEmail || undefined },
        },
      });
      if (error) throw error;
      if ((data as any)?.url) {
        window.open((data as any).url, "_blank", "noopener");
        toast.success("Link gerado com sucesso!");
      } else {
        toast.error((data as any)?.error || "Falha ao gerar link de teste");
      }
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally {
      setTesting(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<TestItem>) =>
    setTestItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () =>
    setTestItems((arr) => [...arr, { description: "Item " + (arr.length + 1), quantity: 1, price: 10 }]);
  const removeItem = (idx: number) =>
    setTestItems((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));
  const testTotal = testItems.reduce(
    (s, i) => s + (Number(i.price) || 0) * Math.max(1, Math.floor(Number(i.quantity) || 1)),
    0,
  );

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(WEBHOOK_BASE);
    toast.success("URL do webhook copiada!");
  };

  const dirty =
    handle.trim().replace(/^\$/, "") !== initial.handle ||
    redirectUrl.trim() !== initial.redirect ||
    webhookUrl.trim() !== initial.webhook;
  const configured = !!initial.handle;

  return (
    <section className="rounded-2xl bg-card p-5 shadow-soft">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">InfinitePay — Crédito com link</h3>
            <p className="text-xs text-muted-foreground">
              Gera um link de pagamento automaticamente para cada pedido pago no crédito.
            </p>
          </div>
        </div>
        {configured && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Ativa
          </span>
        )}
      </header>

      {!loading && (
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Sua InfiniteTag (handle)</Label>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex flex-1 items-center overflow-hidden rounded-md border bg-background">
                <span className="px-2 text-sm text-muted-foreground">$</span>
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/^\$/, ""))}
                  placeholder="seu_usuario_infinitepay"
                  className="border-0 focus-visible:ring-0"
                  maxLength={60}
                />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Use seu nome de usuário do app InfinitePay, sem o símbolo <code className="rounded bg-muted px-1">$</code>.
            </p>
          </div>

          <div>
            <Label className="text-sm">URL de redirecionamento (após pagamento)</Label>
            <Input
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://sualoja.com/obrigado"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Para onde o cliente é levado depois do pagamento aprovado. Deixe em branco para usar o padrão da InfinitePay.
            </p>
          </div>

          <div>
            <Label className="text-sm">URL do webhook (notificações de pagamento)</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={WEBHOOK_BASE}
              />
              <Button type="button" variant="outline" onClick={copyWebhook} title="Copiar URL padrão">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              A InfinitePay chamará esta URL quando o pagamento for aprovado, atualizando seu pedido em tempo real.
              Recomendado deixar o padrão acima.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={save} disabled={!dirty || saving} className="flex-1 min-w-[120px]">
              <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowTest((v) => !v)}
              disabled={!configured || dirty}
              className="flex-1 min-w-[160px]"
              title={dirty ? "Salve antes de testar" : "Configurar e gerar link de teste"}
            >
              <Zap className="mr-1 h-4 w-4" />
              {showTest ? "Fechar teste" : "Testar checkout"}
            </Button>
          </div>

          {showTest && (
            <div className="space-y-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">🧪 Configurar pedido de teste</p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  Total: R$ {testTotal.toFixed(2).replace(".", ",")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nome do cliente</Label>
                  <Input value={testCustomerName} onChange={(e) => setTestCustomerName(e.target.value)} className="mt-1 h-9" />
                </div>
                <div>
                  <Label className="text-xs">E-mail (opcional)</Label>
                  <Input value={testCustomerEmail} onChange={(e) => setTestCustomerEmail(e.target.value)} className="mt-1 h-9" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Itens</Label>
                {testItems.map((it, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2 rounded-md border bg-background p-2">
                    <div className="flex-1 min-w-[140px]">
                      <Label className="text-[10px] text-muted-foreground">Descrição</Label>
                      <Input
                        value={it.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        className="h-8 mt-0.5"
                      />
                    </div>
                    <div className="w-16">
                      <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                        className="h-8 mt-0.5"
                      />
                    </div>
                    <div className="w-24">
                      <Label className="text-[10px] text-muted-foreground">Preço (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={it.price}
                        onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                        className="h-8 mt-0.5"
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItem(idx)}
                      disabled={testItems.length === 1}
                      title="Remover item"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar item
                </Button>
              </div>

              <Button onClick={testLink} disabled={testing} className="w-full">
                {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />}
                Gerar link de teste e abrir
              </Button>
              <p className="text-[11px] text-muted-foreground">
                O link abre em uma nova aba. Use cartão de crédito real para validar todo o fluxo, incluindo a confirmação via webhook.
              </p>
            </div>
          )}

          <button
            onClick={() => setShowTutorial((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border bg-muted/50 px-3 py-2 text-left text-sm font-semibold transition hover:bg-muted"
          >
            <span>📖 Como funciona / Tutorial passo a passo</span>
            {showTutorial ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showTutorial && (
            <div className="space-y-3 rounded-lg border bg-background p-4 text-sm">
              <p className="font-semibold">Como integrar a InfinitePay à sua loja:</p>
              <ol className="ml-4 list-decimal space-y-2 text-muted-foreground">
                <li>
                  Baixe o app <strong>InfinitePay</strong> e crie sua conta como vendedor.
                </li>
                <li>
                  No app, vá em <strong>Perfil → InfiniteTag</strong> e copie seu nome de usuário.
                </li>
                <li>
                  Cole no campo acima (sem <code className="rounded bg-muted px-1">$</code>), defina sua URL de redirecionamento (opcional) e mantenha a URL de webhook padrão.
                </li>
                <li>
                  Clique em <strong>Salvar</strong>, depois em <strong>Testar link</strong> para validar a integração — um link de R$ 10,00 será aberto.
                </li>
                <li>
                  Em <strong>Configurações → Formas de pagamento</strong>, ative <em>"Cartão de crédito — link de pagamento"</em>.
                </li>
                <li>
                  Pronto! Cada pedido pago no crédito gera um link InfinitePay automaticamente, e o pedido é marcado como pago em tempo real pelo webhook.
                </li>
              </ol>

              <div className="rounded-md bg-primary/5 p-3 text-xs">
                <p className="font-bold text-primary">💡 Como o cliente paga:</p>
                <ul className="ml-4 mt-1 list-disc space-y-1 text-muted-foreground">
                  <li>Cartão de crédito (parcelamento conforme sua conta InfinitePay)</li>
                  <li>Pix (se ativado na sua conta InfinitePay)</li>
                  <li>Pagamento 100% online — sem trabalho manual</li>
                </ul>
              </div>

              <div className="rounded-md bg-amber-500/10 p-3 text-xs">
                <p className="font-bold text-amber-700">⚠ Importante:</p>
                <p className="mt-1 text-muted-foreground">
                  As taxas são cobradas pela InfinitePay diretamente na sua conta. Consulte as taxas e prazos no app oficial.
                </p>
              </div>

              <a
                href="https://www.infinitepay.io"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Abrir site da InfinitePay <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
