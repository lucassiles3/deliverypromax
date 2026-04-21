import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAsset } from "@/lib/assetMap";
import { Header } from "@/components/Header";
import { SmartSearch } from "@/components/SmartSearch";
import { CategoryGrid, CATEGORIES, matchCategory } from "@/components/CategoryGrid";
import { StoreRail } from "@/components/StoreRail";
import { StoreCard } from "@/components/StoreCard";
import { ProductRail } from "@/components/ProductRail";
import { useStores } from "@/hooks/useStores";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAddresses } from "@/hooks/useAddresses";
import { useUserLocation } from "@/hooks/useUserLocation";
import { isStoreOpen } from "@/lib/storeHours";
import { distanceKm, formatDistance } from "@/lib/distance";
import {
  Loader2,
  MapPin,
  Crosshair,
  Sparkles,
  Flame,
  Star,
  Compass,
  Zap,
  Heart,
  Filter,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Store, Product } from "@/data/stores";

const useFeaturedProducts = (stores: Store[]) =>
  useQuery({
    queryKey: ["featured-products", stores.map((s) => s.id).join(",")],
    enabled: stores.length > 0,
    queryFn: async () => {
      const storeMap = new Map(stores.map((s) => [s.id, s]));
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, old_price, image_url, category, rating, reviews, bestseller, promo, store_id")
        .eq("active", true)
        .or("promo.eq.true,bestseller.eq.true")
        .order("rating", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? [])
        .map((p: any) => {
          const store = storeMap.get(p.store_id);
          if (!store) return null;
          return {
            id: p.id,
            name: p.name,
            description: p.description ?? "",
            price: Number(p.price),
            oldPrice: p.old_price ? Number(p.old_price) : undefined,
            image: resolveAsset(p.image_url),
            category: p.category ?? "Outros",
            rating: Number(p.rating ?? 5),
            reviews: p.reviews ?? 0,
            bestseller: !!p.bestseller,
            promo: !!p.promo,
            _store: store,
          } as Product & { _store: Store };
        })
        .filter(Boolean) as (Product & { _store: Store })[];
    },
  });

type FilterKey = "open" | "promo" | "rated" | "fast";

const FILTERS: { key: FilterKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "open", label: "Aberto agora", icon: Zap },
  { key: "promo", label: "Promoções", icon: Flame },
  { key: "rated", label: "Melhor avaliado", icon: Star },
  { key: "fast", label: "Entrega rápida", icon: Compass },
];

const Index = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: addresses } = useAddresses();
  const { data: stores = [], isLoading } = useStores();
  const { data: featuredProducts = [] } = useFeaturedProducts(stores);

  const defaultAddr = useMemo(
    () => addresses?.find((a: any) => a.is_default) ?? addresses?.[0] ?? null,
    [addresses],
  );
  const addrCoords =
    defaultAddr && defaultAddr.lat && defaultAddr.lng
      ? { lat: Number(defaultAddr.lat), lng: Number(defaultAddr.lng) }
      : null;
  const { coords, requesting, denied, requestGps } = useUserLocation(addrCoords);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const firstName =
    profile?.display_name?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    null;

  const addressLabel = defaultAddr
    ? `${defaultAddr.street}, ${defaultAddr.number} • ${defaultAddr.city ?? ""}`
    : coords?.source === "gps"
      ? "Localização atual (GPS)"
      : "Selecione um endereço";

  const availableCuisines = useMemo(
    () => Array.from(new Set(stores.map((s) => s.cuisine).filter(Boolean))),
    [stores],
  );

  // Enrich with distance + open
  const enriched = useMemo(() => {
    return stores.map((s: any) => {
      const open = isStoreOpen(s.openingHours) && s.open;
      let distance: number | null = null;
      if (coords && s.lat && s.lng) {
        distance = distanceKm(coords, { lat: Number(s.lat), lng: Number(s.lng) });
      }
      return { ...s, _open: open, _distance: distance } as Store & { _open: boolean; _distance: number | null };
    });
  }, [stores, coords]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (activeCat) {
      const cat = CATEGORIES.find((c) => c.key === activeCat);
      if (cat) list = list.filter((s) => matchCategory(s.cuisine, cat));
    }
    if (activeFilters.has("open")) list = list.filter((s) => s._open);
    if (activeFilters.has("promo")) list = list.filter((s) => !!s.promo);
    if (activeFilters.has("rated")) list = list.filter((s) => s.rating >= 4.5);
    if (activeFilters.has("fast"))
      list = list.filter((s) => {
        const m = /^(\d+)/.exec(s.deliveryTime || "");
        return m ? Number(m[1]) <= 30 : false;
      });
    return list;
  }, [enriched, activeCat, activeFilters]);

  // Rails
  const promoStores = enriched.filter((s) => !!s.promo).slice(0, 8);
  const featuredStores = [...enriched]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 8);
  const nearbyStores = coords
    ? [...enriched]
        .filter((s) => s._distance !== null)
        .sort((a, b) => (a._distance! - b._distance!))
        .slice(0, 8)
    : [];
  const newStores = [...enriched].slice(0, 8); // ordered by name in hook; placeholder

  const toggleFilter = (k: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <Header />

      {/* Hero personalizado */}
      <section className="border-b border-border/40 bg-gradient-to-b from-muted/40 to-transparent">
        <div className="container py-6 md:py-8">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold md:text-3xl">
                {greeting}{firstName ? `, ${firstName}` : ""} 👋
              </h1>
              <button
                onClick={() => (user ? window.location.assign("/enderecos") : window.location.assign("/auth"))}
                className="mt-1 inline-flex items-center gap-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
              >
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium">{addressLabel}</span>
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Trocar
                </span>
              </button>
            </div>

            <button
              onClick={requestGps}
              disabled={requesting}
              className="hidden items-center gap-2 self-start rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold transition-smooth hover:border-primary/30 md:inline-flex"
              title="Usar localização atual"
            >
              {requesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5 text-primary" />
              )}
              {coords?.source === "gps" ? "GPS ativo" : "Usar GPS"}
            </button>
          </div>

          <SmartSearch onCategoryPick={(c) => {
            // map cuisine string to category key if any matches
            const lc = c.toLowerCase();
            const cat = CATEGORIES.find((cc) => cc.match.some((m) => lc.includes(m)));
            setActiveCat(cat?.key ?? null);
          }} />

          {denied && (
            <p className="mt-2 text-xs text-muted-foreground">
              Sem acesso ao GPS — usando endereço cadastrado para distâncias.
            </p>
          )}
        </div>
      </section>

      {/* Categorias */}
      <section className="container py-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold md:text-xl">Categorias</h2>
          <Link to="/categorias" className="text-xs font-semibold text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        <CategoryGrid
          availableCuisines={availableCuisines}
          active={activeCat}
          onPick={setActiveCat}
        />
      </section>

      {/* Filtros */}
      <section className="container pb-3">
        <div className="scrollbar-hide -mx-4 flex items-center gap-2 overflow-x-auto px-4">
          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros:
          </span>
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const on = activeFilters.has(f.key);
            return (
              <button
                key={f.key}
                onClick={() => toggleFilter(f.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-smooth ${
                  on
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
          {(activeCat || activeFilters.size > 0) && (
            <button
              onClick={() => {
                setActiveCat(null);
                setActiveFilters(new Set());
              }}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>
      </section>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : activeCat || activeFilters.size > 0 ? (
        // Modo filtrado: grid
        <section className="container pb-12">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">
              {filtered.length} {filtered.length === 1 ? "loja" : "lojas"}
            </h2>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
              Nenhuma loja com esses filtros.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s, i) => (
                <div key={s.id}>
                  <StoreCard store={s} index={i} />
                  {s._distance !== null && (
                    <p className="mt-1 px-1 text-xs font-medium text-muted-foreground">
                      📍 {formatDistance(s._distance)} de você
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        // Modo descoberta: rails
        <div className="container pb-12 pt-2">
          <StoreRail
            title="🔥 Promoções perto de você"
            subtitle="Descontos imperdíveis"
            stores={promoStores}
            emptyHint="Nenhuma promoção ativa agora — volte mais tarde."
          />
          <StoreRail
            title="⭐ Lojas em destaque"
            subtitle="As favoritas dos clientes"
            stores={featuredStores}
          />
          {nearbyStores.length > 0 && (
            <StoreRail
              title="📍 Próximas de você"
              subtitle={coords?.source === "gps" ? "Baseado no seu GPS" : "Baseado no seu endereço"}
              stores={nearbyStores}
            />
          )}
          <StoreRail title="🆕 Novidades" subtitle="Recém chegadas" stores={newStores} />

          {!user && (
            <div className="mt-6 rounded-2xl border border-dashed bg-card p-6 text-center">
              <Heart className="mx-auto mb-2 h-8 w-8 text-primary" />
              <h3 className="font-display text-lg font-bold">
                Crie sua conta para recomendações personalizadas
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cashback, favoritos e ofertas só pra você.
              </p>
              <Link
                to="/auth"
                className="mt-3 inline-flex rounded-xl gradient-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow"
              >
                <Sparkles className="mr-1.5 h-4 w-4" /> Entrar / Cadastrar
              </Link>
            </div>
          )}
        </div>
      )}

      <footer className="border-t bg-card">
        <div className="container py-6 text-center text-xs text-muted-foreground">
          <p className="font-display text-base font-bold text-foreground">FoodFlash</p>
          <p className="mt-1">A máquina de vendas para restaurantes</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
