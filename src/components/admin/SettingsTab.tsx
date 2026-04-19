import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Timer, Volume2 } from "lucide-react";

type StoreSettings = {
  accept_alert_min: number;
  autocancel_min: number;
  autocancel_enabled: boolean;
  sound_alerts_enabled: boolean;
};

export const SettingsTab = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["store-settings", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("accept_alert_min, autocancel_min, autocancel_enabled, sound_alerts_enabled")
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
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = async () => {
    const { error } = await supabase.from("stores").update(form).eq("id", storeId);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["store-settings", storeId] });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h2 className="font-display text-2xl font-bold">Configurações de pedidos</h2>
        <p className="text-sm text-muted-foreground">
          Defina alertas sonoros e regras de cancelamento automático.
        </p>
      </header>

      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">Alertas sonoros</h3>
              <p className="text-xs text-muted-foreground">
                Toca um beep ao chegar um pedido novo.
              </p>
            </div>
          </div>
          <Toggle
            checked={form.sound_alerts_enabled}
            onChange={(v) => setForm((f) => ({ ...f, sound_alerts_enabled: v }))}
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
