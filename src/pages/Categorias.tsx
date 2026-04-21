import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { StoreCard } from "@/components/StoreCard";
import { useStores } from "@/hooks/useStores";
import { Loader2, Grid3x3 } from "lucide-react";

const categories = [
  { label: "Todos", emoji: "✨" },
  // Comida
  { label: "Hambúrgueres", emoji: "🍔" },
  { label: "Pizzaria", emoji: "🍕" },
  { label: "Japonesa", emoji: "🍣" },
  { label: "Brasileira", emoji: "🍛" },
  { label: "Italiana", emoji: "🍝" },
  { label: "Mexicana", emoji: "🌮" },
  { label: "Árabe", emoji: "🥙" },
  { label: "Saudável", emoji: "🥗" },
  { label: "Vegana", emoji: "🌱" },
  { label: "Frutos do mar", emoji: "🦐" },
  { label: "Churrasco", emoji: "🥩" },
  { label: "Lanches", emoji: "🥪" },
  { label: "Açaí", emoji: "🍧" },
  { label: "Sobremesas", emoji: "🍰" },
  { label: "Doces", emoji: "🍩" },
  { label: "Padaria", emoji: "🥐" },
  { label: "Cafeteria", emoji: "☕" },
  { label: "Sucos", emoji: "🥤" },
  { label: "Bebidas", emoji: "🍹" },
  // Outros segmentos
  { label: "Mercado", emoji: "🛒" },
  { label: "Hortifruti", emoji: "🥦" },
  { label: "Conveniência", emoji: "🏪" },
  { label: "Farmácia", emoji: "💊" },
  { label: "Pet shop", emoji: "🐶" },
  { label: "Floricultura", emoji: "💐" },
  { label: "Presentes", emoji: "🎁" },
  { label: "Moda", emoji: "👕" },
  { label: "Beleza", emoji: "💄" },
  { label: "Eletrônicos", emoji: "📱" },
  { label: "Casa", emoji: "🏠" },
  { label: "Bebê", emoji: "🍼" },
  { label: "Brinquedos", emoji: "🧸" },
  { label: "Livraria", emoji: "📚" },
  { label: "Esportes", emoji: "⚽" },
  { label: "Material de construção", emoji: "🔨" },
  { label: "Auto peças", emoji: "🔧" },
  { label: "Tabacaria", emoji: "🚬" },
];

const Categorias = () => {
  const { data: stores = [], isLoading } = useStores();
  const [filter, setFilter] = useState("Todos");

  const filtered = useMemo(
    () => (filter === "Todos" ? stores : stores.filter((s) => s.cuisine === filter)),
    [stores, filter],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="container py-6">
        <div className="mb-5 flex items-center gap-2">
          <Grid3x3 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold md:text-3xl">Categorias</h1>
        </div>

        <div className="scrollbar-hide -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:flex-wrap md:overflow-visible">
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

        {isLoading ? (
          <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-primary" />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
            Nenhuma loja nesta categoria por enquanto.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s, i) => (
              <StoreCard key={s.id} store={s} index={i} />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Categorias;
