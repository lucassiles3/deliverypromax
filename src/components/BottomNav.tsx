import { Link, useLocation } from "react-router-dom";
import { Home, Grid3x3, ShoppingBag, Receipt, User } from "lucide-react";
import { useCart } from "@/context/CartContext";

const items = [
  { to: "/", label: "Início", icon: Home },
  { to: "/categorias", label: "Categorias", icon: Grid3x3 },
  { to: "/carrinho", label: "Carrinho", icon: ShoppingBag, isCart: true },
  { to: "/meus-pedidos", label: "Pedidos", icon: Receipt },
  { to: "/conta", label: "Conta", icon: User },
];

const HIDE_ON = ["/auth", "/reset-password", "/admin", "/pdv", "/checkout"];

export const BottomNav = () => {
  const { pathname } = useLocation();
  const { count, setOpen } = useCart();

  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 md:hidden">
      <div className="glass-strong mx-auto flex max-w-md items-center justify-around rounded-[28px] px-2 py-2 shadow-float">
        {items.map(({ to, label, icon: Icon, isCart }) => {
          const active = pathname === to;
          if (isCart) {
            return (
              <button
                key={to}
                onClick={() => setOpen(true)}
                className="relative -mt-6 flex h-14 w-14 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow transition-bounce hover:scale-105"
                aria-label="Carrinho"
              >
                <Icon className="h-6 w-6" strokeWidth={2.2} />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          }
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition-smooth ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
