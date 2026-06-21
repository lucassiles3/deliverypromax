// Link removed — cards are now non-clickable images
import { Star, Flame, Plus } from "lucide-react";
import type { Store, Product } from "@/data/stores";
import { useCart } from "@/context/CartContext";
import { toast } from "@/hooks/use-toast";

type ProductWithStore = Product & { _store: Store };

export const ProductRail = ({
  title,
  subtitle,
  products,
}: {
  title: string;
  subtitle?: string;
  products: ProductWithStore[];
}) => {
  const { add } = useCart();

  if (products.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-bold md:text-2xl">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
        {products.map((p) => {
          const catalogMode = !!(p._store as any).catalogMode;
          return (
          <div
            key={`${p._store.id}-${p.id}`}
            className="group relative w-[60%] shrink-0 snap-start overflow-hidden rounded-3xl bg-card shadow-card transition-smooth hover:-translate-y-1 hover:shadow-float sm:w-[42%] md:w-[30%] lg:w-[22%]"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden">
              <img
                src={p.image}
                alt={p.name}
                loading="lazy"
                className="h-full w-full object-cover transition-bounce group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/30 to-transparent" />

              <div className="absolute left-2 top-2 flex flex-col gap-1">
                {p.promo && p.oldPrice && (
                  <span className="flex items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground shadow-soft">
                    <Flame className="h-3 w-3" />
                    -{Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)}%
                  </span>
                )}
                {p.bestseller && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground shadow-soft">
                    🔥 Top
                  </span>
                )}
              </div>

              <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-bold backdrop-blur">
                <Star className="h-3 w-3 fill-accent text-accent" />
                {p.rating.toFixed(1)}
              </div>

              <div className="absolute inset-x-0 bottom-0 p-3 text-background">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-base leading-none">{p._store.logo}</span>
                  <span className="line-clamp-1 text-[10px] font-semibold uppercase tracking-wide opacity-90">
                    {p._store.name}
                  </span>
                </div>
                <h3 className="font-display line-clamp-1 text-base font-bold leading-tight">
                  {p.name}
                </h3>
                <div className="mt-1.5 flex items-end justify-between">
                  <div>
                    {p.oldPrice && (
                      <div className="text-[10px] line-through opacity-70">
                        R$ {p.oldPrice.toFixed(2).replace(".", ",")}
                      </div>
                    )}
                    <div className="font-display text-lg font-bold leading-none">
                      R$ {p.price.toFixed(2).replace(".", ",")}
                    </div>
                  </div>
                  {!catalogMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const hasRequired = (p.addonGroups ?? []).some((g) => g.required);
                        if (hasRequired) {
                          window.location.href = `/loja/${p._store.slug}/produto/${p.id}`;
                          return;
                        }
                        add(p, p._store.slug);
                        toast({ title: "Adicionado ao carrinho", description: p.name });
                      }}
                      aria-label={`Adicionar ${p.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow transition-bounce hover:scale-110 active:scale-95"
                    >
                      <Plus className="h-4 w-4" strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
};
