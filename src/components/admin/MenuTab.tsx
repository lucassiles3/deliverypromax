import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Pause,
  Play,
  Search,
  Copy,
  Archive,
  Star,
  GripVertical,
  Trash2,
  ArrowRightLeft,
  Tag,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveAsset } from "@/lib/assetMap";
import { ProductFormModal, ProductFormData } from "./ProductFormModal";
import { AddonsLibraryTab } from "./AddonsLibraryTab";
import { PublicLinkCard } from "./StoreSettingsTab";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Category = { id: string; name: string; position: number; active: boolean };

type Product = {
  id: string;
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
  archived_at: string | null;
  position: number | null;
  order_count?: number;
};

export const MenuTab = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductFormData | null>(null);
  const [movingProduct, setMovingProduct] = useState<Product | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [view, setView] = useState<"products" | "addons">("products");
  // Loja (slug + name) para o card de link público do catálogo
  const { data: storeInfo } = useQuery({
    queryKey: ["menu-store-info", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("slug, name")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data as { slug: string | null; name: string | null } | null;
    },
  });


  // Categorias
  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, position, active")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  // Produtos
  const { data: products = [] } = useQuery({
    queryKey: ["menu-products", storeId, showArchived],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, category, category_id, description, price, old_price, image_url, active, bestseller, is_new, promo, track_stock, stock, prep_time_min, promo_starts_at, promo_ends_at, archived_at, position"
        )
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      const filtered = (data ?? []).filter((p) =>
        showArchived ? !!p.archived_at : !p.archived_at
      );
      return filtered as Product[];
    },
  });

  // Contagem de pedidos por produto
  const { data: orderCounts = {} } = useQuery({
    queryKey: ["menu-order-counts", storeId],
    enabled: !!storeId && products.length > 0,
    queryFn: async () => {
      const ids = products.map((p) => p.id);
      const { data } = await supabase
        .from("order_items")
        .select("product_id")
        .in("product_id", ids);
      const map: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        if (row.product_id) map[row.product_id] = (map[row.product_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, search]);

  // Agrupar por categoria
  const grouped = useMemo(() => {
    const map = new Map<string, { cat: Category | null; items: Product[] }>();
    categories.forEach((c) => map.set(c.id, { cat: c, items: [] }));
    map.set("__none__", { cat: null, items: [] });
    filtered.forEach((p) => {
      const key = p.category_id && map.has(p.category_id) ? p.category_id : "__none__";
      map.get(key)!.items.push(p);
    });
    return Array.from(map.values()).filter((g) => g.items.length > 0 || g.cat);
  }, [filtered, categories]);

  // Ações
  const togglePause = async (p: Product) => {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.active ? "Produto pausado" : "Produto ativo");
    qc.invalidateQueries({ queryKey: ["menu-products", storeId] });
  };

  const updatePrice = async (id: string, price: number) => {
    const { error } = await supabase.from("products").update({ price }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["menu-products", storeId] });
  };

  const updateStock = async (id: string, stock: number) => {
    const { error } = await supabase.from("products").update({ stock }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["menu-products", storeId] });
  };

  const togglePromo = async (p: Product) => {
    const { error } = await supabase.from("products").update({ promo: !p.promo }).eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["menu-products", storeId] });
  };

  const duplicate = async (p: Product) => {
    const { id, position, ...rest } = p as any;
    const payload = {
      ...rest,
      name: `${p.name} (cópia)`,
      store_id: storeId,
      archived_at: null,
      active: false,
      order_count: undefined,
    };
    delete payload.order_count;
    const { error } = await supabase.from("products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Produto duplicado");
    qc.invalidateQueries({ queryKey: ["menu-products", storeId] });
  };

  const archive = async (p: Product) => {
    const archive_now = !p.archived_at;
    const { error } = await supabase
      .from("products")
      .update({ archived_at: archive_now ? new Date().toISOString() : null, active: !archive_now })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(archive_now ? "Produto arquivado" : "Produto restaurado");
    qc.invalidateQueries({ queryKey: ["menu-products", storeId] });
  };

  const moveCategory = async (newCatId: string | null) => {
    if (!movingProduct) return;
    const cat = categories.find((c) => c.id === newCatId);
    const { error } = await supabase
      .from("products")
      .update({ category_id: newCatId, category: cat?.name ?? null })
      .eq("id", movingProduct.id);
    if (error) return toast.error(error.message);
    toast.success("Categoria atualizada");
    setMovingProduct(null);
    qc.invalidateQueries({ queryKey: ["menu-products", storeId] });
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing({
      id: p.id,
      name: p.name,
      category: p.category,
      category_id: p.category_id,
      description: p.description,
      price: Number(p.price),
      old_price: p.old_price !== null ? Number(p.old_price) : null,
      image_url: p.image_url,
      active: p.active,
      bestseller: p.bestseller,
      is_new: p.is_new ?? false,
      promo: p.promo,
      track_stock: !!p.track_stock,
      stock: p.stock,
      prep_time_min: p.prep_time_min,
      promo_starts_at: p.promo_starts_at,
      promo_ends_at: p.promo_ends_at,
    });
    setModalOpen(true);
  };

  const onProductDragEnd = async (catItems: Product[], e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = catItems.findIndex((p) => p.id === active.id);
    const newIdx = catItems.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(catItems, oldIdx, newIdx);
    // Optimistic update via cache
    qc.setQueryData(["menu-products", storeId, showArchived], (old: Product[] | undefined) => {
      if (!old) return old;
      const ids = reordered.map((p) => p.id);
      return [...old].sort((a, b) => {
        const ai = ids.indexOf(a.id);
        const bi = ids.indexOf(b.id);
        if (ai === -1 && bi === -1) return (a.position ?? 0) - (b.position ?? 0);
        if (ai === -1) return -1;
        if (bi === -1) return 1;
        return ai - bi;
      });
    });
    await Promise.all(
      reordered.map((p, i) => supabase.from("products").update({ position: i }).eq("id", p.id))
    );
    qc.invalidateQueries({ queryKey: ["menu-products", storeId] });
  };

  return (
    <div className="space-y-4">
      <PublicLinkCard
        storeId={storeId}
        slug={storeInfo?.slug ?? undefined}
        name={storeInfo?.name ?? undefined}
        title="Link público do catálogo"
        description="Compartilhe o catálogo digital da loja — copie ou envie pelo WhatsApp."
      />

      <div className="flex gap-1 rounded-xl bg-muted p-1">
        <button
          onClick={() => setView("products")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-smooth ${
            view === "products" ? "bg-background shadow" : "text-muted-foreground"
          }`}
        >
          Produtos
        </button>
        <button
          onClick={() => setView("addons")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-smooth ${
            view === "addons" ? "bg-background shadow" : "text-muted-foreground"
          }`}
        >
          Adicionais
        </button>
      </div>

      {view === "addons" && <AddonsLibraryTab storeId={storeId} />}

      {view === "products" && (<>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 shadow-soft">

        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto ou categoria..."
            className="w-full rounded-lg border-2 bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-smooth ${
            showArchived
              ? "border-primary bg-primary/5 text-primary"
              : "border-border bg-background text-muted-foreground"
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          {showArchived ? "Vendo arquivados" : "Mostrar arquivados"}
        </button>
        <Button variant="outline" size="sm" onClick={() => setCatModalOpen(true)}>
          <Tag className="mr-1.5 h-4 w-4" /> Categorias
        </Button>
        <Button onClick={openNew} size="sm" className="gradient-primary font-bold">
          <Plus className="mr-1 h-4 w-4" /> Novo produto
        </Button>
      </div>

      {/* Empty state */}
      {grouped.length === 0 && (
        <div className="rounded-2xl bg-card p-10 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            {showArchived
              ? "Nenhum produto arquivado."
              : "Nenhum produto. Comece criando uma categoria e depois um produto."}
          </p>
        </div>
      )}

      {/* Categorias com produtos */}
      {grouped.map(({ cat, items }) => (
        <section key={cat?.id ?? "none"} className="rounded-2xl bg-card shadow-soft">
          <header className="flex items-center gap-2 border-b px-5 py-3">
            <h3 className="font-display text-base font-bold">
              {cat?.name ?? "Sem categoria"}
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
              {items.length}
            </span>
            {cat && !cat.active && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                inativa
              </span>
            )}
          </header>
          {items.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              Nenhum produto nesta categoria.
            </p>
          ) : (
            <DndContext
              sensors={[]}
              collisionDetection={closestCenter}
              onDragEnd={(e) => onProductDragEnd(items, e)}
            >
              <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <ul>
                  {items.map((p) => (
                    <SortableProductRow
                      key={p.id}
                      p={p}
                      orderCount={orderCounts[p.id] ?? 0}
                      onEdit={() => openEdit(p)}
                      onTogglePause={() => togglePause(p)}
                      onUpdatePrice={(v) => updatePrice(p.id, v)}
                      onUpdateStock={(v) => updateStock(p.id, v)}
                      onTogglePromo={() => togglePromo(p)}
                      onDuplicate={() => duplicate(p)}
                      onArchive={() => archive(p)}
                      onMove={() => setMovingProduct(p)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>
      ))}

      {/* Modais */}
      {storeId && (
        <ProductFormModal
          open={modalOpen}
          initial={editing}
          storeId={storeId}
          categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setModalOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["menu-products", storeId] })}
        />
      )}

      {movingProduct && (
        <MoveCategoryModal
          product={movingProduct}
          categories={categories}
          onClose={() => setMovingProduct(null)}
          onMove={moveCategory}
        />
      )}

      {catModalOpen && (
        <CategoriesModal
          storeId={storeId}
          categories={categories}
          onClose={() => setCatModalOpen(false)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["menu-categories", storeId] })}
        />
      )}
      </>)}
    </div>
  );
};

// ===== Linha do produto com drag =====
const SortableProductRow = ({
  p,
  orderCount,
  onEdit,
  onTogglePause,
  onUpdatePrice,
  onUpdateStock,
  onTogglePromo,
  onDuplicate,
  onArchive,
  onMove,
}: {
  p: Product;
  orderCount: number;
  onEdit: () => void;
  onTogglePause: () => void;
  onUpdatePrice: (v: number) => void;
  onUpdateStock: (v: number) => void;
  onTogglePromo: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onMove: () => void;
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isOut = p.track_stock && (p.stock ?? 0) <= 0;
  const archived = !!p.archived_at;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0 ${
        !p.active && !archived ? "opacity-60" : ""
      }`}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground" title="Arrastar">
        <GripVertical className="h-4 w-4" />
      </button>

      <img
        src={resolveAsset(p.image_url)}
        alt={p.name}
        className="h-12 w-12 rounded-lg object-cover"
      />

      <div className="min-w-[160px] flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <strong className="text-sm">{p.name}</strong>
          {p.bestseller && (
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
              ⭐ Top
            </span>
          )}
          {p.is_new && (
            <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
              ✨ Novo
            </span>
          )}
          {p.promo && (
            <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
              🔥 Destaque
            </span>
          )}
          {archived && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold">arquivado</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>🛒 {orderCount} pedido(s)</span>
          {p.prep_time_min && <span>⏱ {p.prep_time_min}min</span>}
          {isOut && <span className="font-bold text-destructive">Esgotado</span>}
        </div>
      </div>

      {/* Preço inline */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">R$</span>
        <input
          type="number"
          step="0.10"
          defaultValue={Number(p.price)}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (v > 0 && v !== Number(p.price)) onUpdatePrice(v);
          }}
          className="w-20 rounded-md border bg-background px-2 py-1 text-right text-sm font-bold outline-none focus:border-primary"
        />
      </div>

      {/* Estoque inline */}
      {p.track_stock ? (
        <input
          type="number"
          min="0"
          defaultValue={p.stock ?? 0}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (v !== (p.stock ?? 0)) onUpdateStock(v);
          }}
          title="Estoque"
          className={`w-16 rounded-md border bg-background px-2 py-1 text-center text-sm font-bold outline-none focus:border-primary ${
            isOut ? "border-destructive text-destructive" : ""
          }`}
        />
      ) : (
        <span className="w-16 text-center text-xs text-muted-foreground">∞</span>
      )}

      {/* Ações */}
      <div className="flex gap-0.5">
        <IconBtn title="Editar" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          title={p.promo ? "Remover destaque" : "Definir destaque"}
          onClick={onTogglePromo}
          className={p.promo ? "text-amber-600" : ""}
        >
          <Star className="h-4 w-4" fill={p.promo ? "currentColor" : "none"} />
        </IconBtn>
        <IconBtn title={p.active ? "Pausar" : "Ativar"} onClick={onTogglePause}>
          {p.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </IconBtn>
        <IconBtn title="Duplicar" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Mover de categoria" onClick={onMove}>
          <ArrowRightLeft className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          title={archived ? "Restaurar" : "Arquivar"}
          onClick={onArchive}
          className="text-muted-foreground"
        >
          <Archive className="h-4 w-4" />
        </IconBtn>
      </div>
    </li>
  );
};

const IconBtn = ({
  children,
  title,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`rounded-md p-1.5 hover:bg-muted ${className}`}
  >
    {children}
  </button>
);

// ===== Modal: mover categoria =====
const MoveCategoryModal = ({
  product,
  categories,
  onClose,
  onMove,
}: {
  product: Product;
  categories: Category[];
  onClose: () => void;
  onMove: (id: string | null) => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div
      className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="font-display text-lg font-bold">Mover de categoria</h3>
      <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
      <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
        <li>
          <button
            onClick={() => onMove(null)}
            className="w-full rounded-lg border-2 px-3 py-2 text-left text-sm hover:border-primary"
          >
            Sem categoria
          </button>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onMove(c.id)}
              className={`w-full rounded-lg border-2 px-3 py-2 text-left text-sm hover:border-primary ${
                product.category_id === c.id ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

// ===== Modal: gestão de categorias =====
const CategoriesModal = ({
  storeId,
  categories,
  onClose,
  onChanged,
}: {
  storeId: string;
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}) => {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("categories").insert({
      store_id: storeId,
      name: newName.trim(),
      position: categories.length,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setNewName("");
    onChanged();
  };

  const rename = async (id: string, name: string) => {
    const { error } = await supabase.from("categories").update({ name }).eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const toggleActive = async (c: Category) => {
    const { error } = await supabase.from("categories").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover categoria? Os produtos ficarão sem categoria.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIdx, newIdx);
    await Promise.all(
      reordered.map((c, i) => supabase.from("categories").update({ position: i }).eq("id", c.id))
    );
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold">Categorias</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Arraste para reordenar. Categorias inativas não aparecem no formulário.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Nova categoria (ex: Lanches)"
            className="flex-1 rounded-lg border-2 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button onClick={create} disabled={busy} size="sm" className="gradient-primary font-bold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 space-y-1.5">
              {categories.map((c) => (
                <SortableCategoryRow
                  key={c.id}
                  cat={c}
                  onRename={(name) => rename(c.id, name)}
                  onToggleActive={() => toggleActive(c)}
                  onRemove={() => remove(c.id)}
                />
              ))}
              {categories.length === 0 && (
                <li className="rounded-lg border-2 border-dashed py-6 text-center text-sm text-muted-foreground">
                  Nenhuma categoria ainda.
                </li>
              )}
            </ul>
          </SortableContext>
        </DndContext>

        <div className="mt-5 flex justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
};

const SortableCategoryRow = ({
  cat,
  onRename,
  onToggleActive,
  onRemove,
}: {
  cat: Category;
  onRename: (name: string) => void;
  onToggleActive: () => void;
  onRemove: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border bg-background p-2">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        defaultValue={cat.name}
        onBlur={(e) => e.target.value !== cat.name && onRename(e.target.value)}
        className={`flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-primary ${
          !cat.active ? "text-muted-foreground line-through" : ""
        }`}
      />
      <button
        onClick={onToggleActive}
        className="rounded p-1.5 hover:bg-muted"
        title={cat.active ? "Desativar" : "Ativar"}
      >
        {cat.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button onClick={onRemove} className="rounded p-1.5 text-destructive hover:bg-destructive/10">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
};
