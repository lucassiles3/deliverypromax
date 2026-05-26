import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Star, Flame, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreBySlug } from "@/hooks/useStores";
import { useCart, type CartCustomization } from "@/context/CartContext";
import type { AddonGroup, AddonOption } from "@/data/stores";
import { FavoriteProductButton } from "@/components/FavoriteButton";

const Product = () => {
  const { slug = "", productId = "" } = useParams();
  const navigate = useNavigate();
  const { data: store, isLoading } = useStoreBySlug(slug);
  const { addCustom } = useCart();

  const product = useMemo(
    () => store?.products.find((p) => p.id === productId) ?? null,
    [store, productId],
  );

  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [picks, setPicks] = useState<Record<string, AddonOption[]>>({});

  const groups = product?.addonGroups ?? [];

  useEffect(() => {
    document.title = product ? `${product.name} • ${store?.name ?? "Itchat Brasil"}` : "Produto";
    window.scrollTo({ top: 0 });
  }, [product, store]);

  if (isLoading) return <div className="min-h-screen" />;
  if (!store) return <Navigate to="/" replace />;
  if (!product) return <Navigate to={`/loja/${slug}`} replace />;

  const setSingle = (g: AddonGroup, opt: AddonOption) =>
    setPicks((p) => ({ ...p, [g.id]: [opt] }));

  const toggleMulti = (g: AddonGroup, opt: AddonOption) =>
    setPicks((p) => {
      const cur = p[g.id] ?? [];
      const has = cur.find((o) => o.id === opt.id);
      let next: AddonOption[];
      if (has) next = cur.filter((o) => o.id !== opt.id);
      else if (g.max && cur.length >= g.max) next = cur;
      else next = [...cur, opt];
      return { ...p, [g.id]: next };
    });

  const addonsTotal = Object.values(picks).flat().reduce((s, o) => s + o.price, 0);
  const unitPrice = product.price + addonsTotal;
  const requiredOk = groups.every((g) => !g.required || (picks[g.id]?.length ?? 0) > 0);

  const submit = () => {
    if (!requiredOk) return;
    const customizations: CartCustomization[] = groups
      .filter((g) => (picks[g.id]?.length ?? 0) > 0)
      .map((g) => ({
        groupId: g.id,
        groupName: g.name,
        selections: picks[g.id]!.filter((o) => o.price > 0 || g.type === "single"),
      }))
      .filter((c) => c.selections.length > 0);
    addCustom(product, store.slug, customizations, qty, notes.trim() || undefined);
    navigate(`/loja/${store.slug}`);
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Hero image - sempre quadrada (1:1) em todos os dispositivos */}
      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden bg-muted md:max-w-lg">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 shadow-card backdrop-blur transition-bounce hover:scale-110"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute right-4 top-4">
          <FavoriteProductButton productId={product.id} storeId={store.id} />
        </div>
        {product.bestseller && (
          <div className="absolute left-4 bottom-6 flex items-center gap-1 rounded-full bg-foreground/85 px-3 py-1 text-xs font-bold text-background backdrop-blur">
            <Flame className="h-3.5 w-3.5 text-accent" /> Mais pedido
          </div>
        )}
      </div>

      <div className="container -mt-4 max-w-2xl">
        <div className="rounded-3xl bg-card p-5 shadow-float md:p-7">
          <Link
            to={`/loja/${store.slug}`}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {store.name}
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">{product.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-accent text-accent" />
            <span className="font-semibold text-foreground">{product.rating}</span>
            <span>• {product.reviews} avaliações</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">{product.description}</p>

          <div className="mt-4 flex items-end gap-2">
            {product.oldPrice && (
              <span className="text-sm text-muted-foreground line-through">
                R$ {product.oldPrice.toFixed(2).replace(".", ",")}
              </span>
            )}
            <span className={`font-display text-3xl font-bold ${product.promo ? "text-secondary" : "text-primary"}`}>
              R$ {product.price.toFixed(2).replace(".", ",")}
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {groups.map((g) => (
              <section key={g.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-base font-bold">{g.name}</h3>
                  {g.required ? (
                    <span className="rounded-md bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
                      Obrigatório
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Opcional</span>
                  )}
                </div>
                <div className="space-y-2">
                  {g.options.map((opt) => {
                    const checked = !!picks[g.id]?.find((o) => o.id === opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-smooth ${
                          checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type={g.type === "single" ? "radio" : "checkbox"}
                            name={g.id}
                            checked={checked}
                            onChange={() =>
                              g.type === "single" ? setSingle(g, opt) : toggleMulti(g, opt)
                            }
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-sm font-medium">{opt.name}</span>
                        </div>
                        {opt.price > 0 && (
                          <span className="text-sm font-bold text-primary">
                            +R$ {opt.price.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}

            <section>
              <h3 className="mb-2 font-display text-base font-bold">Alguma observação?</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                placeholder="Ex: sem cebola, ponto da carne..."
                className="w-full resize-none rounded-xl border-2 border-border bg-background p-3 text-sm outline-none transition-smooth focus:border-primary"
                rows={3}
              />
              <div className="mt-1 text-right text-[10px] text-muted-foreground">{notes.length}/200</div>
            </section>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 backdrop-blur-xl md:bottom-0">
        <div className="container flex max-w-2xl items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border bg-background p-1">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Diminuir"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-7 text-center text-sm font-bold">{qty}</span>
            <button
              onClick={() => setQty(qty + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="Aumentar"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button
            disabled={!requiredOk}
            onClick={submit}
            className="h-12 flex-1 rounded-xl gradient-primary text-sm font-bold shadow-glow transition-bounce hover:scale-[1.01] disabled:opacity-50"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {requiredOk
              ? `Adicionar • R$ ${(unitPrice * qty).toFixed(2).replace(".", ",")}`
              : "Escolha as opções obrigatórias"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Product;
