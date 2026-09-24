import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Store as StoreIcon,
  Flame,
  ChevronDown,
  ExternalLink,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveAsset } from "@/lib/assetMap";
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
  const { products, totalCount, hasMore, isLoading, isFetching, loadMore, refetch } = useHomeProducts({
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
    <section className="relative my-4 sm:my-8 overflow-hidden rounded-[24px] sm:rounded-[32px] border border-border/60 bg-card/60 p-3 sm:p-6 backdrop-blur-xl shadow-soft md:p-8">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

      {/* Header section */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-[11px] sm:text-xs font-bold text-primary">
            <Flame className="h-3.5 w-3.5 fill-primary text-primary" />
            Produtos em Destaque
          </div>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl md:text-3xl">
            Ofertas Direto dos Lojistas 🛍️
          </h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground md:text-sm">
            Compre ofertas exclusivas e receba rápido no seu endereço.
          </p>
        </div>

        {/* Filter Pills — Touch friendly horizontal scroll */}
        <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
          {SEGMENT_OPTIONS.map((seg) => {
            const active = selectedSegment === seg.key;
            return (
              <button
                key={seg.key}
                id={`home-product-seg-${seg.key}`}
                onClick={() => setSelectedSegment(seg.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold transition-all duration-200 ${
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

      {/* Grid of Product Cards: 2 Columns on mobile, 3 on md, 4 on lg */}
      {isLoading ? (
        <div className="my-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Buscando as melhores ofertas...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="my-10 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h3 className="mt-2 font-display text-sm font-bold text-foreground">
            {selectedSegment !== "all"
              ? `Nenhum produto encontrado no segmento "${selectedSegment}"`
              : "Nenhum produto cadastrado nesta seção"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedSegment !== "all"
              ? "Clique abaixo para visualizar todas as ofertas disponíveis."
              : "Tente atualizar para carregar os produtos do banco de dados."}
          </p>
          <div className="mt-4 flex justify-center">
            {selectedSegment !== "all" ? (
              <Button
                onClick={() => setSelectedSegment("all")}
                size="sm"
                className="h-9 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground"
              >
                Ver Todos os Produtos
              </Button>
            ) : (
              <Button
                onClick={() => refetch()}
                size="sm"
                variant="outline"
                className="h-9 rounded-xl border-border px-5 text-xs font-bold"
              >
                Atualizar Ofertas 🔄
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {products.map((item, idx) => {
              const discountTag = calculateDiscountPercent(item.promo_price, item.old_price);
              const isExternal = item.product_link.startsWith("http");

              const CardInner = (
                <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-xl sm:rounded-2xl border border-border/70 bg-background/95 p-2 sm:p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-float">
                  
                  {/* Image container: Compact aspect-ratio for mobile layout */}
                  <div className="relative mb-2 aspect-[4/3] w-full overflow-hidden rounded-lg sm:rounded-xl bg-muted">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
                      <span className="absolute top-1.5 left-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] sm:text-[11px] font-extrabold text-white shadow-sm tracking-tight">
                        {discountTag}
                      </span>
                    )}

                    {/* Segment Pill */}
                    {item.segment && (
                      <span className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-white backdrop-blur max-w-[70px] sm:max-w-none truncate">
                        {item.segment}
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col justify-between space-y-1">
                    <div>
                      {/* Store Name Badge */}
                      <div className="mb-0.5 flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-primary">
                        <StoreIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[110px] sm:max-w-none">{item.store_name}</span>
                      </div>

                      {/* Product Name */}
                      <h3 className="font-display text-xs sm:text-sm font-bold leading-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.product_name}
                      </h3>

                      {/* Description: Hidden on small screens to keep mobile card sleek */}
                      {item.description && (
                        <p className="mt-0.5 hidden text-[11px] text-muted-foreground line-clamp-2 leading-tight sm:block">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Footer: Price + Delivery "Pedir" Action Button */}
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between gap-1">
                      <div className="flex flex-col">
                        {item.old_price && item.old_price > item.promo_price && (
                          <span className="text-[9px] sm:text-[11px] font-medium text-muted-foreground line-through leading-none">
                            {formatPrice(item.old_price)}
                          </span>
                        )}
                        <span className="font-display text-xs sm:text-base font-extrabold text-foreground leading-tight">
                          {formatPrice(item.promo_price)}
                        </span>
                      </div>

                      {/* Delivery-style Action Button */}
                      <div className="flex h-7 sm:h-8 items-center gap-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-primary to-secondary px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-white shadow-glow transition-transform group-hover:scale-105">
                        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} />
                        <span className="hidden sm:inline">Pedir</span>
                      </div>
                    </div>
                  </div>
                </div>
              );

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  className="h-full"
                >
                  {isExternal ? (
                    <div
                      onClick={() => handleCardClick(item.product_link)}
                      className="cursor-pointer h-full"
                    >
                      {CardInner}
                    </div>
                  ) : (
                    <Link to={item.product_link} className="block h-full">
                      {CardInner}
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
        <div className="mt-5 sm:mt-8 flex flex-col items-center justify-center gap-2 border-t border-border/40 pt-4 sm:pt-6">
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            Exibindo <span className="font-bold text-foreground">{products.length}</span> de{" "}
            <span className="font-bold text-foreground">{totalCount}</span> produtos cadastrados
          </p>

          {hasMore && (
            <Button
              id="btn-load-more-home-products"
              onClick={loadMore}
              disabled={isFetching}
              size="sm"
              className="h-9 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-r from-primary to-secondary px-6 sm:px-8 text-xs font-bold text-white shadow-glow hover:opacity-95 disabled:opacity-50"
            >
              {isFetching ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  Carregar Mais Produtos
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
