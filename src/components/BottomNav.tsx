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
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-3 mb-3 rounded-[28px] border border-white/60 bg-white/95 shadow-[0_10px_40px_-8px_rgba(60,40,120,0.35)] backdrop-blur-xl">
        <ul className="flex items-center justify-around px-2">
          {items.map(({ to, label, icon: Icon, isCart }) => {
            const active = pathname === to;
            if (isCart) {
              return (
                <li key={to}>
                  <button
                    onClick={() => setOpen(true)}
                    className="relative -mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(265_80%_68%)] to-[hsl(250_70%_50%)] text-white shadow-[0_10px_30px_-6px_rgba(120,80,220,0.6)] ring-4 ring-white"
                    aria-label="Carrinho"
                  >
                    <Icon className="h-6 w-6" />
                    {count > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(42_96%_55%)] px-1 text-[11px] font-bold text-[hsl(250_60%_18%)] ring-2 ring-white">
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
                  className={`flex flex-col items-center gap-0.5 py-3 text-[11px] font-semibold transition-colors ${
                    active ? "text-[hsl(258_75%_55%)]" : "text-slate-500"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

