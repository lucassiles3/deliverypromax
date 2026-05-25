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
import heroBasket from "@/assets/hero-basket.png";
import promoBasket from "@/assets/promo-basket.png";
import { NotificationBell } from "@/components/NotificationBell";
import { useCart } from "@/context/CartContext";

import { distanceKm, formatDistance } from "@/lib/distance";
import {
  Loader2,
  MapPin,
  ChevronDown,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  Flame,
  Star,
  Compass,
  Crosshair,
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

type FilterKey = "promo" | "rated" | "fast";

const FILTERS: { key: FilterKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "promo", label: "Promoções", icon: Flame },
  { key: "rated", label: "Melhor avaliado", icon: Star },
  { key: "fast", label: "Entrega rápida", icon: Compass },
];

const Index = () => {
  const { user } = useAuth();
  const { count, setOpen } = useCart();

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
  const { coords, requesting, denied, requestGps } = useUserLocation(addrCoords);

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
      const open = s.open !== false;
      let distance: number | null = null;
      if (coords && s.lat && s.lng) {
        distance = distanceKm(coords, { lat: Number(s.lat), lng: Number(s.lng) });
      }
      const radius = s.deliveryRadiusKm ?? null;
      // Se não temos coords do usuário OU loja não tem raio definido => assume "no raio"
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

  // Lojas no raio (sempre aplicado quando temos coords) — base para tudo
  const inRangeStores = useMemo(
    () => (coords ? enriched.filter((s) => s._inRange) : enriched),
    [enriched, coords],
  );
  const outOfRangeCount = enriched.length - inRangeStores.length;

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

  const cityShort = defaultAddr?.city
    ? `${defaultAddr.city}${defaultAddr.state ? `, ${defaultAddr.state}` : ""}`
    : coords?.source === "gps"
      ? "Localização atual"
      : "Selecione um endereço";

  return (
    <div className="min-h-screen pb-28 md:pb-0">
      {/* Header — título do app + sino + carrinho */}
      <header className="relative z-30 pt-4">
        <div className="container flex items-center justify-between">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground">
            Itchat Brasil
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur [&_button]:!h-10 [&_button]:!w-10 [&_button]:!rounded-full [&_button]:!text-foreground [&_button:hover]:!bg-transparent">
              <NotificationBell />
            </div>
            <button
              onClick={() => setOpen(true)}
              aria-label="Carrinho"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur transition-bounce hover:scale-105"
            >
              <ShoppingBag className="h-4.5 w-4.5 text-foreground" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero — saudação + avatar */}
      <section className="container pt-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-foreground/85">{greeting},</p>
            <h2 className="mt-0.5 flex items-center gap-2 font-display text-3xl font-extrabold leading-tight text-foreground">
              <span className="truncate">{firstName ?? "Bem-vindo"}</span>
              <span className="text-2xl">👋</span>
            </h2>
          </div>
          <button
            onClick={() => (user ? window.location.assign("/conta") : window.location.assign("/auth"))}
            aria-label="Minha conta"
            className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white/20 ring-2 ring-white/40 backdrop-blur"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-foreground">
                {(firstName ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        </div>

        {/* Pill de endereço */}
        <button
          onClick={() => (user ? window.location.assign("/enderecos") : window.location.assign("/auth"))}
          className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl bg-white/15 px-4 py-3 text-left ring-1 ring-white/25 backdrop-blur transition-bounce hover:bg-white/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
              <MapPin className="h-4 w-4 text-foreground" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-medium text-foreground/70">Entregar em</p>
              <p className="text-sm font-bold text-foreground">{cityShort}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-foreground/80" />
        </button>

        {/* Search com botão circular roxo */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 [&_input]:!rounded-full [&_input]:!border-0 [&_input]:!bg-white [&_input]:!py-3.5 [&_input]:!pl-12 [&_input]:!pr-4 [&_input]:!text-sm [&_input]:!text-card-foreground [&_input]:!shadow-[0_8px_22px_-10px_rgba(60,40,120,0.4)] [&_input::placeholder]:!text-muted-foreground">
            <SmartSearch onCategoryPick={(c) => {
              const lc = c.toLowerCase();
              const cat = CATEGORIES.find((cc) => cc.match.some((m) => lc.includes(m)));
              setActiveCat(cat?.key ?? null);
            }} />
          </div>
          <button
            onClick={requestGps}
            disabled={requesting}
            aria-label="Buscar / Usar GPS"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(265_85%_70%)] to-[hsl(250_75%_52%)] ring-2 ring-white/30 shadow-[0_10px_24px_-8px_rgba(60,40,120,0.6)] transition-bounce hover:scale-105"
          >
            {requesting ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Crosshair className="h-5 w-5 text-white" />
            )}
          </button>
        </div>

        {denied && (
          <p className="mt-2 text-xs text-foreground/70">
            Sem acesso ao GPS — usando endereço cadastrado.
          </p>
        )}
      </section>

      {/* Categorias */}
      <section className="container pt-6">
        <CategoryGrid
          availableCuisines={availableCuisines}
          active={activeCat}
          onPick={pickCategory}
        />

        {/* Subcategorias */}
        {activeCat && availableSubs.length > 0 && (
          <div className="scrollbar-hide -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <button
              onClick={() => setActiveSub(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-smooth ${
                !activeSub
                  ? "bg-gradient-to-br from-[hsl(265_85%_70%)] to-[hsl(250_75%_52%)] text-white shadow-[0_6px_16px_-6px_rgba(60,40,120,0.6)]"
                  : "bg-white text-card-foreground shadow-soft"
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
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-smooth ${
                    on
                      ? "bg-gradient-to-br from-[hsl(265_85%_70%)] to-[hsl(250_75%_52%)] text-white shadow-[0_6px_16px_-6px_rgba(60,40,120,0.6)]"
                      : "bg-white text-card-foreground shadow-soft"
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

      {/* Aviso de raio de entrega */}
      {coords && outOfRangeCount > 0 && (
        <section className="container pt-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs ring-1 ring-white/20 backdrop-blur">
            <MapPin className="h-3.5 w-3.5 text-foreground" />
            <span className="text-foreground/90">
              <strong>{outOfRangeCount}</strong>{" "}
              {outOfRangeCount === 1 ? "loja não atende" : "lojas não atendem"} seu endereço.
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
          {/* Banner promo — cesta rosa */}
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(260_70%_60%)] via-[hsl(255_65%_55%)] to-[hsl(250_60%_48%)] p-5 shadow-float ring-1 ring-white/15">
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="max-w-[60%]">
                <h3 className="font-display text-2xl font-extrabold leading-tight text-white md:text-3xl">
                  Ofertas que<br />cabem no <span className="text-[hsl(195_100%_75%)]">bolso</span>
                </h3>
                <p className="mt-2 text-sm text-white/85">
                  Descontos exclusivos só para você!
                </p>
                <Link
                  to="/categorias"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur transition-bounce hover:scale-105 hover:bg-white/25"
                >
                  Ver ofertas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <img
                src={promoBasket}
                alt=""
                width={200}
                height={200}
                loading="lazy"
                className="h-32 w-32 shrink-0 object-contain drop-shadow-2xl md:h-40 md:w-40"
              />
            </div>
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>

          <HomeBannerCarousel />


          {externalListings.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold md:text-2xl">🤝 Parceiros locais</h2>
                  <p className="text-xs text-muted-foreground">Toque para abrir o catálogo</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {(externalListings as any[])
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
          <p className="mt-1">A máquina de vendas para restaurantes</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
