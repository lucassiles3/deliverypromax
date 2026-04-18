import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, MapPin, Sparkles, LayoutDashboard, LogIn, LogOut, Store as StoreIcon, User as UserIcon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { useLoyalty, tierOf } from "@/hooks/useLoyalty";
import { useAuth } from "@/hooks/useAuth";

export const Header = () => {
  const { count, setOpen } = useCart();
  const loyalty = useLoyalty();
  const { user, signOut, isOwner } = useAuth();
  const tier = tierOf(loyalty.totalSpent);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const isAdminView = location.pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/85 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
            <span className="text-lg font-bold">F</span>
          </div>
          <span className="hidden font-display text-xl font-bold sm:inline">FoodFlash</span>
        </Link>

        {isHome && (
          <div className="hidden flex-1 items-center gap-2 md:flex">
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">São Paulo, SP</span>
            </div>
          </div>
        )}

        <div className="flex flex-1 items-center justify-end gap-2">
          {loyalty.cashback > 0 && (
            <div className="hidden items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success sm:flex">
              <Sparkles className="h-3.5 w-3.5" />
              R$ {loyalty.cashback.toFixed(2).replace(".", ",")}
            </div>
          )}
          {loyalty.totalSpent > 0 && (
            <div className="hidden items-center gap-1 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent-foreground md:flex">
              <span>{tier.emoji}</span>
              {tier.name}
            </div>
          )}
          {isOwner && (
            <button
              onClick={() => navigate(isAdminView ? "/" : "/admin")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-bounce hover:scale-105 ${
                isAdminView
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-accent/15 text-accent-foreground hover:bg-accent/25"
              }`}
              title={isAdminView ? "Ver como cliente" : "Ver como lojista"}
            >
              {isAdminView ? (
                <>
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Modo Cliente</span>
                </>
              ) : (
                <>
                  <StoreIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Modo Lojista</span>
                </>
              )}
            </button>
          )}
          {user ? (
            <button
              onClick={signOut}
              className="hidden items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground sm:flex"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-bold hover:bg-primary/10"
            >
              <LogIn className="h-3.5 w-3.5" /> Entrar
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            onClick={() => setOpen(true)}
            aria-label="Abrir carrinho"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground animate-pulse-glow">
                {count}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};
