import { UtensilsCrossed, ShoppingCart, Pill, Shirt, Laptop, Wrench, Dog, Sparkles, Beer, Home, Smartphone, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export type CategoryDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // tailwind classes for bg + text
  match: string[]; // cuisine matches (lowercased)
};

export const CATEGORIES: CategoryDef[] = [
  { key: "food", label: "Alimentação", icon: UtensilsCrossed, color: "bg-primary/10 text-primary", match: ["hambúrguer", "hamburguer", "pizzaria", "pizza", "japonesa", "comida", "lanche", "açaí", "sobremesas", "doceria", "padaria", "restaurante"] },
  { key: "market", label: "Mercado", icon: ShoppingCart, color: "bg-success/10 text-success", match: ["mercado", "supermercado", "hortifruti"] },
  { key: "pharmacy", label: "Farmácia", icon: Pill, color: "bg-secondary/10 text-secondary", match: ["farmácia", "farmacia", "drogaria"] },
  { key: "fashion", label: "Moda", icon: Shirt, color: "bg-accent/15 text-accent-foreground", match: ["moda", "roupa", "calçado"] },
  { key: "tech", label: "Informática", icon: Laptop, color: "bg-primary/10 text-primary", match: ["informática", "informatica", "tecnologia"] },
  { key: "auto", label: "Mecânica", icon: Wrench, color: "bg-muted text-foreground", match: ["mecânica", "mecanica", "oficina", "auto"] },
  { key: "pet", label: "Pet Shop", icon: Dog, color: "bg-accent/15 text-accent-foreground", match: ["pet"] },
  { key: "beauty", label: "Beleza", icon: Sparkles, color: "bg-secondary/10 text-secondary", match: ["beleza", "salão", "salao", "estética", "estetica", "cosmético", "cosmetico"] },
  { key: "drinks", label: "Bebidas", icon: Beer, color: "bg-accent/15 text-accent-foreground", match: ["bebida", "adega", "cerveja"] },
  { key: "home", label: "Casa", icon: Home, color: "bg-success/10 text-success", match: ["casa", "utilidade", "decoração", "decoracao"] },
  { key: "phones", label: "Celulares", icon: Smartphone, color: "bg-primary/10 text-primary", match: ["celular", "smartphone", "iphone"] },
  { key: "services", label: "Serviços", icon: Truck, color: "bg-muted text-foreground", match: ["serviço", "servico"] },
];

export const matchCategory = (cuisine: string | null | undefined, cat: CategoryDef) => {
  if (!cuisine) return false;
  const c = cuisine.toLowerCase();
  return cat.match.some((m) => c.includes(m));
};

export type SubcategoryDef = { key: string; label: string; emoji: string; match: string[] };

export const SUBCATEGORIES: Record<string, SubcategoryDef[]> = {
  food: [
    { key: "burger", label: "Hambúrguer", emoji: "🍔", match: ["hambúrguer", "hamburguer", "burger"] },
    { key: "pizza", label: "Pizzaria", emoji: "🍕", match: ["pizza"] },
    { key: "japanese", label: "Japonesa", emoji: "🍣", match: ["japonesa", "sushi"] },
    { key: "brazilian", label: "Brasileira", emoji: "🍛", match: ["brasileira", "caseira"] },
    { key: "italian", label: "Italiana", emoji: "🍝", match: ["italiana", "massa"] },
    { key: "mexican", label: "Mexicana", emoji: "🌮", match: ["mexicana", "taco"] },
    { key: "arabic", label: "Árabe", emoji: "🥙", match: ["árabe", "arabe", "esfiha"] },
    { key: "healthy", label: "Saudável", emoji: "🥗", match: ["saudável", "saudavel", "fit", "natural"] },
    { key: "vegan", label: "Vegana", emoji: "🌱", match: ["vegana", "vegano"] },
    { key: "seafood", label: "Frutos do mar", emoji: "🦐", match: ["frutos do mar", "peixe", "camarão"] },
    { key: "bbq", label: "Churrasco", emoji: "🥩", match: ["churrasco", "carne"] },
    { key: "snack", label: "Lanches", emoji: "🥪", match: ["lanche", "salgado"] },
    { key: "acai", label: "Açaí", emoji: "🍧", match: ["açaí", "acai"] },
    { key: "dessert", label: "Sobremesas", emoji: "🍰", match: ["sobremesa", "doceria", "doce"] },
    { key: "bakery", label: "Padaria", emoji: "🥐", match: ["padaria", "pão", "pao"] },
    { key: "coffee", label: "Cafeteria", emoji: "☕", match: ["cafeteria", "café", "cafe"] },
    { key: "juice", label: "Sucos", emoji: "🥤", match: ["suco", "vitamina"] },
    { key: "drinks_depot", label: "Depósito de bebidas", emoji: "🍾", match: ["depósito de bebidas", "deposito de bebidas", "bebidas"] },
  ],
  market: [
    { key: "supermarket", label: "Supermercado", emoji: "🛒", match: ["supermercado", "mercado"] },
    { key: "hortifruti", label: "Hortifruti", emoji: "🥦", match: ["hortifruti", "verdura", "fruta"] },
    { key: "convenience", label: "Conveniência", emoji: "🏪", match: ["conveniência", "conveniencia"] },
    { key: "wholesale", label: "Atacado", emoji: "📦", match: ["atacado"] },
  ],
  pharmacy: [
    { key: "drogaria", label: "Drogaria", emoji: "💊", match: ["drogaria", "farmácia", "farmacia"] },
    { key: "manipulation", label: "Manipulação", emoji: "🧪", match: ["manipulação", "manipulacao"] },
    { key: "natural", label: "Produtos naturais", emoji: "🌿", match: ["natural", "fitoterápico"] },
  ],
  fashion: [
    { key: "clothing", label: "Roupas", emoji: "👕", match: ["roupa", "moda"] },
    { key: "shoes", label: "Calçados", emoji: "👟", match: ["calçado", "calcado", "sapato", "tênis"] },
    { key: "accessories", label: "Acessórios", emoji: "👜", match: ["acessório", "acessorio", "bolsa"] },
    { key: "kids", label: "Infantil", emoji: "🧸", match: ["infantil", "criança"] },
  ],
  tech: [
    { key: "computers", label: "Informática", emoji: "💻", match: ["informática", "informatica", "computador"] },
    { key: "support", label: "Assistência técnica", emoji: "🛠️", match: ["assistência", "assistencia", "conserto"] },
    { key: "games", label: "Games", emoji: "🎮", match: ["game", "jogo"] },
  ],
  auto: [
    { key: "mechanic", label: "Mecânica", emoji: "🔧", match: ["mecânica", "mecanica", "oficina"] },
    { key: "parts", label: "Auto peças", emoji: "⚙️", match: ["auto peça", "peças", "pecas"] },
    { key: "wash", label: "Lava jato", emoji: "🚿", match: ["lava jato", "lava-jato"] },
    { key: "tire", label: "Borracharia", emoji: "🛞", match: ["borracharia", "pneu"] },
  ],
  pet: [
    { key: "petshop", label: "Pet Shop", emoji: "🐶", match: ["pet shop", "petshop", "pet"] },
    { key: "food", label: "Ração", emoji: "🦴", match: ["ração", "racao"] },
    { key: "grooming", label: "Banho e tosa", emoji: "🛁", match: ["banho", "tosa"] },
    { key: "vet", label: "Veterinário", emoji: "🩺", match: ["veterinário", "veterinario"] },
  ],
  beauty: [
    { key: "salon", label: "Salão", emoji: "💇", match: ["salão", "salao", "cabelo"] },
    { key: "esthetic", label: "Estética", emoji: "✨", match: ["estética", "estetica"] },
    { key: "cosmetics", label: "Cosméticos", emoji: "💄", match: ["cosmético", "cosmetico", "maquiagem"] },
    { key: "barber", label: "Barbearia", emoji: "💈", match: ["barbearia", "barbeiro"] },
  ],
  drinks: [
    { key: "cellar", label: "Adega", emoji: "🍷", match: ["adega", "vinho"] },
    { key: "beer", label: "Cervejaria", emoji: "🍺", match: ["cerveja"] },
    { key: "distributor", label: "Distribuidora", emoji: "🍻", match: ["distribuidora", "bebida"] },
  ],
  home: [
    { key: "furniture", label: "Móveis", emoji: "🛋️", match: ["móvel", "movel", "móveis"] },
    { key: "decor", label: "Decoração", emoji: "🖼️", match: ["decoração", "decoracao"] },
    { key: "utilities", label: "Utilidades", emoji: "🧰", match: ["utilidade"] },
    { key: "construction", label: "Construção", emoji: "🧱", match: ["construção", "construcao", "material"] },
  ],
  phones: [
    { key: "smartphone", label: "Celulares", emoji: "📱", match: ["celular", "smartphone", "iphone"] },
    { key: "accessories", label: "Acessórios", emoji: "🎧", match: ["acessório", "capa", "fone"] },
    { key: "support", label: "Assistência", emoji: "🔧", match: ["assistência", "assistencia", "conserto"] },
  ],
  services: [
    { key: "delivery", label: "Entrega/Frete", emoji: "🚚", match: ["entrega", "frete", "motoboy"] },
    { key: "cleaning", label: "Limpeza", emoji: "🧹", match: ["limpeza", "diarista"] },
    { key: "reform", label: "Reformas", emoji: "🪚", match: ["reforma", "pintor", "pedreiro"] },
    { key: "other", label: "Outros serviços", emoji: "🛠️", match: ["serviço", "servico"] },
  ],
};

export const matchSubcategory = (cuisine: string | null | undefined, sub: SubcategoryDef) => {
  if (!cuisine) return false;
  const c = cuisine.toLowerCase();
  return sub.match.some((m) => c.includes(m));
};



export const CategoryGrid = ({
  availableCuisines,
  active,
  onPick,
}: {
  availableCuisines: string[];
  active: string | null;
  onPick: (key: string | null) => void;
}) => {
  const navigate = useNavigate();
  const cuisinesLower = availableCuisines.map((c) => c.toLowerCase());

  const isAvailable = (cat: CategoryDef) =>
    cuisinesLower.some((c) => cat.match.some((m) => c.includes(m)));

  const renderCategory = (cat: CategoryDef) => {
    const available = isAvailable(cat);
    const Icon = cat.icon;
    const selected = active === cat.key;
    return (
      <button
        key={cat.key}
        onClick={() => available && onPick(selected ? null : cat.key)}
        disabled={!available}
        className={`group flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-smooth sm:shrink ${
          selected
            ? "border-primary bg-primary/5 shadow-soft"
            : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft"
        } ${!available ? "cursor-not-allowed opacity-40" : ""}`}
      >
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-bounce ${cat.color} ${
            selected ? "scale-110" : "group-hover:scale-110"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[11px] font-semibold leading-tight">{cat.label}</span>
        {!available && <span className="text-[9px] text-muted-foreground">Em breve</span>}
      </button>
    );
  };

  const seeAllBtn = (
    <button
      onClick={() => navigate("/categorias")}
      className="flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/50 p-3 text-center transition-smooth hover:-translate-y-0.5 hover:border-primary/30 sm:shrink"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        ➕
      </div>
      <span className="text-[11px] font-semibold leading-tight">Ver todas</span>
    </button>
  );

  return (
    <>
      {/* Mobile: scroll horizontal */}
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:hidden">
        {CATEGORIES.map(renderCategory)}
        {seeAllBtn}
      </div>
      {/* Tablet/Desktop: grid */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
        {CATEGORIES.map(renderCategory)}
        {seeAllBtn}
      </div>
    </>
  );
};
