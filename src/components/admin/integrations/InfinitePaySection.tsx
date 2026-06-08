import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Save, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  storeId: string;
}

export const InfinitePaySection = ({ storeId }: Props) => {
  const [handle, setHandle] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("stores")
      .select("infinitepay_handle")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        const h = (data as any)?.infinitepay_handle ?? "";
        setHandle(h);
        setInitial(h);
        setLoading(false);
      });
  }, [storeId]);

  const save = async () => {
    setSaving(true);
    const clean = handle.trim().replace(/^\$/, "");
    const { error } = await supabase
      .from("stores")
      .update({ infinitepay_handle: clean || null } as any)
      .eq("id", storeId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setInitial(clean);
    setHandle(clean);
    toast.success("InfiniteTag salva com sucesso!");
  };

  const dirty = handle.trim().replace(/^\$/, "") !== initial;
  const configured = !!initial;

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
              <Button onClick={save} disabled={!dirty || saving}>
                <Save className="mr-1 h-4 w-4" /> Salvar
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Use seu nome de usuário do app InfinitePay, sem o símbolo <code className="rounded bg-muted px-1">$</code>.
            </p>
          </div>

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
                  Baixe o aplicativo <strong>InfinitePay</strong> e crie sua conta como vendedor (se ainda não tiver).
                </li>
                <li>
                  No app, vá em <strong>Perfil → InfiniteTag</strong> e copie seu nome de usuário (ex.: <code className="rounded bg-muted px-1">lucassiles</code>).
                </li>
                <li>
                  Cole esse nome no campo acima (sem o <code className="rounded bg-muted px-1">$</code>) e clique em <strong>Salvar</strong>.
                </li>
                <li>
                  Em <strong>Configurações → Formas de pagamento</strong>, ative <em>"Cartão de crédito — link de pagamento"</em>.
                </li>
                <li>
                  Pronto! Quando um cliente finalizar o pedido e escolher pagar no crédito, o sistema gera automaticamente um link da InfinitePay com o valor exato do pedido.
                </li>
                <li>
                  O cliente é redirecionado para o checkout seguro da InfinitePay, conclui o pagamento e volta para a sua loja.
                </li>
              </ol>

              <div className="rounded-md bg-primary/5 p-3 text-xs">
                <p className="font-bold text-primary">💡 Como o cliente paga:</p>
                <ul className="ml-4 mt-1 list-disc space-y-1 text-muted-foreground">
                  <li>Cartão de crédito (parcelamento conforme sua conta InfinitePay)</li>
                  <li>Pix (se ativado na sua conta InfinitePay)</li>
                  <li>Pagamento 100% online — você não precisa fazer nada manualmente</li>
                </ul>
              </div>

              <div className="rounded-md bg-amber-500/10 p-3 text-xs">
                <p className="font-bold text-amber-700">⚠ Importante:</p>
                <p className="mt-1 text-muted-foreground">
                  A taxa de cada transação é cobrada pela InfinitePay diretamente na sua conta. Consulte as taxas no app da InfinitePay.
                  O valor líquido cai na sua conta conforme as regras da InfinitePay (D+1 crédito à vista, etc.).
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
