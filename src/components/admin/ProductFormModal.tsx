import { useEffect, useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveAsset } from "@/lib/assetMap";

export type ProductFormData = {
  id?: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  old_price: number | null;
  image_url: string | null;
  active: boolean;
  bestseller: boolean;
  promo: boolean;
  track_stock: boolean;
  stock: number | null;
};

const empty: ProductFormData = {
  name: "",
  category: "",
  description: "",
  price: 0,
  old_price: null,
  image_url: null,
  active: true,
  bestseller: false,
  promo: false,
  track_stock: false,
  stock: null,
};

export const ProductFormModal = ({
  open,
  initial,
  storeId,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: ProductFormData | null;
  storeId: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState<ProductFormData>(initial ?? empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(initial ?? empty);
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

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (form.price <= 0) return toast.error("Preço deve ser maior que zero");

    setSaving(true);
    const payload = {
      store_id: storeId,
      name: form.name.trim(),
      category: form.category?.trim() || null,
      description: form.description?.trim() || null,
      price: form.price,
      old_price: form.old_price && form.old_price > 0 ? form.old_price : null,
      image_url: form.image_url,
      active: form.active,
      bestseller: form.bestseller,
      promo: form.promo,
      track_stock: form.track_stock,
      stock: form.track_stock ? (form.stock ?? 0) : null,
    };

    const { error } = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Produto atualizado!" : "Produto criado!");
    onSaved();
    onClose();
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
        <header className="sticky top-0 flex items-center justify-between border-b bg-card/95 p-5 backdrop-blur">
          <h2 className="font-display text-xl font-bold">
            {form.id ? "Editar produto" : "Novo produto"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

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
              </div>
            </div>
          </div>

          {/* Nome / Categoria */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome *">
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                placeholder="Ex: X-Burger Especial"
              />
            </Field>
            <Field label="Categoria">
              <input
                value={form.category ?? ""}
                onChange={(e) => update("category", e.target.value)}
                className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                placeholder="Ex: Lanches"
              />
            </Field>
          </div>

          <Field label="Descrição">
            <textarea
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
              placeholder="Pão brioche, blend 180g, queijo cheddar..."
            />
          </Field>

          {/* Preços */}
          <div className="grid gap-3 sm:grid-cols-2">
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
            <Field label="Preço antigo (R$)">
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
                  Quando chegar a 0, o produto fica como esgotado automaticamente.
                </p>
              </div>
            )}
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => update("active", e.target.checked)}
                className="h-4 w-4"
              />
              Ativo (vísivel pro cliente)
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.bestseller}
                onChange={(e) => update("bestseller", e.target.checked)}
                className="h-4 w-4"
              />
              Mais vendido
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.promo}
                onChange={(e) => update("promo", e.target.checked)}
                className="h-4 w-4"
              />
              Em promoção
            </label>
          </div>
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-card/95 p-5 backdrop-blur">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-primary font-bold">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {form.id ? "Salvar alterações" : "Criar produto"}
          </Button>
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
