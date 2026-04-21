import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { StoreCard } from "@/components/StoreCard";
import { useStores } from "@/hooks/useStores";
import { Loader2, Grid3x3, ArrowLeft, UtensilsCrossed, ShoppingBag, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type Cat = {
  label: string;
  emoji: string;
  color: string;
  border: string;
  bg: string;
};

const segments: { id: string; title: string; icon: typeof UtensilsCrossed; subtitle: string; items: Cat[] }[] = [
  {
    id: "comida",
    title: "Comida & Bebida",
    subtitle: "Restaurantes, lanches e delivery",
    icon: UtensilsCrossed,
    items: [
      { label: "Hambúrgueres", emoji: "🍔", color: "from-orange-500/20 to-red-500/20", border: "border-orange-500/30", bg: "bg-orange-500/10" },
      { label: "Pizzaria", emoji: "🍕", color: "from-yellow-500/20 to-orange-500/20", border: "border-yellow-500/30", bg: "bg-yellow-500/10" },
      { label: "Japonesa", emoji: "🍣", color: "from-red-500/20 to-pink-500/20", border: "border-red-500/30", bg: "bg-red-500/10" },
      { label: "Brasileira", emoji: "🍛", color: "from-green-500/20 to-yellow-500/20", border: "border-green-500/30", bg: "bg-green-500/10" },
      { label: "Italiana", emoji: "🍝", color: "from-red-600/20 to-green-600/20", border: "border-red-600/30", bg: "bg-red-600/10" },
      { label: "Mexicana", emoji: "🌮", color: "from-green-500/20 to-red-500/20", border: "border-green-500/30", bg: "bg-green-500/10" },
      { label: "Árabe", emoji: "🥙", color: "from-amber-500/20 to-orange-500/20", border: "border-amber-500/30", bg: "bg-amber-500/10" },
      { label: "Saudável", emoji: "🥗", color: "from-green-400/20 to-emerald-500/20", border: "border-green-400/30", bg: "bg-green-400/10" },
      { label: "Vegana", emoji: "🌱", color: "from-green-600/20 to-lime-500/20", border: "border-green-600/30", bg: "bg-green-600/10" },
      { label: "Frutos do mar", emoji: "🦐", color: "from-blue-500/20 to-cyan-500/20", border: "border-blue-500/30", bg: "bg-blue-500/10" },
      { label: "Churrasco", emoji: "🥩", color: "from-red-700/20 to-orange-600/20", border: "border-red-700/30", bg: "bg-red-700/10" },
      { label: "Lanches", emoji: "🥪", color: "from-amber-600/20 to-yellow-600/20", border: "border-amber-600/30", bg: "bg-amber-600/10" },
      { label: "Açaí", emoji: "🍧", color: "from-purple-500/20 to-pink-500/20", border: "border-purple-500/30", bg: "bg-purple-500/10" },
      { label: "Sobremesas", emoji: "🍰", color: "from-pink-400/20 to-rose-500/20", border: "border-pink-400/30", bg: "bg-pink-400/10" },
      { label: "Doces", emoji: "🍩", color: "from-pink-500/20 to-purple-500/20", border: "border-pink-500/30", bg: "bg-pink-500/10" },
      { label: "Padaria", emoji: "🥐", color: "from-amber-400/20 to-orange-400/20", border: "border-amber-400/30", bg: "bg-amber-400/10" },
      { label: "Cafeteria", emoji: "☕", color: "from-amber-700/20 to-amber-500/20", border: "border-amber-700/30", bg: "bg-amber-700/10" },
      { label: "Sucos", emoji: "🥤", color: "from-orange-400/20 to-yellow-400/20", border: "border-orange-400/30", bg: "bg-orange-400/10" },
      { label: "Bebidas", emoji: "🍹", color: "from-red-500/20 to-pink-400/20", border: "border-red-500/30", bg: "bg-red-500/10" },
    ],
  },
  {
    id: "mercado",
    title: "Mercado & Essenciais",
    subtitle: "Tudo para o dia a dia",
    icon: ShoppingBag,
    items: [
      { label: "Mercado", emoji: "🛒", color: "from-blue-600/20 to-indigo-500/20", border: "border-blue-600/30", bg: "bg-blue-600/10" },
      { label: "Hortifruti", emoji: "🥦", color: "from-green-500/20 to-emerald-400/20", border: "border-green-500/30", bg: "bg-green-500/10" },
      { label: "Conveniência", emoji: "🏪", color: "from-blue-500/20 to-cyan-400/20", border: "border-blue-500/30", bg: "bg-blue-500/10" },
      { label: "Farmácia", emoji: "💊", color: "from-red-400/20 to-pink-400/20", border: "border-red-400/30", bg: "bg-red-400/10" },
      { label: "Pet shop", emoji: "🐶", color: "from-amber-500/20 to-yellow-500/20", border: "border-amber-500/30", bg: "bg-amber-500/10" },
      { label: "Floricultura", emoji: "💐", color: "from-pink-500/20 to-rose-400/20", border: "border-pink-500/30", bg: "bg-pink-500/10" },
      { label: "Bebê", emoji: "🍼", color: "from-blue-300/20 to-pink-300/20", border: "border-blue-300/30", bg: "bg-blue-300/10" },
    ],
  },
  {
    id: "lifestyle",
    title: "Lifestyle & Compras",
    subtitle: "Moda, beleza, tecnologia e mais",
    icon: Sparkles,
    items: [
      { label: "Presentes", emoji: "🎁", color: "from-red-500/20 to-purple-500/20", border: "border-red-500/30", bg: "bg-red-500/10" },
      { label: "Moda", emoji: "👕", color: "from-indigo-500/20 to-purple-500/20", border: "border-indigo-500/30", bg: "bg-indigo-500/10" },
      { label: "Beleza", emoji: "💄", color: "from-pink-600/20 to-rose-500/20", border: "border-pink-600/30", bg: "bg-pink-600/10" },
      { label: "Eletrônicos", emoji: "📱", color: "from-slate-500/20 to-gray-400/20", border: "border-slate-500/30", bg: "bg-slate-500/10" },
      { label: "Casa", emoji: "🏠", color: "from-blue-400/20 to-sky-500/20", border: "border-blue-400/30", bg: "bg-blue-400/10" },
      { label: "Brinquedos", emoji: "🧸", color: "from-yellow-400/20 to-orange-400/20", border: "border-yellow-400/30", bg: "bg-yellow-400/10" },
      { label: "Livraria", emoji: "📚", color: "from-amber-600/20 to-yellow-600/20", border: "border-amber-600/30", bg: "bg-amber-600/10" },
      { label: "Esportes", emoji: "⚽", color: "from-green-600/20 to-emerald-500/20", border: "border-green-600/30", bg: "bg-green-600/10" },
      { label: "Construção", emoji: "🔨", color: "from-orange-600/20 to-amber-600/20", border: "border-orange-600/30", bg: "bg-orange-600/10" },
      { label: "Auto peças", emoji: "🔧", color: "from-gray-500/20 to-slate-500/20", border: "border-gray-500/30", bg: "bg-gray-500/10" },
      { label: "Tabacaria", emoji: "🚬", color: "from-slate-600/20 to-gray-600/20", border: "border-slate-600/30", bg: "bg-slate-600/10" },
    ],
  },
];

const allCategories = segments.flatMap((s) => s.items);

const CategoryCard = ({ cat, onClick, index }: { cat: Cat; onClick: () => void; index: number }) => (
  <motion.button
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.03 }}
    onClick={onClick}
    className={`group relative flex w-32 shrink-0 snap-start flex-col items-center gap-2 overflow-hidden rounded-2xl border-2 ${cat.border} bg-gradient-to-br ${cat.color} p-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg active:scale-95 sm:w-36`}
  >
    <div className={`absolute inset-0 ${cat.bg} opacity-50`} />
    <div className="relative flex flex-col items-center gap-2 text-center">
      <span className="text-4xl transition-transform duration-300 group-hover:scale-110 sm:text-5xl">
        {cat.emoji}
      </span>
      <span className="text-xs font-bold leading-tight sm:text-sm">{cat.label}</span>
    </div>
  </motion.button>
);

const Categorias = () => {
  const { data: stores = [], isLoading } = useStores();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredStores = selectedCategory
    ? stores.filter((s) => s.cuisine === selectedCategory)
    : [];

  if (selectedCategory) {
    const cat = allCategories.find((c) => c.label === selectedCategory);
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <div className="container py-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar às categorias
          </button>

          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-2xl">
              {cat?.emoji}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{selectedCategory}</h1>
              <p className="text-sm text-muted-foreground">
                {filteredStores.length} {filteredStores.length === 1 ? "loja encontrada" : "lojas encontradas"}
              </p>
            </div>
          </div>

          {isLoading ? (
            <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-primary" />
          ) : filteredStores.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
              Nenhuma loja nesta categoria por enquanto.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStores.map((s, i) => (
                <StoreCard key={s.id} store={s} index={i} />
              ))}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

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

        <div className="space-y-8">
          {segments.map((seg) => (
            <section key={seg.id}>
              <div className="mb-3 flex items-center gap-2 px-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <seg.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold leading-tight">{seg.title}</h2>
                  <p className="text-xs text-muted-foreground">{seg.subtitle}</p>
                </div>
              </div>

              <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
                {seg.items.map((cat, i) => (
                  <CategoryCard
                    key={cat.label}
                    cat={cat}
                    index={i}
                    onClick={() => setSelectedCategory(cat.label)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Categorias;
