import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Store as StoreIcon,
  CreditCard,
  ShoppingBag,
  Users,
  Activity,
  LifeBuoy,
  LogOut,
  Shield,
  Image as ImageIcon,
} from "lucide-react";
import MasterDashboard from "@/components/master/MasterDashboard";
import MasterStores from "@/components/master/MasterStores";
import MasterSubscriptions from "@/components/master/MasterSubscriptions";
import MasterOrders from "@/components/master/MasterOrders";
import MasterUsers from "@/components/master/MasterUsers";
import MasterLogs from "@/components/master/MasterLogs";
import MasterSupport from "@/components/master/MasterSupport";
import MasterBanners from "@/components/master/MasterBanners";


type View =
  | "dashboard"
  | "stores"
  | "subscriptions"
  | "orders"
  | "users"
  | "banners"
  | "logs"
  | "support";

const NAV: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "stores", label: "Lojas", icon: StoreIcon },
  { key: "subscriptions", label: "Assinaturas", icon: CreditCard },
  { key: "orders", label: "Pedidos", icon: ShoppingBag },
  { key: "users", label: "Usuários", icon: Users },
  { key: "banners", label: "Banners", icon: ImageIcon },
  { key: "logs", label: "Logs", icon: Activity },
  { key: "support", label: "Suporte", icon: LifeBuoy },
];


export default function Master() {
  const nav = useNavigate();
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) {
        nav("/auth?redirect=/master", { replace: true });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const isMaster = roles?.some((r) => r.role === "super_admin");
      if (!isMaster) {
        setAuthState("denied");
      } else {
        setAuthState("ok");
      }
    })();
    return () => { mounted = false; };
  }, [nav]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    nav("/auth");
  };

  const ActiveView = useMemo(() => {
    switch (view) {
      case "dashboard": return <MasterDashboard />;
      case "stores": return <MasterStores />;
      case "subscriptions": return <MasterSubscriptions />;
      case "orders": return <MasterOrders />;
      case "users": return <MasterUsers />;
      case "banners": return <MasterBanners />;
      case "logs": return <MasterLogs />;
      case "support": return <MasterSupport />;
    }
  }, [view]);


  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }
  if (authState === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" /> Acesso negado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este painel é restrito ao Super Administrador da plataforma itChat.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => nav("/")}>Voltar ao início</Button>
              <Button variant="destructive" onClick={handleLogout}>Sair</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold">itChat Master</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted text-foreground/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
          <h1 className="text-xl font-bold capitalize">
            {NAV.find((n) => n.key === view)?.label}
          </h1>
          <p className="text-xs text-muted-foreground">Painel Mestre — itChat SaaS</p>
        </header>
        <div className="p-6">{ActiveView}</div>
      </main>
    </div>
  );
}
