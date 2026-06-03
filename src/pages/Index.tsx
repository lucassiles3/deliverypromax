import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAsset } from "@/lib/assetMap";
import { Header } from "@/components/Header";
import { SmartSearch } from "@/components/SmartSearch";
import { CategoryGrid, CATEGORIES, matchCategory, SUBCATEGORIES, matchSubcategory } from "@/components/CategoryGrid";
import { StoreRail } from "@/components/StoreRail";
import { StoreLogoRail } from "@/components/StoreLogoRail";
import { StoreCard } from "@/components/StoreCard";
import { ProductRail } from "@/components/ProductRail";
import { HomeBannerCarousel } from "@/components/HomeBannerCarousel";
import { TopVisitedRail } from "@/components/TopVisitedRail";
import { useStores } from "@/hooks/useStores";
import { useExternalListings } from "@/hooks/useExternalListings";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAddresses } from "@/hooks/useAddresses";
import { useUserLocation } from "@/hooks/useUserLocation";
import { LocationGate } from "@/components/LocationGate";


import heroBasket from "@/assets/hero-basket-3d.png";
import promoBasket from "@/assets/promo-basket-3d.png";

import { distanceKm, formatDistance } from "@/lib/distance";
import { isStoreOpen } from "@/lib/storeHours";
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
  Bell,
  ShoppingBag,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import type { Store, Product } from "@/data/stores";

const useFeaturedProducts = (stores: Store[]) => {
  // Mapa estável para usar dentro do queryFn sem invalidar o cache toda vez que
  // o array `stores` for recriado (qualquer realtime/refetch trocava a referência).
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const query = useQuery({
    queryKey: ["featured-products"],
    enabled: stores.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, old_price, image_url, category, rating, reviews, bestseller, promo, store_id")
        .eq("active", true)
        .or("promo.eq.true,bestseller.eq.true")
        .order("rating", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Junção loja×produto feita em memória, sem refetch.
  const items = useMemo(() => {
    return (query.data ?? [])
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
  }, [query.data, storeMap]);

  return { ...query, data: items };
};

type FilterKey = "promo" | "rated" | "fast";

const FILTERS: { key: FilterKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "promo", label: "Promoções", icon: Flame },
  { key: "rated", label: "Melhor avaliado", icon: Star },
  { key: "fast", label: "Entrega rápida", icon: Compass },
];

const Index = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: addresses } = useAddresses();
  const { data: storesData = [], isLoading } = useStores();
  const { data: externalListings = [] } = useExternalListings();
  const stores = useMemo(
    () => [...storesData, ...(externalListings as any[])] as any[],
    [storesData, externalListings],
  );
  const { data: featuredProducts = [] } = useFeaturedProducts(storesData);

  const defaultAddr = useMemo(
    () => addresses?.find((a: any) => a.is_default) ?? addresses?.[0] ?? null,
    [addresses],
  );
  const addrCoords =
    defaultAddr && defaultAddr.lat && defaultAddr.lng
      ? { lat: Number(defaultAddr.lat), lng: Number(defaultAddr.lng) }
      : null;
  const { coords, requesting, denied, requestGps, setManual } = useUserLocation(addrCoords);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());

  // ao trocar categoria, limpa a subcategoria
  const pickCategory = (k: string | null) => {
    setActiveCat(k);
    setActiveSub(null);
  };
  const availableSubs = activeCat ? SUBCATEGORIES[activeCat] ?? [] : [];

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

  // Enrich with distance + open + inRange
  const enriched = useMemo(() => {
    return stores.map((s: any) => {
      // Loja externa já traz `open` calculado pelo isOpenNow.
      // Loja normal: respeita toggle s.open E horário de funcionamento.
      const manualOpen = s.open !== false;
      const scheduleOpen = s._external
        ? s.open !== false
        : isStoreOpen(s.openingHours);
      const open = manualOpen && scheduleOpen;
      let distance: number | null = null;
      if (coords && s.lat && s.lng) {
        distance = distanceKm(coords, { lat: Number(s.lat), lng: Number(s.lng) });
      }
      const radius = s.deliveryRadiusKm ?? null;
      // Sem coords OU sem raio definido => considera "dentro do raio"
      const inRange = distance === null || radius === null ? true : distance <= radius;
      return {
        ...s,
        _open: open,
        _distance: distance,
        _radius: radius,
        _inRange: inRange,
      } as Store & {
        _open: boolean;
        _distance: number | null;
        _radius: number | null;
        _inRange: boolean;
      };
    });
  }, [stores, coords]);

  const showOutOfRange = false;

  // Lojas no raio E abertas — base para tudo
  const inRangeStores = useMemo(
    () => enriched.filter((s) => (coords ? s._inRange : true) && s._open),
    [enriched, coords],
  );
  const outOfRangeCount = enriched.filter((s) => coords && !s._inRange).length;

  // Fallback: se temos coords mas NENHUMA loja está no raio, mostra a mais próxima
  const nearestFallback = useMemo(() => {
    if (!coords || inRangeStores.length > 0) return null;
    const withDistance = enriched
      .filter((s) => s._distance !== null)
      .sort((a, b) => (a._distance! - b._distance!));
    return withDistance[0] ?? null;
  }, [coords, inRangeStores, enriched]);

  const filtered = useMemo(() => {
    let list = showOutOfRange ? enriched : inRangeStores;
    if (activeCat) {
      const cat = CATEGORIES.find((c) => c.key === activeCat);
      if (cat) {
        list = list.filter((s: any) =>
          s._categoryKey === activeCat || matchCategory(s.cuisine, cat),
        );
      }
    }
    if (activeCat && activeSub) {
      const sub = SUBCATEGORIES[activeCat]?.find((x) => x.key === activeSub);
      if (sub) {
        list = list.filter((s: any) =>
          s._subcategoryKey === activeSub || matchSubcategory(s.cuisine, sub),
        );
      }
    }
    if (activeFilters.has("promo")) list = list.filter((s) => !!s.promo);
    if (activeFilters.has("rated")) list = list.filter((s) => s.rating >= 4.5);
    if (activeFilters.has("fast"))
      list = list.filter((s) => {
        const m = /^(\d+)/.exec(s.deliveryTime || "");
        return m ? Number(m[1]) <= 30 : false;
      });
    return list;
  }, [enriched, inRangeStores, showOutOfRange, activeCat, activeSub, activeFilters]);

  // Rails — sempre baseadas em lojas dentro do raio
  const railBase = showOutOfRange ? enriched : inRangeStores;
  const promoStores = railBase.filter((s) => !!s.promo).slice(0, 8);
  const featuredStores = [...railBase]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 8);
  const nearbyStores = coords
    ? [...railBase]
        .filter((s) => s._distance !== null)
        .sort((a, b) => (a._distance! - b._distance!))
        .slice(0, 8)
    : [];
  const newStores = [...railBase].slice(0, 8);

  const toggleFilter = (k: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const navigate = useNavigate();
  const { setOpen: openCart, count: cartCount } = useCart();

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-0">
      <LocationGate
        hasCoords={!!coords}
        requesting={requesting}
        onUseGps={requestGps}
        onManual={setManual}
      />
      <div className="hidden md:block">
        <Header />
      </div>


      {/* Hero premium — estilo iOS marketplace */}
      <section className="relative overflow-x-clip">
        {/* Glow de fundo */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 right-0 h-[320px] w-[320px] rounded-full bg-secondary/15 blur-3xl" />

        <div className="container relative pt-6 pb-8">
          {/* Topo: localização + ações glass */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <button
              onClick={() => (user ? navigate("/enderecos") : navigate("/auth"))}
              className="flex items-center gap-3 text-left"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl glass shadow-soft">
                <MapPin className="h-5 w-5 text-primary" />
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] font-medium text-muted-foreground">Entrega em</span>
                <span className="flex items-center gap-1 text-sm font-bold text-foreground">
                  {defaultAddr?.city ?? "Itabuna, BA"}
                  <span className="text-muted-foreground">▾</span>
                </span>
              </span>
            </button>

          </div>

          {/* Saudação + cesta 3D */}
          <div className="relative grid grid-cols-[1fr,auto] items-center gap-2">
            <div>
              <p className="text-base font-medium text-muted-foreground">{greeting},</p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
                {firstName ?? "Bem-vindo"}
              </h1>
            </div>
            <div className="relative">
              <img
                src={heroBasket}
                alt="Cesta de compras"
                width={160}
                height={160}
                className="h-32 w-32 animate-float-bob object-contain drop-shadow-[0_18px_24px_hsl(226_60%_40%/0.25)] md:h-40 md:w-40"
              />
              <button
                onClick={() => openCart(true)}
                aria-label="Adicionar"
                className="absolute -bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full gradient-mint text-white shadow-glow transition-bounce hover:scale-110"
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Busca premium */}
          <div className="relative z-[60] mt-6">
            <SmartSearch onCategoryPick={(c) => {
              const lc = c.toLowerCase();
              const cat = CATEGORIES.find((cc) => cc.match.some((m) => lc.includes(m)));
              setActiveCat(cat?.key ?? null);
            }} />
          </div>

          {denied && (
            <p className="mt-2 text-xs text-muted-foreground">
              Sem acesso ao GPS — usando endereço cadastrado para distâncias.
            </p>
          )}
        </div>
      </section>

      {/* Categorias */}
      <section className="container py-6">
        <CategoryGrid
          availableCuisines={availableCuisines}
          active={activeCat}
          onPick={pickCategory}
        />


        {/* Subcategorias da categoria escolhida */}
        {activeCat && availableSubs.length > 0 && (
          <div className="scrollbar-hide -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <button
              onClick={() => setActiveSub(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-smooth ${
                !activeSub
                  ? "bg-foreground text-background"
                  : "border border-border bg-card hover:border-primary/30"
              }`}
            >
              Todos
            </button>
            {availableSubs.map((s) => {
              const on = activeSub === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveSub(on ? null : s.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-smooth ${
                    on
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "border border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <span>{s.emoji}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Banners promocionais */}
      <section className="container pb-2">
        <HomeBannerCarousel />
      </section>




      {/* Banner promocional premium */}
      <section className="container pb-2">
        <div className="relative overflow-hidden rounded-[28px] gradient-primary p-6 shadow-glow">
          <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-40 w-40 rounded-full bg-accent/30 blur-2xl" />
          <div className="relative grid grid-cols-[1fr,auto] items-center gap-3">
            <div className="text-white">
              <h3 className="font-display text-2xl font-extrabold leading-tight md:text-3xl">
                Ofertas que<br/>cabem no <span className="text-accent">bolso</span>
              </h3>
              <p className="mt-1 text-sm text-white/85">Descontos exclusivos só para você!</p>
              <Link
                to="/categorias"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-primary shadow-soft transition-bounce hover:scale-[1.03]"
              >
                Ver ofertas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <img
              src={promoBasket}
              alt=""
              width={180}
              height={180}
              loading="lazy"
              className="h-32 w-32 animate-float-bob object-contain drop-shadow-2xl md:h-40 md:w-40"
            />
          </div>
        </div>
      </section>

      {/* Destaques do mês — logos redondos */}
      {featuredStores.length > 0 && (
        <section className="container pb-2">
          <StoreLogoRail
            title="Destaques do mês"
            subtitle="Os estabelecimentos mais amados pelos clientes"
            stores={featuredStores as any}
          />
        </section>
      )}

      {/* Mais visitadas do mês — carrossel de logos */}
      <TopVisitedRail />


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
          {(activeCat || activeSub || activeFilters.size > 0) && (
            <button
              onClick={() => {
                setActiveCat(null);
                setActiveSub(null);
                setActiveFilters(new Set());
              }}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>
      </section>

      {/* Aviso de raio de entrega */}
      {coords && outOfRangeCount > 0 && (
        <section className="container pb-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <strong className="text-foreground">{outOfRangeCount}</strong>{" "}
              {outOfRangeCount === 1 ? "loja não atende" : "lojas não atendem"} seu endereço e foram ocultadas.
            </span>
          </div>
        </section>
      )}

      {/* Fallback — nenhuma loja no raio */}
      {coords && inRangeStores.length === 0 && nearestFallback && !showOutOfRange && (
        <section className="container pb-3">
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-bold text-foreground">
              Nenhuma loja atende seu endereço no momento 😔
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A loja mais próxima de você está a{" "}
              <strong className="text-foreground">{formatDistance(nearestFallback._distance!)}</strong>.
              Você ainda pode pedir para retirada.
            </p>
            <div className="mt-3 max-w-sm">
              <StoreCard
                store={nearestFallback}
                distanceKm={nearestFallback._distance}
                inRange={false}
              />
            </div>
          </div>
        </section>
      )}
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
                <StoreCard
                  key={s.id}
                  store={s}
                  index={i}
                  distanceKm={s._distance}
                  inRange={coords ? s._inRange : undefined}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        // Modo descoberta: rails
        <div className="container pb-12 pt-2">


          {(storesData.length > 0 || externalListings.length > 0) && (
            <section className="mb-8">
              <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {[...storesData, ...(externalListings as any[])]
                  .slice()
                  .sort((a, b) => {
                    const aOpen = enriched.find((e: any) => e.id === a.id)?._open ?? true;
                    const bOpen = enriched.find((e: any) => e.id === b.id)?._open ?? true;
                    return Number(bOpen) - Number(aOpen);
                  })
                  .map((s, i) => {
                    const enrichedItem = enriched.find((e: any) => e.id === s.id) as any;
                    return (
                      <StoreCard
                        key={s.id}
                        store={s}
                        index={i}
                        distanceKm={enrichedItem?._distance ?? null}
                        isOpen={enrichedItem?._open ?? true}
                        inRange={coords ? enrichedItem?._inRange : undefined}
                      />
                    );
                  })}
              </div>
            </section>
          )}

          {!user && (
            <div className="mt-6 rounded-2xl border border-dashed bg-card p-6 text-center">
              <Heart className="mx-auto mb-2 h-8 w-8 text-primary" />
              <h3 className="font-display text-lg font-bold">
                Crie sua conta para recomendações personalizadas
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Favoritos e ofertas só pra você.
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
          <p className="font-display text-base font-bold text-foreground">Itchat Brasil</p>
          <p className="mt-1">As lojas da sua cidade, em um só lugar!</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
