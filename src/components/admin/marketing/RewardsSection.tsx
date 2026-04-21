import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Plus, Pencil, Trash2, Eye, EyeOff, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

type Reward = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  cost_points: number;
  reward_type: "fixed" | "percent" | "free_shipping" | "free_item";
  reward_value: number;
  stock: number | null;
  active: boolean;
  position: number;
};

export const RewardsSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Reward | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rewards = [] } = useQuery({
    queryKey: ["admin-rewards", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Reward[];
    },
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ["admin-redemptions", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_redemptions")
        .select("id, points_spent, coupon_code, status, created_at, loyalty_rewards(name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const toggle = async (r: Reward) => {
    await supabase.from("loyalty_rewards").update({ active: !r.active }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["admin-rewards", storeId] });
  };

  const remove = async (r: Reward) => {
    if (!confirm(`Excluir recompensa "${r.name}"?`)) return;
    const { error } = await supabase.from("loyalty_rewards").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Recompensa excluída");
    qc.invalidateQueries({ queryKey: ["admin-rewards", storeId] });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-bold">Programa de Fidelidade</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Clientes ganham <b>1 ponto a cada R$ 1</b> em pedidos entregues. Aqui você define o que eles podem trocar.
            </p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nova recompensa
          </Button>
        </div>
      </div>

      {rewards.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed p-10 text-center">
          <Gift className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h4 className="mt-3 font-display text-lg font-bold">Nenhuma recompensa</h4>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre cupons resgatáveis por pontos.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rewards.map((r) => (
            <div key={r.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-display text-base font-bold">{r.name}</h4>
                  {r.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                </div>
                <div className="rounded-xl bg-primary/10 px-2.5 py-1.5 text-center">
                  <div className="font-display text-base font-bold text-primary">{r.cost_points}</div>
                  <div className="text-[9px] font-bold uppercase text-muted-foreground">pts</div>
                </div>
              </div>
              <div className="mt-3 text-xs">
                {r.reward_type === "percent" && <>🎯 {r.reward_value}% OFF</>}
                {r.reward_type === "fixed" && <>💰 R$ {r.reward_value.toFixed(2)} de desconto</>}
                {r.reward_type === "free_shipping" && <>🚚 Frete grátis</>}
                {r.reward_type === "free_item" && <>🎁 Item grátis</>}
              </div>
              {r.stock !== null && (
                <div className="mt-1 text-[11px] text-muted-foreground">Estoque: {r.stock}</div>
              )}
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                r.active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
              }`}>
                {r.active ? "Ativa" : "Pausada"}
              </span>
              <div className="mt-3 flex gap-1.5 border-t pt-3">
                <button onClick={() => { setEditing(r); setOpen(true); }}
                  className="flex-1 rounded-lg border border-border bg-muted/30 py-1.5 text-xs font-bold hover:bg-muted">
                  <Pencil className="mr-1 inline h-3 w-3" /> Editar
                </button>
                <button onClick={() => toggle(r)}
                  className="flex-1 rounded-lg border border-border bg-muted/30 py-1.5 text-xs font-bold hover:bg-muted">
                  {r.active ? <><EyeOff className="mr-1 inline h-3 w-3" /> Pausar</> : <><Eye className="mr-1 inline h-3 w-3" /> Ativar</>}
                </button>
                <button onClick={() => remove(r)}
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resgates recentes */}
      <div>
        <h4 className="mb-3 font-display text-base font-bold">Resgates recentes</h4>
        {redemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum resgate ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 text-left">Recompensa</th>
                  <th className="px-4 py-2 text-left">Cupom</th>
                  <th className="px-4 py-2 text-left">Pontos</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{r.loyalty_rewards?.name}</td>
                    <td className="px-4 py-2"><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold">{r.coupon_code}</code></td>
                    <td className="px-4 py-2">{r.points_spent}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        r.status === "used" ? "bg-green-500/10 text-green-600"
                          : r.status === "expired" ? "bg-muted text-muted-foreground"
                          : "bg-blue-500/10 text-blue-600"
                      }`}>
                        {r.status === "used" ? "Usado" : r.status === "expired" ? "Expirado" : "Ativo"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <RewardModal
          storeId={storeId}
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-rewards", storeId] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};

const RewardModal = ({
  storeId, initial, onClose, onSaved,
}: {
  storeId: string;
  initial: Reward | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cost, setCost] = useState(initial?.cost_points ?? 100);
  const [type, setType] = useState<Reward["reward_type"]>(initial?.reward_type ?? "percent");
  const [value, setValue] = useState(initial?.reward_value ?? 10);
  const [stock, setStock] = useState<number | "">(initial?.stock ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    if (cost <= 0) return toast.error("Custo em pontos inválido");
    setSaving(true);
    const payload = {
      store_id: storeId,
      name: name.trim(),
      description: description.trim() || null,
      cost_points: cost,
      reward_type: type,
      reward_value: type === "free_shipping" || type === "free_item" ? 0 : Number(value),
      stock: stock === "" ? null : Number(stock),
      active: true,
    };
    const { error } = initial
      ? await supabase.from("loyalty_rewards").update(payload).eq("id", initial.id)
      : await supabase.from("loyalty_rewards").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Recompensa atualizada" : "Recompensa criada");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-3xl border-2 bg-card p-6 shadow-glow">
        <h3 className="font-display text-xl font-bold">{initial ? "Editar recompensa" : "Nova recompensa"}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome*</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Frete grátis"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="O que o cliente ganha"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Custo em pontos*</label>
            <input type="number" min={1} value={cost} onChange={(e) => setCost(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Estoque</label>
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Ilimitado"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as Reward["reward_type"])}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary">
              <option value="percent">Desconto percentual</option>
              <option value="fixed">Desconto fixo (R$)</option>
              <option value="free_shipping">Frete grátis</option>
              <option value="free_item">Item grátis</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Valor {type === "percent" ? "(%)" : type === "fixed" ? "(R$)" : ""}
            </label>
            <input type="number" step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))}
              disabled={type === "free_shipping" || type === "free_item"}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50" />
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
