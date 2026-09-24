import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingBag,
  Store as StoreIcon,
  Flame,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHomeProducts } from "@/hooks/useHomeProducts";

const SEGMENT_OPTIONS = [
  { key: "all", label: "Todos", emoji: "✨" },
  { key: "pizzaria", label: "Pizzaria", emoji: "🍕" },
  { key: "hamburgueria", label: "Hamburgueria", emoji: "🍔" },
  { key: "lanchonete", label: "Lanchonete", emoji: "🥪" },
  { key: "japonesa", label: "Japonesa", emoji: "🍣" },
  { key: "confeitaria", label: "Confeitaria", emoji: "🍦" },
  { key: "restaurante", label: "Restaurante", emoji: "🍽️" },
  { key: "marmitaria", label: "Marmitaria", emoji: "🍲" },
  { key: "quentinhas", label: "Quentinhas", emoji: "🍱" },
  { key: "a lacarte", label: "À La Carte", emoji: "🥩" },
];

export const HomeProductsShowcase = () => {
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const { products, hasMore, isLoading, isFetching, loadMore, refetch } = useHomeProducts({
    pageSize: 10,
    segment: selectedSegment === "all" ? null : selectedSegment,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const formatPrice = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const calculateDiscountPercent = (promo: number, old?: number | null) => {
    if (!old || old <= promo) return null;
    const pct = Math.round(((old - promo) / old) * 100);
    return pct > 0 ? `-${pct}%` : null;
  };

  const handleCardClick = (link: string, e: React.MouseEvent) => {
    if (link.startsWith("http://") || link.startsWith("https://")) {
      e.preventDefault();
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section className="my-6 sm:my-8 w-full">
      {/* Header & Filters (No background, seamlessly integrated) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between px-0">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
            <Flame className="h-3.5 w-3.5" />
            Ofertas em Destaque
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Direto dos Lojistas 🛍️
          </h2>
        </div>

        {/* Filter Pills — Matches the exact UI of Index.tsx subcategories */}
        <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-2 pt-1 -mx-4 px-4 md:mx-0 md:px-0">
          {SEGMENT_OPTIONS.map((seg) => {
            const active = selectedSegment === seg.key;
            return (
              <button
                key={seg.key}
                id={`home-product-seg-${seg.key}`}
                onClick={() => setSelectedSegment(seg.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-smooth ${
                  active
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {seg.emoji && <span>{seg.emoji}</span>}
                {seg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="my-10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="my-6 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center mx-0">
          <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h3 className="mt-2 font-display text-sm font-bold text-foreground">
            Nenhum produto encontrado nesta categoria
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tente selecionar outro segmento ou visualize todos.
          </p>
          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => setSelectedSegment("all")}
              size="sm"
              className="h-9 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground"
            >
              Ver Todas as Ofertas
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 w-full -mx-4 sm:mx-0 sm:w-auto">
          {/* Row ListView */}
          <div
            ref={scrollRef}
            className="scrollbar-hide flex w-full h-[320px] sm:h-[340px] snap-x snap-mandatory flex-row items-stretch gap-3.5 overflow-x-auto px-4 pb-4 pt-1 sm:px-0"
          >
            {products.map((item) => {
              const discountTag = calculateDiscountPercent(item.promo_price, item.old_price);

              return (
                <Link
                  key={item.id}
                  to={item.product_link}
                  onClick={(e) => handleCardClick(item.product_link, e)}
                  className="group relative flex w-[160px] sm:w-[170px] shrink-0 snap-center sm:snap-start flex-col justify-between overflow-hidden rounded-[20px] border border-border/60 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-float active:scale-[0.98]"
                >
                  <div className="flex flex-col h-full">
                    {/* Top: Image Container */}
                    <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground text-xs font-medium">
                          Sem imagem
                        </div>
                      )}

                      {/* Discount Badge */}
                      {discountTag && (
                        <div className="absolute top-2 left-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-primary-foreground shadow-sm">
                          {discountTag}
                        </div>
                      )}
                    </div>

                    {/* Middle: Texts */}
                    <div className="flex flex-1 flex-col justify-between p-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                          <StoreIcon className="h-3 w-3 shrink-0 text-primary/70" />
                          <span className="truncate">{item.store_name}</span>
                        </div>
                        <h3 className="font-display text-sm font-bold leading-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {item.product_name}
                        </h3>
                        {item.description && (
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground/80 line-clamp-2 leading-tight mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Bottom: Prices */}
                      <div className="mt-2 pt-2 border-t border-border/40 flex items-end justify-between">
                        <div className="flex flex-col items-start leading-none gap-0.5">
                          {item.old_price && item.old_price > item.promo_price ? (
                            <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground line-through opacity-70 decoration-muted-foreground/50">
                              {formatPrice(item.old_price)}
                            </span>
                          ) : (
                            <span className="h-[12px]" />
                          )}
                          <span className="font-display text-[15px] sm:text-[16px] font-extrabold text-primary">
                            {formatPrice(item.promo_price)}
                          </span>
                        </div>

                        <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Load More Card */}
            {hasMore && (
              <div className="flex w-[130px] shrink-0 snap-center items-center justify-center py-4">
                <button
                  onClick={() => {
                    loadMore();
                    setTimeout(() => {
                      if (scrollRef.current) {
                        scrollRef.current.scrollBy({ left: 160, behavior: "smooth" });
                      }
                    }, 100);
                  }}
                  disabled={isFetching}
                  className="group flex h-[120px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary transition-all hover:border-primary/60 hover:bg-primary/10 disabled:opacity-50"
                >
                  {isFetching ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 transition-transform group-hover:scale-110">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                      <span className="mt-2 text-[11px] font-bold text-center px-2">Ver mais<br/>ofertas</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* End spacer */}
            <div className="w-1 shrink-0" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
};

