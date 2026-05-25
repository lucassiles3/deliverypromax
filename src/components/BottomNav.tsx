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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex items-center justify-around">
        {items.map(({ to, label, icon: Icon, isCart }) => {
          const active = pathname === to;
          if (isCart) {
            return (
              <li key={to}>
                <button
                  onClick={() => setOpen(true)}
                  className="relative -mt-5 flex h-14 w-14 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow"
                  aria-label="Carrinho"
                >
                  <Icon className="h-6 w-6" />
                  {count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-[11px] font-bold text-secondary-foreground">
                      {count}
                    </span>
                  )}
                </button>
              </li>
            );
          }
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
