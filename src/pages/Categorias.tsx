import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { StoreCard } from "@/components/StoreCard";
import { useStores } from "@/hooks/useStores";
import { Loader2, Grid3x3, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const categories = [
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
  { label: "Mercado", emoji: "🛒", color: "from-blue-600/20 to-indigo-500/20", border: "border-blue-600/30", bg: "bg-blue-600/10" },
  { label: "Hortifruti", emoji: "🥦", color: "from-green-500/20 to-emerald-400/20", border: "border-green-500/30", bg: "bg-green-500/10" },
  { label: "Conveniência", emoji: "🏪", color: "from-blue-500/20 to-cyan-400/20", border: "border-blue-500/30", bg: "bg-blue-500/10" },
  { label: "Farmácia", emoji: "💊", color: "from-red-400/20 to-pink-400/20", border: "border-red-400/30", bg: "bg-red-400/10" },
  { label: "Pet shop", emoji: "🐶", color: "from-amber-500/20 to-yellow-500/20", border: "border-amber-500/30", bg: "bg-amber-500/10" },
  { label: "Floricultura", emoji: "💐", color: "from-pink-500/20 to-rose-400/20", border: "border-pink-500/30", bg: "bg-pink-500/10" },
  { label: "Presentes", emoji: "🎁", color: "from-red-500/20 to-purple-500/20", border: "border-red-500/30", bg: "bg-red-500/10" },
  { label: "Moda", emoji: "👕", color: "from-indigo-500/20 to-purple-500/20", border: "border-indigo-500/30", bg: "bg-indigo-500/10" },
  { label: "Beleza", emoji: "💄", color: "from-pink-600/20 to-rose-500/20", border: "border-pink-600/30", bg: "bg-pink-600/10" },
  { label: "Eletrônicos", emoji: "📱", color: "from-slate-500/20 to-gray-400/20", border: "border-slate-500/30", bg: "bg-slate-500/10" },
  { label: "Casa", emoji: "🏠", color: "from-blue-400/20 to-sky-500/20", border: "border-blue-400/30", bg: "bg-blue-400/10" },
  { label: "Bebê", emoji: "🍼", color: "from-blue-300/20 to-pink-300/20", border: "border-blue-300/30", bg: "bg-blue-300/10" },
  { label: "Brinquedos", emoji: "🧸", color: "from-yellow-400/20 to-orange-400/20", border: "border-yellow-400/30", bg: "bg-yellow-400/10" },
  { label: "Livraria", emoji: "📚", color: "from-amber-600/20 to-yellow-600/20", border: "border-amber-600/30", bg: "bg-amber-600/10" },
  { label: "Esportes", emoji: "⚽", color: "from-green-600/20 to-emerald-500/20", border: "border-green-600/30", bg: "bg-green-600/10" },
  { label: "Construção", emoji: "🔨", color: "from-orange-600/20 to-amber-600/20", border: "border-orange-600/30", bg: "bg-orange-600/10" },
  { label: "Auto peças", emoji: "🔧", color: "from-gray-500/20 to-slate-500/20", border: "border-gray-500/30", bg: "bg-gray-500/10" },
  { label: "Tabacaria", emoji: "🚬", color: "from-slate-600/20 to-gray-600/20", border: "border-slate-600/30", bg: "bg-slate-600/10" },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const Categorias = () => {
  const { data: stores = [], isLoading } = useStores();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredStores = selectedCategory
    ? stores.filter((s) => s.cuisine === selectedCategory)
    : [];

  if (selectedCategory) {
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
              {categories.find((c) => c.label === selectedCategory)?.emoji}
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
            <p className="text-sm text-muted-foreground">Escolha uma categoria para explorar</p>
          </div>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {categories.map((c) => (
            <motion.button
              key={c.label}
              variants={item}
              onClick={() => setSelectedCategory(c.label)}
              className={`group relative overflow-hidden rounded-2xl border-2 ${c.border} bg-gradient-to-br ${c.color} p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-95`}
            >
              <div className={`absolute inset-0 ${c.bg} opacity-50`} />
              <div className="relative flex flex-col items-center gap-2 text-center">
                <span className="text-4xl transition-transform duration-300 group-hover:scale-110 md:text-5xl">
                  {c.emoji}
                </span>
                <span className="text-xs font-bold leading-tight md:text-sm">{c.label}</span>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Categorias;
