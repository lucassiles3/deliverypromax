import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tag, Plus, Pencil, Trash2, Zap, Package2, Users, Send,
  Copy, Eye, EyeOff, TrendingUp, Clock, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Tab = "coupons" | "combos" | "flash" | "reactivation";

export const MarketingTab = ({ storeId }: { storeId: string }) => {
  const [tab, setTab] = useState<Tab>("coupons");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "coupons" as const, label: "Cupons", icon: Tag },
          { id: "combos" as const, label: "Combos", icon: Package2 },
          { id: "flash" as const, label: "Promo Relâmpago", icon: Zap },
          { id: "reactivation" as const, label: "Reativação", icon: Users },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-smooth ${
                tab === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "coupons" && <CouponsSection storeId={storeId} />}
      {tab === "combos" && <CombosSection storeId={storeId} />}
      {tab === "flash" && <FlashSection storeId={storeId} />}
      {tab === "reactivation" && <ReactivationSection storeId={storeId} />}
    </div>
  );
};

/* =================================================================
 * 6.1 — CUPONS
 * ================================================================= */

type CouponRow = {
  id: string;
  code: string;
  label: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  min_order: number | null;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  visibility: "public" | "private" | "vip";
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  category_ids: string[] | null;
};

const CouponsSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: coupons = [] } = useQuery({
    queryKey: ["admin-coupons", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CouponRow[];
    },
  });

  const filtered = useMemo(
    () =>
      coupons.filter(
        (c) =>
          !search.trim() ||
          c.code.toLowerCase().includes(search.toLowerCase()) ||
          c.label.toLowerCase().includes(search.toLowerCase()),
      ),
    [coupons, search],
  );

  const toggleActive = async (c: CouponRow) => {
    const { error } = await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-coupons", storeId] });
  };

  const remove = async (c: CouponRow) => {
    if (!confirm(`Excluir cupom "${c.code}"?`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Cupom excluído");
    qc.invalidateQueries({ queryKey: ["admin-coupons", storeId] });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cupom..."
            className="w-full rounded-xl border-2 border-border bg-card pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-primary"
          />
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Novo cupom
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Tag} title="Nenhum cupom criado" hint="Crie cupons para atrair e converter clientes." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            const usagePct = c.usage_limit ? Math.min(100, (c.used_count / c.usage_limit) * 100) : 0;
            return (
              <div key={c.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="rounded-lg bg-primary/10 px-2 py-1 font-display text-base font-bold text-primary">
                        {c.code}
                      </code>
                      <button onClick={() => copyCode(c.code)} title="Copiar">
                        <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{c.label}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    !c.active ? "bg-muted text-muted-foreground"
                    : expired ? "bg-destructive/10 text-destructive"
                    : "bg-green-500/10 text-green-600"
                  }`}>
                    {!c.active ? "Pausado" : expired ? "Expirado" : "Ativo"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Info label="Desconto" value={
                    c.type === "percent" ? `${c.value}%`
                    : c.type === "fixed" ? `R$ ${c.value.toFixed(2)}`
                    : "Frete grátis"
                  } />
                  <Info label="Mínimo" value={c.min_order ? `R$ ${c.min_order.toFixed(2)}` : "—"} />
                  <Info label="Por cliente" value={`${c.per_user_limit}x`} />
                  <Info label="Visibilidade" value={c.visibility === "public" ? "Público" : c.visibility === "vip" ? "VIP" : "Privado"} />
                </div>

                {c.usage_limit && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Usos</span>
                      <span className="font-bold">{c.used_count}/{c.usage_limit}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePct}%` }} />
                    </div>
                  </div>
                )}

                {c.expires_at && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Até {new Date(c.expires_at).toLocaleString("pt-BR")}
                  </div>
                )}

                <div className="mt-3 flex gap-1.5 border-t pt-3">
                  <button
                    onClick={() => { setEditing(c); setModalOpen(true); }}
                    className="flex-1 rounded-lg border border-border bg-muted/30 py-1.5 text-xs font-bold hover:bg-muted"
                  >
                    <Pencil className="mr-1 inline h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={() => toggleActive(c)}
                    className="flex-1 rounded-lg border border-border bg-muted/30 py-1.5 text-xs font-bold hover:bg-muted"
                  >
                    {c.active ? <><EyeOff className="mr-1 inline h-3 w-3" /> Pausar</> : <><Eye className="mr-1 inline h-3 w-3" /> Ativar</>}
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <CouponModal
          storeId={storeId}
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-coupons", storeId] });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm font-bold">{value}</div>
  </div>
);

const CouponModal = ({
  storeId, initial, onClose, onSaved,
}: {
  storeId: string;
  initial: CouponRow | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [code, setCode] = useState(initial?.code ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [type, setType] = useState<CouponRow["type"]>(initial?.type ?? "percent");
  const [value, setValue] = useState(initial?.value ?? 10);
  const [minOrder, setMinOrder] = useState<number | "">(initial?.min_order ?? "");
  const [usageLimit, setUsageLimit] = useState<number | "">(initial?.usage_limit ?? "");
  const [perUser, setPerUser] = useState(initial?.per_user_limit ?? 1);
  const [startsAt, setStartsAt] = useState(initial?.starts_at?.slice(0, 16) ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at?.slice(0, 16) ?? "");
  const [visibility, setVisibility] = useState<CouponRow["visibility"]>(initial?.visibility ?? "public");
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.category_ids ?? []);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-cats-coupon", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").eq("store_id", storeId);
      return data ?? [];
    },
  });

  const save = async () => {
    if (!code.trim() || !label.trim()) return toast.error("Código e nome são obrigatórios");
    setSaving(true);
    const payload = {
      store_id: storeId,
      code: code.trim().toUpperCase(),
      label: label.trim(),
      type,
      value: Number(value),
      min_order: minOrder === "" ? null : Number(minOrder),
      usage_limit: usageLimit === "" ? null : Number(usageLimit),
      per_user_limit: Number(perUser) || 1,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      visibility,
      category_ids: categoryIds.length ? categoryIds : null,
      active: true,
    };
    const { error } = initial
      ? await supabase.from("coupons").update(payload).eq("id", initial.id)
      : await supabase.from("coupons").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Cupom atualizado" : "Cupom criado");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border-2 border-border bg-card p-6 shadow-glow">
        <h3 className="font-display text-xl font-bold">{initial ? "Editar cupom" : "Novo cupom"}</h3>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Código*">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="EX: PRIMEIROITCHAT"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 font-mono text-sm font-bold uppercase outline-none focus:border-primary" />
          </Field>
          <Field label="Nome / descrição*">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: 10% no primeiro pedido"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Tipo de desconto">
            <select value={type} onChange={(e) => setType(e.target.value as CouponRow["type"])}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary">
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
              <option value="free_shipping">Frete grátis</option>
            </select>
          </Field>
          <Field label={`Valor ${type === "percent" ? "(%)" : type === "fixed" ? "(R$)" : ""}`}>
            <input type="number" step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))}
              disabled={type === "free_shipping"}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50" />
          </Field>
          <Field label="Pedido mínimo (R$)">
            <input type="number" step="0.01" value={minOrder} onChange={(e) => setMinOrder(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Opcional"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Limite de usos total">
            <input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Opcional — sem limite"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Limite por cliente*">
            <input type="number" min={1} value={perUser} onChange={(e) => setPerUser(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Visibilidade">
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as CouponRow["visibility"])}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary">
              <option value="public">Público</option>
              <option value="private">Privado (link)</option>
              <option value="vip">VIP</option>
            </select>
          </Field>
          <Field label="Início">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Validade*">
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
        </div>

        {categories.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Categorias aplicáveis (vazio = todas)
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const sel = categoryIds.includes(c.id);
                return (
                  <button key={c.id}
                    onClick={() => setCategoryIds((prev) => sel ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                    className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition-smooth ${
                      sel ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
    {children}
  </div>
);

/* =================================================================
 * 6.2 — COMBOS
 * ================================================================= */

const CombosSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: combos = [] } = useQuery({
    queryKey: ["admin-combos", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, active, available_from, available_to, combo_items(id, quantity, product_id, products!combo_items_product_id_fkey(name, price))")
        .eq("store_id", storeId)
        .eq("is_combo", true)
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-prods-for-combo", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, price").eq("store_id", storeId).eq("is_combo", false).eq("active", true);
      return data ?? [];
    },
  });

  const remove = async (id: string, name: string) => {
    if (!confirm(`Excluir combo "${name}"?`)) return;
    await supabase.from("products").delete().eq("id", id);
    toast.success("Combo excluído");
    qc.invalidateQueries({ queryKey: ["admin-combos", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo combo
        </Button>
      </div>

      {combos.length === 0 ? (
        <EmptyState icon={Package2} title="Nenhum combo criado" hint="Combine produtos com preço especial." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {combos.map((c: any) => {
            const original = (c.combo_items ?? []).reduce(
              (s: number, i: any) => s + (i.products?.price ?? 0) * i.quantity, 0,
            );
            const saved = original - Number(c.price);
            return (
              <div key={c.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-soft">
                {c.image_url && <img src={c.image_url} alt={c.name} className="mb-3 h-32 w-full rounded-xl object-cover" />}
                <h4 className="font-display text-lg font-bold">{c.name}</h4>
                {c.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}

                <ul className="mt-3 space-y-1 text-xs">
                  {(c.combo_items ?? []).map((i: any) => (
                    <li key={i.id} className="flex justify-between">
                      <span>{i.quantity}× {i.products?.name}</span>
                      <span className="text-muted-foreground">R$ {((i.products?.price ?? 0) * i.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 rounded-xl bg-primary/5 p-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground line-through">R$ {original.toFixed(2)}</span>
                    <span className="font-display text-xl font-bold text-primary">R$ {Number(c.price).toFixed(2)}</span>
                  </div>
                  {saved > 0 && (
                    <div className="mt-1 text-[11px] font-bold text-green-600">
                      Economia de R$ {saved.toFixed(2)}
                    </div>
                  )}
                </div>

                {(c.available_from || c.available_to) && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {c.available_from?.slice(0,5) ?? "00:00"} – {c.available_to?.slice(0,5) ?? "23:59"}
                  </div>
                )}

                <div className="mt-3 flex gap-1.5 border-t pt-3">
                  <button onClick={() => { setEditing(c); setModalOpen(true); }}
                    className="flex-1 rounded-lg border border-border bg-muted/30 py-1.5 text-xs font-bold hover:bg-muted">
                    <Pencil className="mr-1 inline h-3 w-3" /> Editar
                  </button>
                  <button onClick={() => remove(c.id, c.name)}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ComboModal
          storeId={storeId}
          initial={editing}
          products={products}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-combos", storeId] });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

const ComboModal = ({
  storeId, initial, products, onClose, onSaved,
}: {
  storeId: string;
  initial: any;
  products: any[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [from, setFrom] = useState(initial?.available_from?.slice(0,5) ?? "");
  const [to, setTo] = useState(initial?.available_to?.slice(0,5) ?? "");
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>(
    initial?.combo_items?.map((i: any) => ({ product_id: i.product_id, quantity: i.quantity })) ?? [],
  );
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems((p) => [...p, { product_id: products[0]?.id ?? "", quantity: 1 }]);
  const updateItem = (i: number, patch: Partial<{ product_id: string; quantity: number }>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const original = items.reduce((s, i) => {
    const p = products.find((x) => x.id === i.product_id);
    return s + (Number(p?.price ?? 0) * i.quantity);
  }, 0);

  const save = async () => {
    if (!name.trim() || items.length < 2) return toast.error("Informe nome e ao menos 2 itens");
    if (price <= 0) return toast.error("Preço inválido");
    setSaving(true);

    const payload: any = {
      store_id: storeId,
      name: name.trim(),
      description: description || null,
      price,
      old_price: original > price ? original : null,
      image_url: imageUrl || null,
      is_combo: true,
      active: true,
      available_from: from || null,
      available_to: to || null,
    };

    let comboId = initial?.id;
    if (initial) {
      const { error } = await supabase.from("products").update(payload).eq("id", initial.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      await supabase.from("combo_items").delete().eq("combo_id", initial.id);
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) { setSaving(false); return toast.error(error.message); }
      comboId = data.id;
    }

    const { error: itemsErr } = await supabase.from("combo_items").insert(
      items.map((i, idx) => ({ combo_id: comboId, product_id: i.product_id, quantity: i.quantity, position: idx })),
    );
    setSaving(false);
    if (itemsErr) return toast.error(itemsErr.message);
    toast.success(initial ? "Combo atualizado" : "Combo criado");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border-2 border-border bg-card p-6 shadow-glow">
        <h3 className="font-display text-xl font-bold">{initial ? "Editar combo" : "Novo combo"}</h3>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nome do combo*"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
          <Field label="URL da imagem"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
          <div className="md:col-span-2">
            <Field label="Descrição"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
          </div>
          <Field label="Disponível das"><input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
          <Field label="Até"><input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produtos do combo*</p>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> Item</Button>
          </div>
          <div className="space-y-2">
            {items.map((i, idx) => (
              <div key={idx} className="flex gap-2">
                <select value={i.product_id} onChange={(e) => updateItem(idx, { product_id: e.target.value })}
                  className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>)}
                </select>
                <input type="number" min={1} value={i.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                  className="w-20 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                <button onClick={() => removeItem(idx)} className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">Soma individual</div>
            <div className="font-display text-lg font-bold">R$ {original.toFixed(2)}</div>
          </div>
          <Field label="Preço do combo*">
            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-base font-bold outline-none focus:border-primary" />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
};

/* =================================================================
 * 6.3 — PROMO RELÂMPAGO
 * ================================================================= */

const FlashSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["admin-flash-prods", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, old_price, image_url, flash_promo, flash_discount_percent, promo_starts_at, promo_ends_at, active")
        .eq("store_id", storeId)
        .is("archived_at", null)
        .order("name");
      return data ?? [];
    },
  });

  const activeFlash = products.filter((p: any) => p.flash_promo && p.promo_ends_at && new Date(p.promo_ends_at) > new Date());

  const stop = async (p: any) => {
    await supabase.from("products").update({
      flash_promo: false, flash_discount_percent: null,
      promo_starts_at: null, promo_ends_at: null,
      old_price: null, price: p.old_price ?? p.price,
    }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["admin-flash-prods", storeId] });
    toast.success("Promo encerrada");
  };

  const [picker, setPicker] = useState(false);
  const [chosen, setChosen] = useState<any | null>(null);
  const [discount, setDiscount] = useState(20);
  const [hours, setHours] = useState(2);

  const launch = async () => {
    if (!chosen) return;
    const newPrice = +(chosen.price * (1 - discount / 100)).toFixed(2);
    await supabase.from("products").update({
      flash_promo: true,
      flash_discount_percent: discount,
      old_price: chosen.price,
      price: newPrice,
      promo: true,
      promo_starts_at: new Date().toISOString(),
      promo_ends_at: new Date(Date.now() + hours * 3600_000).toISOString(),
    }).eq("id", chosen.id);
    toast.success(`⚡ Promo relâmpago lançada — ${discount}% por ${hours}h`);
    setPicker(false);
    setChosen(null);
    qc.invalidateQueries({ queryKey: ["admin-flash-prods", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              <h3 className="font-display text-lg font-bold">Lançar Promo Relâmpago</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Cria urgência com cronômetro visível no cardápio.</p>
          </div>
          <Button onClick={() => setPicker(true)} className="gap-2 bg-amber-500 hover:bg-amber-600">
            <Zap className="h-4 w-4" /> Nova promo
          </Button>
        </div>
      </div>

      <div>
        <h4 className="mb-3 font-display text-base font-bold">Promos ativas ({activeFlash.length})</h4>
        {activeFlash.length === 0 ? (
          <EmptyState icon={Zap} title="Nenhuma promo ativa" hint="Lance uma promo relâmpago para criar urgência." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeFlash.map((p: any) => (
              <FlashCard key={p.id} product={p} onStop={() => stop(p)} />
            ))}
          </div>
        )}
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={() => setPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-6 shadow-glow">
            <h3 className="font-display text-xl font-bold">⚡ Nova promo relâmpago</h3>
            <div className="mt-4 space-y-4">
              <Field label="Produto">
                <select value={chosen?.id ?? ""} onChange={(e) => setChosen(products.find((x: any) => x.id === e.target.value))}
                  className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary">
                  <option value="">Escolha...</option>
                  {products.filter((p: any) => !p.flash_promo).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desconto (%)">
                  <input type="number" min={5} max={90} value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                </Field>
                <Field label="Duração (horas)">
                  <input type="number" min={1} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                </Field>
              </div>
              {chosen && (
                <div className="rounded-xl bg-muted/40 p-3 text-sm">
                  De <span className="line-through">R$ {Number(chosen.price).toFixed(2)}</span> por{" "}
                  <span className="font-display text-lg font-bold text-primary">
                    R$ {(chosen.price * (1 - discount / 100)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPicker(false)}>Cancelar</Button>
              <Button onClick={launch} disabled={!chosen} className="bg-amber-500 hover:bg-amber-600">⚡ Lançar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FlashCard = ({ product, onStop }: { product: any; onStop: () => void }) => {
  const [now, setNow] = useState(Date.now());
  useMemo(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const end = new Date(product.promo_ends_at).getTime();
  const diff = Math.max(0, end - now);
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return (
    <div className="rounded-2xl border-2 border-amber-500/40 bg-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        {product.image_url && <img src={product.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
        <div className="flex-1">
          <h4 className="font-bold">{product.name}</h4>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground line-through">R$ {Number(product.old_price ?? 0).toFixed(2)}</span>
            <span className="font-display text-lg font-bold text-amber-600">R$ {Number(product.price).toFixed(2)}</span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              -{product.flash_discount_percent}%
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-center">
        <div className="text-[10px] font-bold uppercase text-amber-700">Acaba em</div>
        <div className="font-display text-2xl font-bold text-amber-600">
          {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onStop} className="mt-3 w-full">Encerrar agora</Button>
    </div>
  );
};

/* =================================================================
 * 6.4 — REATIVAÇÃO
 * ================================================================= */

const ReactivationSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["reactivation-campaigns", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("reactivation_campaigns").select("*").eq("store_id", storeId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["reactivation-runs", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("reactivation_runs").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const runCampaign = async (id: string) => {
    const { data, error } = await supabase.rpc("run_reactivation_campaign", { _campaign_id: id });
    if (error) return toast.error(error.message);
    toast.success(`✅ ${data} cupons gerados`);
    qc.invalidateQueries({ queryKey: ["reactivation-runs", storeId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir campanha?")) return;
    await supabase.from("reactivation_campaigns").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["reactivation-campaigns", storeId] });
  };

  const buildWhatsApp = (r: any, c: any) => {
    const phone = (r.customer_phone ?? "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Oi ${r.customer_name ?? ""}! 👋 Sentimos sua falta. Use o cupom *${r.coupon_code}* e ganhe ${c.discount_type === "percent" ? c.discount_value + "%" : "R$ " + c.discount_value} de desconto no próximo pedido. Válido por ${c.coupon_validity_days} dias!`,
    );
    return `https://wa.me/55${phone}?text=${msg}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova campanha
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState icon={Users} title="Nenhuma campanha de reativação" hint="Reconquiste clientes inativos com cupons exclusivos." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c: any) => {
            const targetRuns = runs.filter((r: any) => r.campaign_id === c.id);
            const redeemed = targetRuns.filter((r: any) => r.redeemed).length;
            const rate = targetRuns.length ? Math.round((redeemed / targetRuns.length) * 100) : 0;
            return (
              <div key={c.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-display text-lg font-bold">{c.name}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inativos há {c.inactive_days}d · {c.discount_type === "percent" ? `${c.discount_value}%` : `R$ ${c.discount_value}`} · válido {c.coupon_validity_days}d
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                    {c.active ? "Ativa" : "Pausada"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Gerados</div>
                    <div className="font-display text-lg font-bold">{targetRuns.length}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Resgatados</div>
                    <div className="font-display text-lg font-bold text-green-600">{redeemed}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Taxa</div>
                    <div className="font-display text-lg font-bold text-primary">{rate}%</div>
                  </div>
                </div>

                <div className="mt-3 flex gap-1.5">
                  <Button size="sm" onClick={() => runCampaign(c.id)} className="flex-1 gap-1">
                    <Send className="h-3.5 w-3.5" /> Gerar cupons agora
                  </Button>
                  <button onClick={() => { setEditing(c); setModalOpen(true); }}
                    className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(c.id)}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {targetRuns.length > 0 && (
                  <details className="mt-3 border-t pt-3">
                    <summary className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground">
                      Ver clientes-alvo ({targetRuns.length})
                    </summary>
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {targetRuns.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1.5 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold">{r.customer_name ?? "—"}</div>
                            <div className="truncate text-muted-foreground">{r.customer_phone}</div>
                          </div>
                          <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">{r.coupon_code}</code>
                          {r.redeemed ? (
                            <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold text-green-700">USADO</span>
                          ) : r.customer_phone ? (
                            <a href={buildWhatsApp(r, c)} target="_blank" rel="noopener noreferrer"
                              className="rounded-lg bg-green-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-green-600">
                              WhatsApp
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <CampaignModal
          storeId={storeId}
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["reactivation-campaigns", storeId] });
            setModalOpen(false);
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
  initial: any;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [inactive, setInactive] = useState(initial?.inactive_days ?? 14);
  const [discType, setDiscType] = useState<"percent"|"fixed">(initial?.discount_type ?? "percent");
  const [discVal, setDiscVal] = useState(initial?.discount_value ?? 15);
  const [validity, setValidity] = useState(initial?.coupon_validity_days ?? 7);
  const [active, setActive] = useState(initial?.active ?? true);

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    const payload = {
      store_id: storeId, name: name.trim(),
      inactive_days: inactive, discount_type: discType, discount_value: discVal,
      coupon_validity_days: validity, active,
    };
    const { error } = initial
      ? await supabase.from("reactivation_campaigns").update(payload).eq("id", initial.id)
      : await supabase.from("reactivation_campaigns").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Campanha salva");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border-2 border-border bg-card p-6 shadow-glow">
        <h3 className="font-display text-xl font-bold">{initial ? "Editar campanha" : "Nova campanha"}</h3>
        <div className="mt-4 grid gap-4">
          <Field label="Nome*"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Volta logo!"
            className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
          <Field label="Cliente sem pedido há (dias)">
            <select value={inactive} onChange={(e) => setInactive(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary">
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
              <option value={45}>45 dias</option>
              <option value={60}>60 dias</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={discType} onChange={(e) => setDiscType(e.target.value as any)}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary">
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </Field>
            <Field label={`Valor ${discType==="percent"?"(%)":"(R$)"}`}>
              <input type="number" step="0.01" value={discVal} onChange={(e) => setDiscVal(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
          </div>
          <Field label="Validade do cupom (dias)">
            <input type="number" value={validity} onChange={(e) => setValidity(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Campanha ativa
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </div>
      </div>
    </div>
  );
};

/* =================================================================
 * Empty state
 * ================================================================= */

const EmptyState = ({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) => (
  <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-10 text-center">
    <Icon className="mx-auto h-10 w-10 text-muted-foreground/50" />
    <h4 className="mt-3 font-display text-lg font-bold">{title}</h4>
    <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
  </div>
);
