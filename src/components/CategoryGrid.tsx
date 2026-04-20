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

  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
      {CATEGORIES.map((cat) => {
        const available = isAvailable(cat);
        const Icon = cat.icon;
        const selected = active === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => available && onPick(selected ? null : cat.key)}
            disabled={!available}
            className={`group flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-smooth ${
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
      })}
      <button
        onClick={() => navigate("/categorias")}
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/50 p-3 text-center transition-smooth hover:-translate-y-0.5 hover:border-primary/30"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          ➕
        </div>
        <span className="text-[11px] font-semibold leading-tight">Ver todas</span>
      </button>
    </div>
  );
};
