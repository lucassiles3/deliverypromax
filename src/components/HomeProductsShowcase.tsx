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
  { key: "all", label: "Todos" },
  { key: "Lanches", label: "🍔 Lanches" },
  { key: "Pizzas", label: "🍕 Pizzas" },
  { key: "Doces", label: "🍦 Doces & Açaí" },
  { key: "Japonesa", label: "🍣 Japonesa" },
  { key: "Refeições", label: "🍲 Refeições" },
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
    <section className="relative my-4 sm:my-8 overflow-hidden rounded-[24px] sm:rounded-[32px] border border-border/60 bg-card/60 pt-4 sm:pt-6 pb-2 backdrop-blur-xl shadow-soft">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

      {/* Header section (Padding applied to header only so list can scroll edge-to-edge) */}
      <div className="px-4 md:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-[11px] sm:text-xs font-bold text-primary">
              <Flame className="h-3.5 w-3.5 fill-primary text-primary" />
              Produtos em Destaque
            </div>
            <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl md:text-3xl">
              Ofertas Direto dos Lojistas 🛍️
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 -mx-4 px-4 md:mx-0 md:px-0">
            {SEGMENT_OPTIONS.map((seg) => {
              const active = selectedSegment === seg.key;
              return (
                <button
                  key={seg.key}
                  id={`home-product-seg-${seg.key}`}
                  onClick={() => setSelectedSegment(seg.key)}
                  className={`shrink-0 rounded-full px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-glow"
                      : "border border-border/80 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {seg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="my-12 flex flex-col items-center justify-center gap-3 px-4 md:px-8">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Buscando as melhores ofertas...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="mx-4 md:mx-8 my-6 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h3 className="mt-2 font-display text-sm font-bold text-foreground">
            Nenhum produto em destaque nesta categoria
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedSegment !== "all"
              ? "Não encontramos ofertas ativas com o filtro atual."
              : "Não há ofertas cadastradas no momento."}
          </p>
          <div className="mt-4 flex justify-center">
            {selectedSegment !== "all" ? (
              <Button
                onClick={() => setSelectedSegment("all")}
                size="sm"
                className="h-9 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground"
              >
                Ver Todas as Categorias
              </Button>
            ) : (
              <Button
                onClick={() => refetch()}
                size="sm"
                variant="outline"
                className="h-9 rounded-xl border-border px-5 text-xs font-bold"
              >
                Tentar Novamente 🔄
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 w-full pb-4">
          {/* Row ListView with fixed container height */}
          <div
            ref={scrollRef}
            className="scrollbar-hide flex w-full h-[280px] sm:h-[310px] snap-x snap-mandatory flex-row items-stretch gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:gap-4 md:px-8"
          >
            {products.map((item) => {
              const discountTag = calculateDiscountPercent(item.promo_price, item.old_price);

              return (
                <Link
                  key={item.id}
                  to={item.product_link}
                  onClick={(e) => handleCardClick(item.product_link, e)}
                  className="group relative flex w-[160px] sm:w-[180px] shrink-0 snap-center sm:snap-start flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-background/95 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-float active:scale-[0.98]"
                >
                  <div className="flex flex-col h-full">
                    {/* Top: Image Container 1:1 Square */}
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
                        <div className="absolute top-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-primary-foreground shadow-sm">
                          {discountTag}
                        </div>
                      )}
                    </div>

                    {/* Middle: Texts */}
                    <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground">
                          <StoreIcon className="h-3 w-3 shrink-0 text-primary/70" />
                          <span className="truncate">{item.store_name}</span>
                        </div>
                        <h3 className="font-display text-sm font-bold leading-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {item.product_name}
                        </h3>
                        {item.description && (
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground/90 line-clamp-2 leading-tight mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Bottom: Prices */}
                      <div className="mt-2 pt-2 border-t border-border/40 flex items-end justify-between">
                        <div className="flex flex-col items-start leading-none gap-0.5">
                          {item.old_price && item.old_price > item.promo_price ? (
                            <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground line-through opacity-80 decoration-muted-foreground/60">
                              {formatPrice(item.old_price)}
                            </span>
                          ) : (
                            <span className="h-[12px]" />
                          )}
                          <span className="font-display text-[15px] sm:text-[17px] font-extrabold text-primary">
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

            {/* Load More Card (Infinite Scroll trigger replacement) */}
            {hasMore && (
              <div className="flex w-[140px] shrink-0 snap-center items-center justify-center py-4">
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
                  className="group flex h-full max-h-[140px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary transition-all hover:border-primary/60 hover:bg-primary/10 disabled:opacity-50"
                >
                  {isFetching ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 transition-transform group-hover:scale-110">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                      <span className="mt-2 text-[11px] font-bold text-center px-2">Carregar<br/>mais ofertas</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* End spacer so the last card doesn't stick to the edge */}
            <div className="w-1 shrink-0 sm:w-4" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
};

