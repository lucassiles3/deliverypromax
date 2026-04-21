import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Cake, Plus, Pencil, Trash2, Send, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Campaign = {
  id: string;
  name: string;
  active: boolean;
  discount_type: "percent" | "fixed";
  discount_value: number;
  coupon_validity_days: number;
  message: string | null;
};

export const BirthdaySection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [open, setOpen] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["birthday-campaigns", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("birthday_campaigns")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["birthday-runs", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("birthday_runs")
        .select("id, coupon_code, year, redeemed, created_at, user_id")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const toggle = async (c: Campaign) => {
    await supabase.from("birthday_campaigns").update({ active: !c.active }).eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["birthday-campaigns", storeId] });
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`Excluir campanha "${c.name}"?`)) return;
    await supabase.from("birthday_campaigns").delete().eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["birthday-campaigns", storeId] });
  };

  const run = async (c: Campaign) => {
    const { data, error } = await supabase.rpc("run_birthday_campaign", { _campaign_id: c.id });
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} cupons gerados`);
    qc.invalidateQueries({ queryKey: ["birthday-runs", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Cake className="h-5 w-5 text-primary" /> Aniversariantes
          </h3>
          <p className="text-sm text-muted-foreground">Cupom automático no mês de aniversário do cliente.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova campanha
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-card p-10 text-center">
          <Cake className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 font-bold">Nenhuma campanha de aniversário</p>
          <p className="text-xs text-muted-foreground">Crie uma para presentear seus clientes no mês deles.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-base font-bold">{c.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.discount_type === "percent" ? `${c.discount_value}% off` : `R$ ${c.discount_value.toFixed(2)} off`}
                    {" · válido "}{c.coupon_validity_days} dias
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  c.active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                }`}>
                  {c.active ? "Ativa" : "Pausada"}
                </span>
              </div>
              {c.message && <p className="mt-3 rounded-lg bg-muted/40 p-2 text-xs italic">"{c.message}"</p>}
              <div className="mt-3 flex gap-1.5 border-t pt-3">
                <button onClick={() => run(c)} className="flex-1 rounded-lg border border-primary bg-primary/10 py-1.5 text-xs font-bold text-primary hover:bg-primary/20">
                  <Send className="mr-1 inline h-3 w-3" /> Rodar agora
                </button>
                <button onClick={() => { setEditing(c); setOpen(true); }} className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => toggle(c)} className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 hover:bg-muted">
                  {c.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => remove(c)} className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {runs.length > 0 && (
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-5 py-3 font-bold">Últimos cupons enviados</div>
          <ul className="divide-y">
            {runs.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-2 text-sm">
                <code className="rounded bg-muted px-2 py-0.5 text-xs">{r.coupon_code}</code>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  r.redeemed ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-700"
                }`}>{r.redeemed ? "Resgatado" : "Pendente"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <CampaignModal
          storeId={storeId}
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["birthday-campaigns", storeId] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};

const CampaignModal = ({
  storeId, initial, onClose, onSaved,
}: {
  storeId: string;
  initial: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(initial?.name ?? "Aniversariante do mês");
  const [type, setType] = useState<"percent" | "fixed">(initial?.discount_type ?? "percent");
  const [value, setValue] = useState(initial?.discount_value ?? 15);
  const [validity, setValidity] = useState(initial?.coupon_validity_days ?? 30);
  const [message, setMessage] = useState(initial?.message ?? "Parabéns! 🎉 Use este cupom no seu mês de aniversário.");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const payload = {
      store_id: storeId,
      name: name.trim(),
      discount_type: type,
      discount_value: Number(value),
      coupon_validity_days: Number(validity),
      message,
      active: true,
    };
    const { error } = initial
      ? await supabase.from("birthday_campaigns").update(payload).eq("id", initial.id)
      : await supabase.from("birthday_campaigns").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Campanha atualizada" : "Campanha criada");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border-2 border-border bg-card p-6 shadow-glow">
        <h3 className="font-display text-xl font-bold flex items-center gap-2">
          <Cake className="h-5 w-5 text-primary" /> {initial ? "Editar campanha" : "Nova campanha de aniversário"}
        </h3>

        <div className="mt-4 grid gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <select value={type} onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary">
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <Label>Desconto {type === "percent" ? "(%)" : "(R$)"}</Label>
              <Input type="number" step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Validade do cupom (dias)</Label>
            <Input type="number" value={validity} onChange={(e) => setValidity(Number(e.target.value))} />
          </div>
          <div>
            <Label>Mensagem</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
};
