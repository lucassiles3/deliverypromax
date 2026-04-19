import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Timer, Volume2, Printer, ShoppingCart } from "lucide-react";

type StoreSettings = {
  accept_alert_min: number;
  autocancel_min: number;
  autocancel_enabled: boolean;
  sound_alerts_enabled: boolean;
  auto_print_enabled: boolean;
  print_format: "a4" | "thermal_80mm";
  pdv_enabled: boolean;
};

export const SettingsTab = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["store-full-settings", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(
          "accept_alert_min, autocancel_min, autocancel_enabled, sound_alerts_enabled, auto_print_enabled, print_format, pdv_enabled"
        )
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data as StoreSettings | null;
    },
  });

  const [form, setForm] = useState<StoreSettings>({
    accept_alert_min: 3,
    autocancel_min: 5,
    autocancel_enabled: true,
    sound_alerts_enabled: true,
    auto_print_enabled: false,
    print_format: "thermal_80mm",
    pdv_enabled: true,
  });

  useEffect(() => {
    if (data) setForm((f) => ({ ...f, ...data }));
  }, [data]);

  const save = async () => {
    const { error } = await supabase.from("stores").update(form).eq("id", storeId);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["store-full-settings", storeId] });
    qc.invalidateQueries({ queryKey: ["store-settings", storeId] });
    qc.invalidateQueries({ queryKey: ["store-toggles", storeId] });
  };

  const testPrint = async () => {
    const { printReceipt } = await import("@/lib/printReceipt");
    printReceipt(
      {
        storeName: "Sua Loja",
        orderId: "test",
        orderShortId: "TESTE1",
        createdAt: new Date().toISOString(),
        customerName: "Cliente Teste",
        customerPhone: "(11) 99999-0000",
        method: "delivery",
        paymentMethod: "pix",
        items: [
          { quantity: 1, product_name: "X-Burger", unit_price: 25, notes: "Sem cebola" },
          { quantity: 2, product_name: "Coca-Cola lata", unit_price: 6 },
        ],
        subtotal: 37,
        deliveryFee: 5,
        total: 42,
        address: { street: "Rua Teste", number: "123", neighborhood: "Centro" },
      },
      form.print_format,
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h2 className="font-display text-2xl font-bold">Operação</h2>
        <p className="text-sm text-muted-foreground">
          Som, impressão automática, PDV e regras de aceite/cancelamento.
        </p>
      </header>

      {/* Som */}
      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">Alertas sonoros</h3>
              <p className="text-xs text-muted-foreground">Toca um beep ao chegar pedido novo.</p>
            </div>
          </div>
          <Toggle
            checked={form.sound_alerts_enabled}
            onChange={(v) => setForm((f) => ({ ...f, sound_alerts_enabled: v }))}
          />
        </div>
      </section>

      {/* Impressão automática */}
      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">Impressão automática</h3>
              <p className="text-xs text-muted-foreground">
                Abre o cupom para impressão a cada novo pedido recebido.
              </p>
            </div>
          </div>
          <Toggle
            checked={form.auto_print_enabled}
            onChange={(v) => setForm((f) => ({ ...f, auto_print_enabled: v }))}
          />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Formato</p>
          <div className="grid grid-cols-2 gap-2">
            <FormatBtn
              active={form.print_format === "thermal_80mm"}
              onClick={() => setForm((f) => ({ ...f, print_format: "thermal_80mm" }))}
              title="Cupom 80mm"
              hint="Impressora térmica"
            />
            <FormatBtn
              active={form.print_format === "a4"}
              onClick={() => setForm((f) => ({ ...f, print_format: "a4" }))}
              title="Folha A4"
              hint="Impressora comum"
            />
          </div>
          <Button variant="outline" size="sm" onClick={testPrint} className="mt-2 w-full">
            <Printer className="mr-2 h-4 w-4" /> Testar impressão
          </Button>
          <p className="text-[11px] text-muted-foreground">
            ⚠️ Habilite popups deste site no navegador para imprimir automaticamente.
          </p>
        </div>
      </section>

      {/* PDV */}
      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-green-500/10 p-2 text-green-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">PDV (vendas físicas no balcão)</h3>
              <p className="text-xs text-muted-foreground">
                Habilita a aba PDV no painel e a página /pdv para o atendente.
              </p>
            </div>
          </div>
          <Toggle
            checked={form.pdv_enabled}
            onChange={(v) => setForm((f) => ({ ...f, pdv_enabled: v }))}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold">Tempo para alerta de aceite</h3>
            <p className="text-xs text-muted-foreground">
              Pedido sem aceite após esse tempo destaca em vermelho e toca alerta.
            </p>
          </div>
        </div>
        <NumberField
          value={form.accept_alert_min}
          onChange={(v) => setForm((f) => ({ ...f, accept_alert_min: v }))}
          suffix="min"
          min={1}
          max={60}
        />
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">Cancelamento automático</h3>
              <p className="text-xs text-muted-foreground">
                Cancela pedidos sem aceite após o limite. Cliente é notificado.
              </p>
            </div>
          </div>
          <Toggle
            checked={form.autocancel_enabled}
            onChange={(v) => setForm((f) => ({ ...f, autocancel_enabled: v }))}
          />
        </div>
        <NumberField
          value={form.autocancel_min}
          onChange={(v) => setForm((f) => ({ ...f, autocancel_min: v }))}
          suffix="min"
          min={form.accept_alert_min}
          max={120}
          disabled={!form.autocancel_enabled}
        />
      </section>

      <Button onClick={save} className="w-full gradient-primary font-bold" size="lg">
        Salvar configurações
      </Button>
    </div>
  );
};

const FormatBtn = ({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) => (
  <button
    onClick={onClick}
    className={`rounded-xl border-2 p-3 text-left transition-smooth ${
      active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
    }`}
  >
    <div className="font-bold">{title}</div>
    <div className="text-xs text-muted-foreground">{hint}</div>
  </button>
);

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 rounded-full transition-colors ${
      checked ? "bg-primary" : "bg-muted"
    }`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
        checked ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

const NumberField = ({
  value,
  onChange,
  suffix,
  min = 0,
  max = 999,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) => (
  <div className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
    <input
      type="number"
      value={value}
      disabled={disabled}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
      className="w-24 rounded-lg border-2 bg-background px-3 py-2 text-center font-bold outline-none focus:border-primary"
    />
    {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
  </div>
);
