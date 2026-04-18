import { Star, Plus, Flame } from "lucide-react";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/data/stores";

export const ProductCard = ({ product, storeSlug }: { product: Product; storeSlug: string }) => {
  const { add } = useCart();

  return (
    <article className="group flex gap-4 rounded-2xl bg-card p-3 shadow-soft transition-smooth hover:shadow-card">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={300}
          height={300}
          className="h-full w-full object-cover transition-bounce group-hover:scale-110"
        />
        {product.bestseller && (
          <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded-md bg-foreground/85 px-1.5 py-0.5 text-[10px] font-bold text-background backdrop-blur">
            <Flame className="h-3 w-3 text-accent" /> Top
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold leading-tight">{product.name}</h3>
          <div className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
            <Star className="h-3 w-3 fill-accent text-accent" />
            {product.rating}
          </div>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            {product.oldPrice && (
              <div className="text-xs text-muted-foreground line-through">
                R$ {product.oldPrice.toFixed(2).replace(".", ",")}
              </div>
            )}
            <div className={`font-display text-lg font-bold ${product.promo ? "text-secondary" : "text-foreground"}`}>
              R$ {product.price.toFixed(2).replace(".", ",")}
            </div>
          </div>
          <button
            onClick={() => add(product, storeSlug)}
            aria-label={`Adicionar ${product.name}`}
            className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow transition-bounce hover:scale-110 active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>
      </div>
    </article>
  );
};
