import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { StoreCard } from "@/components/StoreCard";
import { useStores } from "@/hooks/useStores";
import { useExternalListings } from "@/hooks/useExternalListings";
import { useAddresses } from "@/hooks/useAddresses";
import { useUserLocation } from "@/hooks/useUserLocation";
import { distanceKm as calcDistance } from "@/lib/distance";
import { CATEGORIES, SUBCATEGORIES, matchCategory, matchSubcategory } from "@/components/CategoryGrid";
import { Loader2, Grid3x3, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const Categorias = () => {
  const { data: storesData = [], isLoading } = useStores();
  const { data: externalListings = [] } = useExternalListings();
  const { data: addresses } = useAddresses();
  const defaultAddr = useMemo(
    () => addresses?.find((a: any) => a.is_default) ?? addresses?.[0] ?? null,
    [addresses],
  );
  const addrCoords =
    defaultAddr && defaultAddr.lat && defaultAddr.lng
      ? { lat: Number(defaultAddr.lat), lng: Number(defaultAddr.lng) }
      : null;
  const { coords } = useUserLocation(addrCoords);

  const allStores = useMemo(() => {
    const combined = [...storesData, ...(externalListings as any[])];
    return combined
      .map((s: any) => {
        let distance: number | null = null;
        if (coords && s.lat && s.lng) {
          distance = calcDistance(coords, { lat: Number(s.lat), lng: Number(s.lng) });
        }
        const radius = s.deliveryRadiusKm ?? null;
        const inRange =
          !coords || distance === null || radius === null ? true : distance <= radius;
        return { ...s, _distance: distance, _radius: radius, _inRange: inRange };
      })
      .filter((s: any) => s._inRange);
  }, [storesData, externalListings, coords]);

  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

  // Tela de listagem ao escolher uma subcategoria
  if (openCat && openSub) {
    const cat = CATEGORIES.find((c) => c.key === openCat);
    const sub = SUBCATEGORIES[openCat]?.find((s) => s.key === openSub);
    const list = allStores.filter((s: any) =>
      sub
        ? s._subcategoryKey === sub.key || matchSubcategory(s.cuisine, sub)
        : cat
          ? s._categoryKey === cat.key || matchCategory(s.cuisine, cat)
          : false,
    );

    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <div className="container py-4">
          <button
            onClick={() => setOpenSub(null)}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para {cat?.label}
          </button>

          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-2xl">
              {sub?.emoji}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{sub?.label}</h1>
              <p className="text-sm text-muted-foreground">
                {list.length} {list.length === 1 ? "loja encontrada" : "lojas encontradas"}
              </p>
            </div>
          </div>

          {isLoading ? (
            <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-primary" />
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
              Nenhuma loja nesta subcategoria por enquanto.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s, i) => (
                <StoreCard key={s.id} store={s} index={i} distanceKm={(s as any)._distance ?? null} inRange={(s as any)._inRange} />
              ))}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // Tela de subcategorias de uma categoria principal
  if (openCat) {
    const cat = CATEGORIES.find((c) => c.key === openCat);
    const subs = SUBCATEGORIES[openCat] ?? [];
    const Icon = cat?.icon;
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <div className="container py-4">
          <button
            onClick={() => setOpenCat(null)}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Todas as categorias
          </button>

          <div className="mb-5 flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cat?.color ?? "bg-muted"}`}>
              {Icon && <Icon className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{cat?.label}</h1>
              <p className="text-sm text-muted-foreground">Escolha uma subcategoria</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {subs.map((s, i) => (
              <motion.button
                key={s.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setOpenSub(s.key)}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
              >
                <span className="text-3xl transition-transform group-hover:scale-110 sm:text-4xl">
                  {s.emoji}
                </span>
                <span className="text-xs font-bold leading-tight sm:text-sm">{s.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Tela principal: todas as categorias
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="container py-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70">
            <Grid3x3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">Categorias</h1>
            <p className="text-sm text-muted-foreground">Explore por segmento</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {CATEGORIES.map((c, i) => {
            const Icon = c.icon;
            const subs = SUBCATEGORIES[c.key] ?? [];
            return (
              <motion.button
                key={c.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setOpenCat(c.key)}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${c.color} transition-bounce group-hover:scale-110`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-bold leading-tight">{c.label}</span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {subs.length} subcategorias
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Categorias;
