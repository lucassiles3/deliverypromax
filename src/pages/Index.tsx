import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { StoreCard } from "@/components/StoreCard";
import { SocialProof } from "@/components/SocialProof";
import { PromoCountdown } from "@/components/PromoCountdown";
import { stores } from "@/data/stores";
import { Search, Sparkles } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";

const categories = [
  { label: "Todos", emoji: "✨" },
  { label: "Hambúrgueres", emoji: "🍔" },
  { label: "Pizzaria", emoji: "🍕" },
  { label: "Japonesa", emoji: "🍣" },
  { label: "Sobremesas", emoji: "🍰" },
];

const Index = () => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      const matchCat = filter === "Todos" || s.cuisine === filter;
      const matchQuery = !query || s.name.toLowerCase().includes(query.toLowerCase()) || s.cuisine.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [query, filter]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBanner} alt="" width={1600} height={800} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/70 to-foreground/40" />
        </div>
        <div className="container relative py-14 md:py-20">
          <div className="max-w-2xl text-background">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Mais de 1.200 lojas perto de você
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] md:text-6xl">
              Sua fome,
              <br />
              <span className="bg-gradient-to-r from-accent via-primary-glow to-secondary bg-clip-text text-transparent">
                resolvida em minutos.
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-background/85 md:text-lg">
              Os melhores restaurantes da cidade, entrega expressa e promoções relâmpago todos os dias.
            </p>

            <div className="mt-6 flex max-w-xl items-center gap-2 rounded-2xl bg-background p-2 shadow-float">
              <Search className="ml-3 h-5 w-5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busque por restaurante ou prato..."
                className="flex-1 bg-transparent py-2 text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button className="hidden rounded-xl gradient-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition-bounce hover:scale-105 sm:block">
                Buscar
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PromoCountdown />
              <SocialProof />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container py-8">
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
          {categories.map((c) => (
            <button
              key={c.label}
              onClick={() => setFilter(c.label)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-smooth ${
                filter === c.label
                  ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <span className="text-base">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Stores */}
      <section className="container pb-20">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">Restaurantes em destaque</h2>
            <p className="text-sm text-muted-foreground">Os mais pedidos da sua região agora</p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
            Nenhuma loja encontrada.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s, i) => (
              <StoreCard key={s.id} store={s} index={i} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t bg-card">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p className="font-display text-lg font-bold text-foreground">FoodFlash</p>
          <p className="mt-1">A máquina de vendas para restaurantes • Demo</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
