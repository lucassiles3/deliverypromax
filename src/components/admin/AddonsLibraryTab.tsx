import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, Loader2, X, Check, Search, Package, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveAsset } from "@/lib/assetMap";

type AddonItem = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  track_stock: boolean;
  stock: number | null;
  active: boolean;
  position: number;
};

type AddonGroup = {
  id: string;
  store_id: string | null;
  product_id: string | null;
  name: string;
  type: "single" | "multi";
  required: boolean;
  min_select: number;
  max_select: number | null;
  position: number;
};

type GroupItem = { id: string; group_id: string; item_id: string; position: number; price_override: number | null };

export const AddonsLibraryTab = ({ storeId }: { storeId: string }) => {
  const [section, setSection] = useState<"items" | "groups">("items");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-display text-base font-bold">Adicionais</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Crie uma biblioteca de itens adicionais (ex: bacon, borda recheada, granola, embalagem para presente)
          e organize em grupos reutilizáveis que podem ser vinculados a vários produtos do catálogo.
        </p>
        <div className="mt-3 flex gap-1 rounded-xl bg-muted p-1">
          <button
            onClick={() => setSection("items")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-smooth ${
              section === "items" ? "bg-background shadow" : "text-muted-foreground"
            }`}
          >
            <Package className="h-4 w-4" /> Itens
          </button>
          <button
            onClick={() => setSection("groups")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-smooth ${
              section === "groups" ? "bg-background shadow" : "text-muted-foreground"
            }`}
          >
            <Layers className="h-4 w-4" /> Grupos
          </button>
        </div>
      </div>

      {section === "items" ? <ItemsSection storeId={storeId} /> : <GroupsSection storeId={storeId} />}
    </div>
  );
};

// ============================ ITEMS ============================

const ItemsSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AddonItem | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["addon-items", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_items")
        .select("*")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as AddonItem[];
    },
  });

  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  const toggleActive = async (it: AddonItem) => {
    const { error } = await supabase.from("addon_items").update({ active: !it.active }).eq("id", it.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["addon-items", storeId] });
  };

  const remove = async (it: AddonItem) => {
    if (!confirm(`Excluir "${it.name}"? Ele será removido de todos os grupos.`)) return;
    const { error } = await supabase.from("addon_items").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    toast.success("Item excluído");
    qc.invalidateQueries({ queryKey: ["addon-items", storeId] });
    qc.invalidateQueries({ queryKey: ["addon-group-items", storeId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 shadow-soft">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item adicional..."
            className="w-full rounded-lg border-2 bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <Button onClick={() => setCreating(true)} size="sm" className="gradient-primary font-bold">
          <Plus className="mr-1 h-4 w-4" /> Novo item
        </Button>
      </div>

      <div className="rounded-2xl bg-card shadow-soft">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhum item ainda. Crie o primeiro adicional (ex: Bacon, Queijo extra, Granola...).
          </p>
        ) : (
          <ul>
            {filtered.map((it) => {
              const isOut = it.track_stock && (it.stock ?? 0) <= 0;
              return (
                <li
                  key={it.id}
                  className={`flex items-center gap-3 border-b px-4 py-3 last:border-b-0 ${
                    !it.active ? "opacity-50" : ""
                  }`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {it.image_url ? (
                      <img src={resolveAsset(it.image_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="truncate text-sm">{it.name}</strong>
                      {!it.active && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">inativo</span>
                      )}
                      {isOut && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                          esgotado
                        </span>
                      )}
                    </div>
                    {it.description && (
                      <div className="truncate text-[11px] text-muted-foreground">{it.description}</div>
                    )}
                    <div className="text-xs font-bold text-primary">
                      R$ {Number(it.price).toFixed(2).replace(".", ",")}
                      {it.track_stock && (
                        <span className="ml-2 font-normal text-muted-foreground">• estoque: {it.stock ?? 0}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(it)}
                    className="rounded-lg border-2 px-2 py-1 text-[11px] font-bold hover:bg-muted"
                    title={it.active ? "Desativar" : "Ativar"}
                  >
                    {it.active ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    onClick={() => setEditing(it)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(it)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(editing || creating) && (
        <ItemFormModal
          storeId={storeId}
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["addon-items", storeId] })}
        />
      )}
    </div>
  );
};

const ItemFormModal = ({
  storeId,
  initial,
  onClose,
  onSaved,
}: {
  storeId: string;
  initial: AddonItem | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);
  const [trackStock, setTrackStock] = useState(!!initial?.track_stock);
  const [stock, setStock] = useState<number>(initial?.stock ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem maior que 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${storeId}/addons/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const payload = {
      store_id: storeId,
      name: name.trim().slice(0, 60),
      description: description?.trim().slice(0, 200) || null,
      price: Math.max(0, Number(price) || 0),
      image_url: imageUrl,
      track_stock: trackStock,
      stock: trackStock ? Math.max(0, Number(stock) || 0) : null,
      active,
    };
    const { error } = initial
      ? await supabase.from("addon_items").update(payload).eq("id", initial.id)
      : await supabase.from("addon_items").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Item atualizado" : "Item criado");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b p-4">
          <h3 className="font-display text-lg font-bold">{initial ? "Editar item" : "Novo item adicional"}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-muted-foreground">Foto</label>
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-dashed bg-muted">
                {imageUrl ? (
                  <img src={resolveAsset(imageUrl)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    Sem foto
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
                  {uploading ? "Enviando..." : "Enviar foto"}
                </Button>
                {imageUrl && (
                  <button
                    onClick={() => setImageUrl(null)}
                    className="text-left text-[11px] text-destructive hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Nome *</label>
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
              placeholder="Ex: Bacon extra"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Descrição</label>
            <input
              value={description ?? ""}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Preço (R$)</label>
              <input
                type="number"
                min={0}
                step="0.10"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full rounded-lg border-2 bg-background px-3 py-2 font-bold outline-none focus:border-primary"
              />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-bold">Ativo</span>
            </label>
          </div>

          <div className="rounded-xl border-2 border-dashed p-3">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
                className="h-4 w-4"
              />
              Controlar estoque
            </label>
            {trackStock && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Quantidade</label>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="w-32 rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Quando chegar a 0, aparecerá como "esgotado" para o cliente.
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t bg-card/95 p-4 backdrop-blur">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="gradient-primary font-bold">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </footer>
      </div>
    </div>
  );
};

// ============================ GROUPS ============================

const GroupsSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AddonGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["addon-groups-store", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("id, store_id, product_id, name, type, required, min_select, max_select, position")
        .eq("store_id", storeId)
        .is("product_id", null)
        .order("position");
      if (error) throw error;
      return (data ?? []) as AddonGroup[];
    },
  });

  const remove = async (g: AddonGroup) => {
    if (!confirm(`Excluir grupo "${g.name}"? Será desvinculado de todos os produtos.`)) return;
    const { error } = await supabase.from("addon_groups").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Grupo excluído");
    qc.invalidateQueries({ queryKey: ["addon-groups-store", storeId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} size="sm" className="gradient-primary font-bold">
          <Plus className="mr-1 h-4 w-4" /> Novo grupo
        </Button>
      </div>

      <div className="rounded-2xl bg-card shadow-soft">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : groups.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhum grupo. Crie um grupo (ex: "Adicionais", "Escolha sua borda") e adicione itens da biblioteca.
          </p>
        ) : (
          <ul>
            {groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                onEdit={() => setEditing(g)}
                onRemove={() => remove(g)}
              />
            ))}
          </ul>
        )}
      </div>

      {(editing || creating) && (
        <GroupFormModal
          storeId={storeId}
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["addon-groups-store", storeId] });
          }}
        />
      )}
    </div>
  );
};

const GroupRow = ({
  group,
  onEdit,
  onRemove,
}: {
  group: AddonGroup;
  onEdit: () => void;
  onRemove: () => void;
}) => {
  const { data: stats } = useQuery({
    queryKey: ["addon-group-stats", group.id],
    queryFn: async () => {
      const [{ count: itemCount }, { count: productCount }] = await Promise.all([
        supabase.from("addon_group_items").select("id", { head: true, count: "exact" }).eq("group_id", group.id),
        supabase
          .from("product_addon_groups")
          .select("id", { head: true, count: "exact" })
          .eq("group_id", group.id),
      ]);
      return { itemCount: itemCount ?? 0, productCount: productCount ?? 0 };
    },
  });

  return (
    <li className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="text-sm">{group.name}</strong>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
            {group.type === "single" ? "Escolha 1" : "Múltipla"}
          </span>
          {group.required && (
            <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
              Obrigatório
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {stats?.itemCount ?? 0} item(s) • vinculado a {stats?.productCount ?? 0} produto(s)
        </div>
      </div>
      <button onClick={onEdit} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={onRemove} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
};

const GroupFormModal = ({
  storeId,
  initial,
  onClose,
  onSaved,
}: {
  storeId: string;
  initial: AddonGroup | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<"single" | "multi">(initial?.type ?? "multi");
  const [minSelect, setMinSelect] = useState<number>(initial?.min_select ?? 0);
  const [maxSelect, setMaxSelect] = useState<number | null>(initial?.max_select ?? null);
  const [groupId, setGroupId] = useState<string | null>(initial?.id ?? null);
  const [saving, setSaving] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["addon-items", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("addon_items")
        .select("*")
        .eq("store_id", storeId)
        .eq("active", true)
        .order("name");
      return (data ?? []) as AddonItem[];
    },
  });

  const { data: links = [], refetch: refetchLinks } = useQuery({
    queryKey: ["addon-group-items", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data } = await supabase
        .from("addon_group_items")
        .select("id, group_id, item_id, position, price_override")
        .eq("group_id", groupId!)
        .order("position");
      return (data ?? []) as GroupItem[];
    },
  });

  const linkedIds = new Set(links.map((l) => l.item_id));

  const ensureGroupSaved = async (): Promise<string | null> => {
    if (groupId && !initial?.id) return groupId;
    if (initial?.id) {
      const { error } = await supabase
        .from("addon_groups")
        .update({
          name: name.trim() || "Adicionais",
          type,
          required: minSelect > 0,
          min_select: minSelect,
          max_select: type === "single" ? 1 : maxSelect,
        })
        .eq("id", initial.id);
      if (error) {
        toast.error(error.message);
        return null;
      }
      return initial.id;
    }
    if (!name.trim()) {
      toast.error("Dê um nome ao grupo primeiro");
      return null;
    }
    const { data, error } = await supabase
      .from("addon_groups")
      .insert({
        store_id: storeId,
        product_id: null,
        name: name.trim(),
        type,
        required: minSelect > 0,
        min_select: minSelect,
        max_select: type === "single" ? 1 : maxSelect,
        position: 0,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    setGroupId(data.id);
    return data.id;
  };

  const toggleItem = async (itemId: string) => {
    const gid = await ensureGroupSaved();
    if (!gid) return;
    if (linkedIds.has(itemId)) {
      const link = links.find((l) => l.item_id === itemId);
      if (!link) return;
      const { error } = await supabase.from("addon_group_items").delete().eq("id", link.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("addon_group_items")
        .insert({ group_id: gid, item_id: itemId, position: links.length });
      if (error) return toast.error(error.message);
    }
    refetchLinks();
  };

  const saveAndClose = async () => {
    setSaving(true);
    const gid = await ensureGroupSaved();
    setSaving(false);
    if (!gid) return;
    toast.success(initial ? "Grupo atualizado" : "Grupo criado");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b p-4">
          <h3 className="font-display text-lg font-bold">{initial ? "Editar grupo" : "Novo grupo"}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Nome do grupo *</label>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border-2 bg-background px-3 py-2 outline-none focus:border-primary"
                placeholder='Ex: "Adicionais", "Escolha sua borda"'
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => {
                    const v = e.target.value as "single" | "multi";
                    setType(v);
                    if (v === "single") setMaxSelect(1);
                  }}
                  className="w-full rounded-lg border-2 bg-background px-2 py-2 text-sm"
                >
                  <option value="single">Escolha 1</option>
                  <option value="multi">Múltipla</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Mínimo</label>
                <input
                  type="number"
                  min={0}
                  value={minSelect}
                  onChange={(e) => setMinSelect(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border-2 bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Máximo</label>
                <input
                  type="number"
                  min={1}
                  disabled={type === "single"}
                  value={maxSelect ?? ""}
                  onChange={(e) => setMaxSelect(e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-lg border-2 bg-background px-3 py-2 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold">Itens deste grupo</h4>
                {!groupId && !initial && (
                  <span className="text-[11px] text-muted-foreground">Salve o nome para começar a vincular</span>
                )}
              </div>
              {items.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
                  Nenhum item na biblioteca. Vá em "Itens" e crie alguns adicionais primeiro.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((it) => {
                    const linked = linkedIds.has(it.id);
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => toggleItem(it.id)}
                        className={`flex items-center gap-3 rounded-xl border-2 p-2 text-left transition-smooth ${
                          linked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {it.image_url ? (
                            <img src={resolveAsset(it.image_url)} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">{it.name}</div>
                          <div className="text-[11px] text-primary">
                            +R$ {Number(it.price).toFixed(2).replace(".", ",")}
                          </div>
                        </div>
                        {linked && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t bg-card/95 p-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          <Button onClick={saveAndClose} disabled={saving} className="gradient-primary font-bold">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </footer>
      </div>
    </div>
  );
};
