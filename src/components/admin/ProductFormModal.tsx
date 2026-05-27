import { useEffect, useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveAsset } from "@/lib/assetMap";
import { AddonGroupsEditor } from "./AddonGroupsEditor";
import { ProductAddonGroupsLinker } from "./ProductAddonGroupsLinker";

export type ProductFormData = {
  id?: string;
  name: string;
  category: string | null;
  category_id: string | null;
  description: string | null;
  price: number;
  old_price: number | null;
  image_url: string | null;
  active: boolean;
  bestseller: boolean;
  is_new: boolean;
  promo: boolean;
  track_stock: boolean;
  stock: number | null;
  prep_time_min: number | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
};

type Category = { id: string; name: string };

const empty: ProductFormData = {
  name: "",
  category: "",
  category_id: null,
  description: "",
  price: 0,
  old_price: null,
  image_url: null,
  active: true,
  bestseller: false,
  is_new: false,
  promo: false,
  track_stock: false,
  stock: null,
  prep_time_min: 20,
  promo_starts_at: null,
  promo_ends_at: null,
};

const NAME_MAX = 60;
const DESC_MAX = 300;

export const ProductFormModal = ({
  open,
  initial,
  storeId,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: ProductFormData | null;
  storeId: string;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState<ProductFormData>(initial ?? empty);
  const [tab, setTab] = useState<"info" | "addons">("info");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(initial ?? empty);
    setTab("info");
  }, [initial, open]);

  if (!open) return null;

  const update = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem maior que 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${storeId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      update("image_url", data.publicUrl);
      toast.success("Imagem enviada!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (): Promise<string | null> => {
    if (!form.name.trim()) {
      toast.error("Nome obrigatório");
      return null;
    }
    if (form.price <= 0) {
      toast.error("Preço deve ser maior que zero");
      return null;
    }

    setSaving(true);
    const cat = categories.find((c) => c.id === form.category_id);
    const payload = {
      store_id: storeId,
      name: form.name.trim().slice(0, NAME_MAX),
      category: cat?.name ?? form.category?.trim() ?? null,
      category_id: form.category_id,
      description: form.description?.trim().slice(0, DESC_MAX) || null,
      price: form.price,
      old_price: form.old_price && form.old_price > 0 ? form.old_price : null,
      image_url: form.image_url,
      active: form.active,
      bestseller: form.bestseller,
      is_new: form.is_new,
      promo: form.promo,
      track_stock: form.track_stock,
      stock: form.track_stock ? (form.stock ?? 0) : null,
      prep_time_min: form.prep_time_min ?? null,
      promo_starts_at: form.promo_starts_at,
      promo_ends_at: form.promo_ends_at,
    };

    let resultId = form.id ?? null;
    if (form.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", form.id);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return null;
      }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return null;
      }
      resultId = data.id;
      setForm((f) => ({ ...f, id: resultId! }));
    }
    toast.success(form.id ? "Produto atualizado!" : "Produto criado!");
    onSaved();
    return resultId;
  };

  const goToAddons = async () => {
    if (!form.id) {
      const id = await handleSave();
      if (id) setTab("addons");
    } else {
      setTab("addons");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/95 p-5 backdrop-blur">
          <h2 className="font-display text-xl font-bold">
            {form.id ? "Editar produto" : "Novo produto"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Tabs */}
        <div className="sticky top-[73px] z-10 flex gap-1 border-b bg-card/95 px-5 backdrop-blur">
          {(["info", "addons"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => (t === "addons" ? goToAddons() : setTab(t))}
              className={`relative px-3 py-2.5 text-sm font-bold transition-smooth ${
                tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "info" ? "Informações" : "Adicionais"}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="space-y-5 p-5">
            {/* Imagem */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-muted-foreground">
                Foto do produto
              </label>
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-dashed bg-muted">
                  {form.image_url ? (
                    <img src={resolveAsset(form.image_url)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Sem foto
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {uploading ? "Enviando..." : "Enviar foto"}
                  </Button>
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() => update("image_url", null)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remover
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground">Mín. 800x600px • JPG/PNG</p>
                </div>
              </div>
            </div>

            {/* Nome / Categoria */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Nome * (${form.name.length}/${NAME_MAX})`}>
                <input
                  value={form.name}
                  maxLength={NAME_MAX}
                  onChange={(e) => update("name", e.target.value)}
                  className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                  placeholder="Ex: X-Burger Especial"
                />
              </Field>
              <Field label="Categoria *">
                <select
                  value={form.category_id ?? ""}
                  onChange={(e) => update("category_id", e.target.value || null)}
                  className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                >
                  <option value="">— Selecione —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={`Descrição (${(form.description ?? "").length}/${DESC_MAX})`}>
              <textarea
                value={form.description ?? ""}
                maxLength={DESC_MAX}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                placeholder="Pão brioche, blend 180g, queijo cheddar..."
              />
            </Field>

            {/* Preços */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Preço (R$) *">
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={form.price}
                  onChange={(e) => update("price", Number(e.target.value))}
                  className="w-full rounded-lg border-2 bg-background px-3 py-2 font-bold outline-none focus:border-primary"
                />
              </Field>
              <Field label="Preço promocional (R$)">
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={form.old_price ?? ""}
                  onChange={(e) =>
                    update("old_price", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                  placeholder="opcional"
                />
              </Field>
              <Field label="Tempo de preparo (min) *">
                <input
                  type="number"
                  min="1"
                  value={form.prep_time_min ?? ""}
                  onChange={(e) =>
                    update("prep_time_min", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                  placeholder="20"
                />
              </Field>
            </div>

            {/* Promo agendada */}
            <div className="rounded-xl border-2 border-dashed p-4">
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                Promoção agendada (opcional)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Disponível de">
                  <input
                    type="datetime-local"
                    value={form.promo_starts_at?.slice(0, 16) ?? ""}
                    onChange={(e) =>
                      update("promo_starts_at", e.target.value ? new Date(e.target.value).toISOString() : null)
                    }
                    className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Disponível até">
                  <input
                    type="datetime-local"
                    value={form.promo_ends_at?.slice(0, 16) ?? ""}
                    onChange={(e) =>
                      update("promo_ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)
                    }
                    className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                  />
                </Field>
              </div>
            </div>

            {/* Estoque */}
            <div className="rounded-xl border-2 border-dashed p-4">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={form.track_stock}
                  onChange={(e) => update("track_stock", e.target.checked)}
                  className="h-4 w-4"
                />
                Controlar estoque por quantidade
              </label>
              {form.track_stock && (
                <div className="mt-3">
                  <Field label="Quantidade em estoque">
                    <input
                      type="number"
                      min="0"
                      value={form.stock ?? 0}
                      onChange={(e) => update("stock", Number(e.target.value))}
                      className="w-32 rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                    />
                  </Field>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quando chegar a 0, o produto fica esgotado automaticamente.
                  </p>
                </div>
              )}
            </div>

            {/* Flags */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Toggle
                label="Ativo"
                desc="Visível no app"
                checked={form.active}
                onChange={(v) => update("active", v)}
              />
              <Toggle
                label="Mais vendido"
                desc="Selo ⭐ Top"
                checked={form.bestseller}
                onChange={(v) => update("bestseller", v)}
              />
              <Toggle
                label="Novidade"
                desc="Selo ✨ Novo"
                checked={form.is_new}
                onChange={(v) => update("is_new", v)}
              />
              <Toggle
                label="Em destaque"
                desc="Vitrine 🔥"
                checked={form.promo}
                onChange={(v) => update("promo", v)}
              />
            </div>
          </div>
        )}

        {tab === "addons" && form.id && (
          <div className="space-y-6 p-5">
            <section>
              <h3 className="mb-1 font-display text-sm font-bold">Grupos reutilizáveis da loja</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Marque os grupos da biblioteca que devem aparecer neste produto. Crie ou edite grupos na aba
                <strong> Adicionais</strong> do catálogo.
              </p>
              <ProductAddonGroupsLinker storeId={storeId} productId={form.id} />
            </section>
            <section>
              <h3 className="mb-1 font-display text-sm font-bold">Grupos exclusivos deste produto</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Use apenas se este produto tem opções específicas (ex: ponto da carne) que não fazem sentido
                reutilizar em outros itens.
              </p>
              <AddonGroupsEditor productId={form.id} />
            </section>
          </div>
        )}

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-card/95 p-5 backdrop-blur">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          {tab === "info" && (
            <Button onClick={() => handleSave().then((id) => id && onClose())} disabled={saving} className="gradient-primary font-bold">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? "Salvar alterações" : "Criar produto"}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="mb-1.5 block text-xs font-bold uppercase text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

const Toggle = ({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label
    className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-smooth ${
      checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </div>
    <span className="text-[11px] text-muted-foreground">{desc}</span>
  </label>
);
