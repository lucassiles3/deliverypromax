import { UtensilsCrossed, ShoppingCart, Pill, Shirt, Laptop, Wrench, Dog, Sparkles, Beer, Home, Smartphone, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export type CategoryDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  emoji: string; // 3D-style emoji used in claymorphism cards
  color: string; // tailwind classes for bg + text (used in legacy desktop grid)
  match: string[]; // cuisine matches (lowercased)
};

export const CATEGORIES: CategoryDef[] = [
  { key: "food", label: "Alimentação", icon: UtensilsCrossed, emoji: "🥕", color: "bg-primary/10 text-primary", match: ["hambúrguer", "hamburguer", "pizzaria", "pizza", "japonesa", "comida", "lanche", "açaí", "sobremesas", "doceria", "padaria", "restaurante"] },
  { key: "market", label: "Mercado", icon: ShoppingCart, emoji: "🛒", color: "bg-success/10 text-success", match: ["mercado", "supermercado", "hortifruti"] },
  { key: "pharmacy", label: "Farmácia", icon: Pill, emoji: "💊", color: "bg-secondary/10 text-secondary", match: ["farmácia", "farmacia", "drogaria"] },
  { key: "fashion", label: "Moda", icon: Shirt, emoji: "👕", color: "bg-accent/15 text-accent-foreground", match: ["moda", "roupa", "calçado"] },
  { key: "tech", label: "Informática", icon: Laptop, emoji: "💻", color: "bg-primary/10 text-primary", match: ["informática", "informatica", "tecnologia"] },
  { key: "auto", label: "Mecânica", icon: Wrench, emoji: "🔧", color: "bg-muted text-foreground", match: ["mecânica", "mecanica", "oficina", "auto"] },
  { key: "pet", label: "Pet Shop", icon: Dog, emoji: "🐾", color: "bg-accent/15 text-accent-foreground", match: ["pet"] },
  { key: "beauty", label: "Beleza", icon: Sparkles, emoji: "💄", color: "bg-secondary/10 text-secondary", match: ["beleza", "salão", "salao", "estética", "estetica", "cosmético", "cosmetico"] },
  { key: "drinks", label: "Bebidas", icon: Beer, emoji: "🍺", color: "bg-accent/15 text-accent-foreground", match: ["bebida", "adega", "cerveja"] },
  { key: "home", label: "Casa", icon: Home, emoji: "🛋️", color: "bg-success/10 text-success", match: ["casa", "utilidade", "decoração", "decoracao"] },
  { key: "phones", label: "Celulares", icon: Smartphone, emoji: "📱", color: "bg-primary/10 text-primary", match: ["celular", "smartphone", "iphone"] },
  { key: "services", label: "Serviços", icon: Truck, emoji: "🚚", color: "bg-muted text-foreground", match: ["serviço", "servico"] },
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



// Ordem e rótulos exibidos na home (idêntico ao mockup)
const HOME_ORDER: { key: string; label?: string; emoji?: string }[] = [
  { key: "market", label: "Mercado" },
  { key: "pharmacy", label: "Farmácia" },
  { key: "fashion", label: "Moda" },
  { key: "pet", label: "Pet Shop" },
  { key: "food", label: "Alimentação", emoji: "🍔" },
  { key: "drinks", label: "Bebidas" },
  { key: "tech", label: "Eletrônicos", emoji: "📺" },
  { key: "home", label: "Casa e Decoração", emoji: "🛋️" },
];

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

  const homeCats = HOME_ORDER.map((o) => {
    const base = CATEGORIES.find((c) => c.key === o.key);
    if (!base) return null;
    return { ...base, label: o.label ?? base.label, emoji: o.emoji ?? base.emoji };
  }).filter(Boolean) as CategoryDef[];

  const renderCategory = (cat: CategoryDef) => {
    const available = isAvailable(cat);
    const selected = active === cat.key;
    return (
      <button
        key={cat.key}
        onClick={() => available && onPick(selected ? null : cat.key)}
        disabled={!available}
        className={`group flex flex-col items-center gap-1.5 text-center transition-bounce ${
          !available ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5"
        }`}
      >
        <div
          className={`flex aspect-square w-full items-center justify-center rounded-2xl bg-white text-[34px] shadow-[0_8px_20px_-8px_rgba(60,40,120,0.45)] transition-bounce ${
            selected ? "ring-2 ring-accent scale-[1.03]" : "group-hover:scale-[1.03]"
          }`}
        >
          <span className="drop-shadow-sm">{cat.emoji}</span>
        </div>
        <span className="px-0.5 text-[12px] font-semibold leading-tight text-foreground">
          {cat.label}
        </span>
      </button>
    );
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {homeCats.map(renderCategory)}
    </div>
  );
};

