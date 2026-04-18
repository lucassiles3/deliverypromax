import { useMemo, useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Star, Clock, Bike, MapPin, Search, Flame } from "lucide-react";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { PromoCountdown } from "@/components/PromoCountdown";
import { getStoreBySlug } from "@/data/stores";

const Store = () => {
  const { slug = "" } = useParams();
  const store = getStoreBySlug(slug);
  const [activeCat, setActiveCat] = useState(store?.categories[0] ?? "");
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = store ? `${store.name} • FoodFlash` : "FoodFlash";
  }, [store]);

  const grouped = useMemo(() => {
    if (!store) return {};
    const filtered = store.products.filter((p) =>
      !query ? true : p.name.toLowerCase().includes(query.toLowerCase())
    );
    return store.categories.reduce<Record<string, typeof store.products>>((acc, c) => {
      acc[c] = filtered.filter((p) => p.category === c);
      return acc;
    }, {});
  }, [store, query]);

  if (!store) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      {/* Cover */}
      <div className="relative h-52 overflow-hidden md:h-72">
        <img src={store.cover} alt="" width={1600} height={500} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-foreground/40" />
        <Link
          to="/"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-card transition-bounce hover:scale-110"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      {/* Store info */}
      <div className="container -mt-12 relative">
        <div className="rounded-3xl bg-card p-5 shadow-float md:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-3xl shadow-card md:h-20 md:w-20 md:text-4xl">
              {store.logo}
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold md:text-3xl">{store.name}</h1>
              <p className="text-sm text-muted-foreground">{store.tagline}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1 font-semibold">
                  <Star className="h-4 w-4 fill-accent text-accent" /> {store.rating}
                  <span className="ml-1 font-normal text-muted-foreground">({store.reviews})</span>
                </div>
                <span className="text-border">•</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" /> {store.deliveryTime}
                </div>
                <span className="text-border">•</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Bike className="h-4 w-4" />
                  {store.deliveryFee === 0 ? "Grátis" : `R$ ${store.deliveryFee.toFixed(2).replace(".", ",")}`}
                </div>
                <span className="text-border">•</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {store.city}
                </div>
              </div>
            </div>
            {store.open && (
              <div className="hidden shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success md:flex">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Aberto agora
              </div>
            )}
          </div>

          {store.promo && (
            <div className="mt-4 flex items-center gap-2 rounded-xl gradient-promo p-3 text-primary-foreground shadow-glow">
              <Flame className="h-5 w-5" />
              <strong className="text-sm">{store.promo}</strong>
              <div className="ml-auto"><PromoCountdown /></div>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="container mt-6">
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-soft">
          <Search className="ml-2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar no ${store.name}...`}
            className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Sticky categories */}
      <div className="sticky top-16 z-30 mt-4 border-y bg-background/90 backdrop-blur">
        <div className="container">
          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 py-3">
            {store.categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setActiveCat(c);
                  document.getElementById(`cat-${c}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-smooth ${
                  activeCat === c
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "bg-muted hover:bg-muted/70"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products by category */}
      <div className="container mt-6 space-y-10">
        {store.categories.map((c) => {
          const list = grouped[c] ?? [];
          if (list.length === 0) return null;
          return (
            <section key={c} id={`cat-${c}`} className="scroll-mt-32">
              <h2 className="mb-4 font-display text-xl font-bold md:text-2xl">{c}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((p) => (
                  <ProductCard key={p.id} product={p} storeSlug={store.slug} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default Store;
