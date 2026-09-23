import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Store as StoreIcon,
  Tag,
  ArrowRight,
  Loader2,
  Sparkles,
  Flame,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveAsset } from "@/lib/assetMap";
import { useHomeProducts, HomeProduct } from "@/hooks/useHomeProducts";

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
  const { products, totalCount, hasMore, isLoading, isFetching, loadMore } = useHomeProducts({
    pageSize: 8,
    segment: selectedSegment === "all" ? null : selectedSegment,
  });

  const formatPrice = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const calculateDiscountPercent = (promo: number, old?: number | null) => {
    if (!old || old <= promo) return null;
    const pct = Math.round(((old - promo) / old) * 100);
    return pct > 0 ? `-${pct}%` : null;
  };

  const handleCardClick = (link: string) => {
    if (link.startsWith("http://") || link.startsWith("https://")) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section className="relative my-8 overflow-hidden rounded-[32px] border border-border/60 bg-card/60 p-5 backdrop-blur-xl shadow-soft md:p-8">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

      {/* Header section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
            <Flame className="h-3.5 w-3.5 fill-primary text-primary" />
            Produtos em Destaque
          </div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
            Ofertas Direto dos Lojistas 🛍️
          </h2>
          <p className="text-xs text-muted-foreground md:text-sm">
            Compre produtos selecionados e receba direto no seu endereço com rapidez.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-1">
          {SEGMENT_OPTIONS.map((seg) => {
            const active = selectedSegment === seg.key;
            return (
              <button
                key={seg.key}
                id={`home-product-seg-${seg.key}`}
                onClick={() => setSelectedSegment(seg.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ${
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

      {/* Grid of Product Cards */}
      {isLoading ? (
        <div className="my-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Buscando as melhores ofertas...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="my-12 rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 font-display text-base font-bold text-foreground">
            Nenhum produto em destaque encontrado nesta categoria
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tente selecionar "Todos" para ver mais ofertas disponíveis.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {products.map((item, idx) => {
              const discountTag = calculateDiscountPercent(item.promo_price, item.old_price);
              const isExternal = item.product_link.startsWith("http");

              const CardContent = (
                <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-background/90 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-float">
                  {/* Discount & Segment Badges */}
                  <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl bg-muted">
                    <img
                      src={resolveAsset(item.image_url)}
                      alt={item.product_name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    
                    {discountTag && (
                      <Badge className="absolute top-2.5 left-2.5 bg-red-600 text-white font-extrabold shadow-md">
                        {discountTag}
                      </Badge>
                    )}

                    {item.segment && (
                      <Badge variant="secondary" className="absolute top-2.5 right-2.5 bg-background/80 text-[10px] font-bold backdrop-blur">
                        {item.segment}
                      </Badge>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="flex flex-1 flex-col justify-between space-y-2">
                    <div>
                      {/* Store Name Badge */}
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-primary">
                        <StoreIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.store_name}</span>
                      </div>

                      {/* Product Name */}
                      <h3 className="font-display text-base font-bold leading-snug text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.product_name}
                      </h3>

                      {/* Description */}
                      {item.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Price & Action Button */}
                    <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        {item.old_price && item.old_price > item.promo_price && (
                          <span className="text-[11px] font-medium text-muted-foreground line-through">
                            {formatPrice(item.old_price)}
                          </span>
                        )}
                        <span className="font-display text-lg font-extrabold text-foreground">
                          {formatPrice(item.promo_price)}
                        </span>
                      </div>

                      <div className="flex h-9 items-center gap-1 rounded-xl bg-primary/10 px-3 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <span>Comprar</span>
                        {isExternal ? (
                          <ExternalLink className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                >
                  {isExternal ? (
                    <div
                      onClick={() => handleCardClick(item.product_link)}
                      className="cursor-pointer h-full"
                    >
                      {CardContent}
                    </div>
                  ) : (
                    <Link to={item.product_link} className="block h-full">
                      {CardContent}
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination & Load More Footer */}
      {products.length > 0 && (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 border-t border-border/40 pt-6">
          <p className="text-xs text-muted-foreground">
            Exibindo <span className="font-bold text-foreground">{products.length}</span> de{" "}
            <span className="font-bold text-foreground">{totalCount}</span> produtos cadastrados
          </p>

          {hasMore && (
            <Button
              id="btn-load-more-home-products"
              onClick={loadMore}
              disabled={isFetching}
              size="lg"
              className="h-11 rounded-2xl bg-gradient-to-r from-primary to-secondary px-8 text-xs font-bold text-white shadow-glow hover:opacity-95 disabled:opacity-50"
            >
              {isFetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando ofertas...
                </>
              ) : (
                <>
                  Carregar Mais Produtos
                  <ChevronDown className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
