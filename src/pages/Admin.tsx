import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  ShoppingBag,
  TrendingUp,
  Pause,
  Play,
  DollarSign,
  Clock,
  CheckCircle2,
  Truck,
  ChevronDown,
  MapPin,
  Phone,
  CreditCard,
  Banknote,
  QrCode,
  Bell,
  BellOff,
  Plus,
  Pencil,
  Search,
  History,
  Trash2,
  Menu as MenuIcon,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Utensils,
  Users as UsersIcon,
  Bike,
  Megaphone,
  Wallet,
  BarChart3,
  Store as StoreIcon,
  Settings as SettingsIcon,
  UserCog,
  Plug,
  Boxes,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrdersChannel } from "@/hooks/useOrdersChannel";
import { toast } from "sonner";
import { resolveAsset } from "@/lib/assetMap";
import { ProductFormData } from "@/components/admin/ProductFormModal";
import { CustomerHistoryDrawer } from "@/components/admin/CustomerHistoryDrawer";
// Tabs principais agora lazy — reduzem o bundle inicial do /admin
const ReportsTab = lazy(() => import("@/components/admin/ReportsTab").then(m => ({ default: m.ReportsTab })));
const DashboardTab = lazy(() => import("@/components/admin/DashboardTab").then(m => ({ default: m.DashboardTab })));
const MenuTab = lazy(() => import("@/components/admin/MenuTab").then(m => ({ default: m.MenuTab })));
const OrdersKanban = lazy(() => import("@/components/admin/OrdersKanban").then(m => ({ default: m.OrdersKanban })));
import { LocationPicker } from "@/components/admin/LocationPicker";
import { SubscriptionPaywall } from "@/components/admin/SubscriptionPaywall";
import { TrialBanner } from "@/components/admin/TrialBanner";
import { CATEGORIES, SUBCATEGORIES } from "@/components/CategoryGrid";

// Tabs pesadas: carregadas sob demanda para reduzir o bundle inicial do /admin
const SettingsTab = lazy(() => import("@/components/admin/SettingsTab").then(m => ({ default: m.SettingsTab })));
const StoreSettingsTab = lazy(() => import("@/components/admin/StoreSettingsTab").then(m => ({ default: m.StoreSettingsTab })));
const FinancialTab = lazy(() => import("@/components/admin/FinancialTab").then(m => ({ default: m.FinancialTab })));
const CustomersTab = lazy(() => import("@/components/admin/CustomersTab").then(m => ({ default: m.CustomersTab })));
const MarketingTab = lazy(() => import("@/components/admin/MarketingTab").then(m => ({ default: m.MarketingTab })));
const TeamTab = lazy(() => import("@/components/admin/TeamTab").then(m => ({ default: m.TeamTab })));
const IntegrationsTab = lazy(() => import("@/components/admin/IntegrationsTab").then(m => ({ default: m.IntegrationsTab })));
const PDVTab = lazy(() => import("@/components/admin/PDVTab").then(m => ({ default: m.PDVTab })));
const TablesTab = lazy(() => import("@/components/admin/TablesTab").then(m => ({ default: m.TablesTab })));
const CouriersTab = lazy(() => import("@/components/admin/CouriersTab").then(m => ({ default: m.CouriersTab })));
const StockTab = lazy(() => import("@/components/admin/StockTab"));
const HistoryTab = lazy(() => import("@/components/admin/HistoryTab"));
const SubscriptionManager = lazy(() => import("@/components/admin/SubscriptionManager").then(m => ({ default: m.SubscriptionManager })));

import { useStoreAccess, canAccessSection } from "@/hooks/useStoreAccess";
import { useStoreToggles } from "@/hooks/useStoreToggles";
import { StoreOpenToggle } from "@/components/admin/StoreOpenToggle";
import { Printer } from "lucide-react";

type DbStatus = "pending_payment" | "received" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
type Tab = "dashboard" | "orders" | "pdv" | "tables" | "products" | "stock" | "customers" | "marketing" | "financial" | "reports" | "history" | "store" | "settings" | "team" | "integrations" | "couriers" | "subscription";
type StatusFilter = "all" | "active" | DbStatus;
type MethodFilter = "all" | "delivery" | "pickup";

const statusConfig: Record<DbStatus, { label: string; color: string; icon: typeof Clock; next?: DbStatus }> = {
  pending_payment: { label: "Aguardando pgto", color: "bg-muted text-muted-foreground", icon: Clock, next: "received" },
  received: { label: "Recebido", color: "bg-blue-500/10 text-blue-600", icon: Clock, next: "preparing" },
  preparing: { label: "Em preparo", color: "bg-amber-500/10 text-amber-600", icon: Package, next: "ready" },
  ready: { label: "Pronto", color: "bg-blue-500/10 text-blue-600", icon: Package, next: "out_for_delivery" },
  out_for_delivery: { label: "Saiu p/ entrega", color: "bg-purple-500/10 text-purple-600", icon: Truck, next: "delivered" },
  delivered: { label: "Entregue", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive", icon: Clock },
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = sessionStorage.getItem("admin:initialTab");
      if (t) { sessionStorage.removeItem("admin:initialTab"); return t as Tab; }
    } catch {}
    return "dashboard";
  });
  const { toggles, update: updateToggles } = useStoreToggles(storeId);
  const soundEnabled = toggles.sound_alerts_enabled;
  const autoPrintEnabled = toggles.auto_print_enabled;

  // Filtros pedidos
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [search, setSearch] = useState("");
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);

  // Produtos
  const [productSearch, setProductSearch] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const playDing = () => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.4);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch {
      /* ignore */
    }
  };

  const { data: stores = [], isLoading: storesLoading } = useStoreAccess();
  const currentRole = useMemo(
    () => stores.find((s) => s.id === storeId)?.role ?? null,
    [stores, storeId],
  );

  useEffect(() => {
    if (!storeId && stores.length) setStoreId(stores[0].id);
  }, [stores, storeId]);

  // Estado da assinatura (gate do dono)
  const [bypassPaywall, setBypassPaywall] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { data: subState } = useQuery({
    queryKey: ["subscription-state", storeId, currentRole],
    enabled: !!storeId && currentRole === "owner",
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("store_subscription_state", { _store_id: storeId! });
      if (error) throw error;
      return data as any;
    },
  });

  // Se o tab atual não é permitido pelo papel, cai na primeira tab válida
  useEffect(() => {
    if (!currentRole) return;
    if (!canAccessSection(currentRole, tab)) {
      const order: Tab[] = ["dashboard","orders","tables","products","stock","customers","couriers","marketing","financial","reports","history","store","settings","team","integrations"];
      const next = order.find((t) => canAccessSection(currentRole, t));
      if (next && next !== tab) setTab(next);
    }
  }, [currentRole, tab]);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, description, price, old_price, active, image_url, bestseller, promo, stock, track_stock")
        .eq("store_id", storeId!)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, total, subtotal, delivery_fee, coupon_code, coupon_discount, cashback_used, status, method, payment_method, change_for, address, delivery_lat, delivery_lng, created_at, order_items(id, product_name, quantity, unit_price, notes, customizations)",
        )
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    // Realtime cobre invalidação; refetch só a cada 60s como segurança contra desconexão.
    refetchInterval: 60_000,
  });

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length,
    [orders],
  );

  useEffect(() => {
    const base = "Painel Admin • Itchat Brasil";
    document.title = pendingCount > 0 ? `(${pendingCount}) ${base}` : base;
  }, [pendingCount]);

  // Canal Realtime compartilhado (refcount em useOrdersChannel).
  // Som/popup/notificação são tratados globalmente em <NewOrderAlerts />;
  // aqui só invalidamos o cache para refletir mudanças na lista do admin.
  useOrdersChannel(storeId, () => {
    qc.invalidateQueries({ queryKey: ["admin-orders", storeId] });
  });

  const advanceStatus = async (id: string, current: DbStatus) => {
    const next = statusConfig[current].next;
    if (!next) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Pedido: ${statusConfig[next].label}`);
    qc.invalidateQueries({ queryKey: ["admin-orders", storeId] });
  };

  const cancelOrder = async (id: string) => {
    if (!confirm("Cancelar este pedido?")) return;
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pedido cancelado");
    qc.invalidateQueries({ queryKey: ["admin-orders", storeId] });
  };

  const togglePause = async (id: string, active: boolean) => {
    const { error } = await supabase.from("products").update({ active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products", storeId] });
  };

  const updatePrice = async (id: string, price: number) => {
    const { error } = await supabase.from("products").update({ price }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products", storeId] });
  };

  const updateStock = async (id: string, stock: number) => {
    const { error } = await supabase.from("products").update({ stock }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products", storeId] });
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto excluído");
    qc.invalidateQueries({ queryKey: ["admin-products", storeId] });
  };

  // criação/edição de produto vive dentro do MenuTab

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === "active") {
        if (o.status === "delivered" || o.status === "cancelled") return false;
      } else if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }
      if (methodFilter !== "all" && o.method !== methodFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hit =
          o.id.toLowerCase().startsWith(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.customer_phone ?? "").includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, statusFilter, methodFilter, search]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, productSearch]);

  const kpis = useMemo(() => {
    const today = orders.reduce((s, o) => s + Number(o.total), 0);
    const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
    const avg = orders.length ? today / orders.length : 0;
    return { revenue: today, active, avg, count: orders.length };
  }, [orders]);

  if (authLoading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!storesLoading && stores.length === 0) {
    return <CreateStoreOnboarding userId={user.id} userEmail={user.email ?? ""} />;
  }

  // Bloqueia o painel para o dono quando o trial acabou e ainda não pagou
  if (
    storeId &&
    currentRole === "owner" &&
    ((subState && subState.state === "expired" && !bypassPaywall) || showPaywall)
  ) {
    return (
      <SubscriptionPaywall
        storeId={storeId}
        onActive={() => {
          setBypassPaywall(true);
          setShowPaywall(false);
        }}
      />
    );
  }

  const currentStore = stores.find((s) => s.id === storeId);


  const sections: { id: Tab; label: string; icon: typeof Clock }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "Pedidos ao vivo", icon: ShoppingCart },
    { id: "pdv", label: "PDV", icon: Receipt },
    { id: "tables", label: "Salão / Mesas", icon: Utensils },
    { id: "products", label: "Catálogo", icon: Package },
    { id: "stock", label: "Estoque", icon: Boxes },
    { id: "customers", label: "Clientes", icon: UsersIcon },

    { id: "couriers", label: "Entregadores", icon: Bike },
    { id: "marketing", label: "Marketing", icon: Megaphone },
    { id: "financial", label: "Financeiro", icon: Wallet },
    { id: "reports", label: "Relatórios", icon: BarChart3 },
    { id: "history", label: "Histórico", icon: History },
    { id: "store", label: "Loja", icon: StoreIcon },
    { id: "settings", label: "Operação", icon: SettingsIcon },
    { id: "team", label: "Equipe", icon: UserCog },
    { id: "integrations", label: "Integrações", icon: Plug },
    { id: "subscription", label: "Assinatura", icon: CreditCard },
  ];
  const visibleSections = sections.filter((s) => canAccessSection(currentRole, s.id));
  const currentSection = visibleSections.find((s) => s.id === tab);

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-2 md:h-16 md:gap-3">
          {/* Mobile: menu hamburger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-border bg-card md:hidden"
                aria-label="Abrir menu"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[85vw] max-w-sm flex-col p-0">
              <SheetHeader className="border-b p-4 text-left">
                <SheetTitle className="font-display text-lg">Menu</SheetTitle>
              </SheetHeader>

              <div className="border-b p-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Loja</label>
                <select
                  value={storeId ?? ""}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                >
                  {stores.map((s) => {
                    const isUrl = typeof s.logo === "string" && /^https?:\/\//i.test(s.logo);
                    const badge = !s.logo || isUrl ? "🏪" : s.logo;
                    return (
                      <option key={s.id} value={s.id}>
                        {badge} {s.name}
                      </option>
                    );
                  })}
                </select>
                <div className="mt-3">
                  <StoreOpenToggle storeId={storeId} variant="inline" className="w-full justify-center" />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const next = !soundEnabled;
                      updateToggles({ sound_alerts_enabled: next });
                      if (next) playDing();
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-bold transition-smooth ${
                      soundEnabled
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {soundEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                    Som
                  </button>
                  <button
                    onClick={() => updateToggles({ auto_print_enabled: !autoPrintEnabled })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-bold transition-smooth ${
                      autoPrintEnabled
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir
                  </button>
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto p-2">
                {visibleSections.map((s) => {
                  const Icon = s.icon;
                  const active = tab === s.id;
                  const showBadge = s.id === "orders" && pendingCount > 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setTab(s.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition-smooth ${
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="flex-1">{s.label}</span>
                      {showBadge && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-muted-foreground hover:bg-muted"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Voltar ao app
                </Link>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Desktop: link voltar + título */}
          <Link to="/" className="hidden items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground md:flex">
            <ArrowLeft className="h-4 w-4" /> App
          </Link>

          {/* Mobile: nome da seção atual */}
          <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            {currentSection && (
              <>
                <currentSection.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <h1 className="truncate font-display text-sm font-bold leading-tight">{currentSection.label}</h1>
                {tab === "orders" && pendingCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Desktop: ações no header */}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <button
              onClick={() => {
                const next = !soundEnabled;
                updateToggles({ sound_alerts_enabled: next });
                if (next) playDing();
              }}
              className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-smooth ${
                soundEnabled
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              }`}
              title={soundEnabled ? "Som ligado" : "Som desligado"}
            >
              {soundEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              Som
            </button>
            <button
              onClick={() => updateToggles({ auto_print_enabled: !autoPrintEnabled })}
              className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-smooth ${
                autoPrintEnabled
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              }`}
              title={autoPrintEnabled ? "Impressão automática ligada" : "Impressão automática desligada"}
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
            <select
              value={storeId ?? ""}
              onChange={(e) => setStoreId(e.target.value)}
              className="rounded-xl border-2 border-border bg-card px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary"
            >
              {stores.map((s) => {
                const isUrl = typeof s.logo === "string" && /^https?:\/\//i.test(s.logo);
                const badge = !s.logo || isUrl ? "🏪" : s.logo;
                return (
                  <option key={s.id} value={s.id}>
                    {badge} {s.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </header>

      {currentRole === "owner" && (
        <TrialBanner state={subState} onSubscribe={() => setShowPaywall(true)} />
      )}

      <div className="container py-3 md:py-6 md:flex md:gap-6">
        {/* Sidebar (tablet/desktop) */}
        <aside className="hidden md:block md:w-56 lg:w-64 shrink-0">
          <nav className="sticky top-20 flex flex-col gap-1 rounded-2xl border-2 border-border bg-card p-2 shadow-soft">
            {visibleSections.map((s) => {
              const Icon = s.icon;
              const active = tab === s.id;
              const showBadge = s.id === "orders" && pendingCount > 0;
              return (
                <button
                  key={s.id}
                  onClick={() => setTab(s.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-smooth ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="flex-1 truncate">{s.label}</span>
                  {showBadge && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 rounded-2xl gradient-primary p-2 text-primary-foreground shadow-soft md:mb-6 md:p-5">
            <div className="grid grid-cols-4 gap-1 md:grid-cols-4 md:gap-4">
              <KpiBlock icon={DollarSign} label="Faturamento" value={`R$ ${kpis.revenue.toFixed(2).replace(".", ",")}`} />
              <KpiBlock icon={ShoppingBag} label="Pedidos" value={String(kpis.count)} divider />
              <KpiBlock icon={Package} label="Andamento" value={String(kpis.active)} divider />
              <KpiBlock icon={TrendingUp} label="Ticket" value={`R$ ${kpis.avg.toFixed(0)}`} divider />
            </div>
          </div>

          {tab === "pdv" && storeId && !toggles.pdv_enabled && (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center">
              <h3 className="font-display text-lg font-bold">PDV desabilitado</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Habilite o PDV em <strong>Operação → PDV</strong> para vender no balcão.
              </p>
            </div>
          )}

          <Suspense fallback={<TabSkeleton />}>
            {tab === "dashboard" && storeId && canAccessSection(currentRole, "dashboard") && <DashboardTab storeId={storeId} onNavigate={(t) => setTab(t as Tab)} />}
            {tab === "orders" && storeId && canAccessSection(currentRole, "orders") && <OrdersKanban storeId={storeId} />}
            {tab === "products" && storeId && canAccessSection(currentRole, "products") && <MenuTab storeId={storeId} />}
            {tab === "pdv" && storeId && currentStore && canAccessSection(currentRole, "pdv") && toggles.pdv_enabled && (
              <PDVTab storeId={storeId} storeName={currentStore.name} />
            )}
            {tab === "tables" && storeId && canAccessSection(currentRole, "tables") && <TablesTab storeId={storeId} />}
            {tab === "stock" && storeId && canAccessSection(currentRole, "stock") && <StockTab storeId={storeId} />}
            {tab === "customers" && storeId && canAccessSection(currentRole, "customers") && <CustomersTab storeId={storeId} />}
            {tab === "couriers" && storeId && canAccessSection(currentRole, "couriers") && <CouriersTab storeId={storeId} />}
            {tab === "marketing" && storeId && canAccessSection(currentRole, "marketing") && <MarketingTab storeId={storeId} />}
            {tab === "financial" && storeId && currentStore && canAccessSection(currentRole, "financial") && (
              <FinancialTab storeId={storeId} storeName={currentStore.name} />
            )}
            {tab === "reports" && storeId && currentStore && canAccessSection(currentRole, "reports") && (
              <ReportsTab storeId={storeId} storeName={currentStore.name} />
            )}
            {tab === "history" && storeId && canAccessSection(currentRole, "history") && <HistoryTab storeId={storeId} />}
            {tab === "store" && storeId && canAccessSection(currentRole, "store") && <StoreSettingsTab storeId={storeId} />}
            {tab === "settings" && storeId && canAccessSection(currentRole, "settings") && <SettingsTab storeId={storeId} />}
            {tab === "team" && storeId && canAccessSection(currentRole, "team") && <TeamTab storeId={storeId} />}
            {tab === "integrations" && storeId && canAccessSection(currentRole, "integrations") && <IntegrationsTab storeId={storeId} />}
            {tab === "subscription" && storeId && currentRole === "owner" && <SubscriptionManager storeId={storeId} />}
          </Suspense>
        </div>
      </div>


      {storeId && (
        <CustomerHistoryDrawer
          phone={historyPhone}
          storeId={storeId}
          onClose={() => setHistoryPhone(null)}
        />
      )}

      {storeId && currentRole === "owner" && <StoreOpenToggle storeId={storeId} />}
    </div>
  );
};

const TabSkeleton = () => (
  <div className="space-y-3">
    <div className="h-10 w-1/3 animate-pulse rounded-xl bg-muted" />
    <div className="h-48 w-full animate-pulse rounded-2xl bg-muted" />
    <div className="h-24 w-full animate-pulse rounded-2xl bg-muted" />
  </div>
);

const KpiBlock = ({
  icon: Icon,
  label,
  value,
  divider,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  divider?: boolean;
}) => (
  <div className={divider ? "md:border-l md:border-primary-foreground/20 md:pl-4" : ""}>
    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider opacity-80 md:text-[11px] md:gap-1.5">
      <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-0.5 font-display text-sm font-bold leading-tight md:mt-1 md:text-2xl">{value}</div>
  </div>
);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

const CreateStoreOnboarding = ({ userId, userEmail }: { userId: string; userEmail: string }) => {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"ask" | "external" | "store">("ask");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState<import("@/components/admin/LocationPicker").PickedLocation | null>(null);
  const [categoryKey, setCategoryKey] = useState("");
  const [subKey, setSubKey] = useState("");
  const subOptions = categoryKey ? (SUBCATEGORIES[categoryKey] ?? []) : [];
  const selectedCategory = CATEGORIES.find((c) => c.key === categoryKey);
  const selectedSub = subOptions.find((s) => s.key === subKey);
  const cuisine = selectedSub?.label || selectedCategory?.label || "";
  const [saving, setSaving] = useState(false);

  const isListingsManager = userEmail.toLowerCase() === "suporteitchat@gmail.com";

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const finalSlug = slugify(slug || name);
    if (!name.trim() || !finalSlug) {
      toast.error("Informe o nome da loja");
      return;
    }
    setSaving(true);

    // Garante role de lojista
    await supabase.functions.invoke("claim-owner-role").catch(() => null);

    const { data: existing } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();

    const slugToUse = existing ? `${finalSlug}-${Math.random().toString(36).slice(2, 6)}` : finalSlug;

    const { error } = await supabase.from("stores").insert({
      owner_id: userId,
      name: name.trim(),
      slug: slugToUse,
      phone: phone.trim() || null,
      whatsapp_phone: phone.trim() || null,
      city: location?.city ?? null,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      cuisine: cuisine.trim() || null,
      open: true,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível criar a loja");
      return;
    }
    toast.success("Loja criada! Vamos configurar 🚀");
    try { sessionStorage.setItem("admin:initialTab", "store"); } catch {}
    await qc.invalidateQueries({ queryKey: ["store-access"] });
    await qc.invalidateQueries({ queryKey: ["stores"] });
  };

  if (mode === "ask") {
    return (
      <div className="min-h-screen bg-muted/40 px-4 py-10">
        <div className="container mx-auto max-w-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-glow">
              <StoreIcon className="h-7 w-7" />
            </div>
            <h1 className="font-display text-3xl font-bold">Bem-vindo ao itChat 👋</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Antes de começarmos: você já possui um catálogo digital em outra plataforma
              (ex.: Anota Aí, Cardápio Web, Menudino) e gostaria de continuar usando?
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setMode("external")}
              className="rounded-3xl bg-card p-6 text-left shadow-float transition-smooth hover:shadow-glow hover:border-primary border-2 border-transparent"
            >
              <div className="text-2xl">✅</div>
              <div className="mt-2 font-display text-lg font-bold">Sim, já tenho</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Cadastre o link do seu catálogo atual e apareça no itChat para os clientes.
              </div>
            </button>
            <button
              onClick={() => setMode("store")}
              className="rounded-3xl bg-card p-6 text-left shadow-float transition-smooth hover:shadow-glow hover:border-primary border-2 border-transparent"
            >
              <div className="text-2xl">🏪</div>
              <div className="mt-2 font-display text-lg font-bold">Não, quero criar</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Crie sua loja completa no itChat com cardápio, pedidos e entregas.
              </div>
            </button>
          </div>
          <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">
            ← Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  if (mode === "external") {
    return (
      <ExternalCatalogOnboarding
        userId={userId}
        onBack={() => setMode("ask")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="container mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <button
            onClick={() => setMode("ask")}
            className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-glow">
            <StoreIcon className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-bold">Vamos criar sua loja 🏪</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Em poucos segundos você terá seu delivery no ar. Depois você ajusta horários, cardápio, taxa de entrega e formas de pagamento.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-3xl bg-card p-6 shadow-float space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome da loja *</label>
            <input
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Hamburgueria do João"
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Link da sua loja *</label>
            <div className="mt-1 flex items-center rounded-xl border-2 border-border bg-background overflow-hidden focus-within:border-primary">
              <span className="px-3 py-3 text-xs text-muted-foreground border-r border-border bg-muted/50">/loja/</span>
              <input
                required
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                placeholder="hamburgueria-do-joao"
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
              />
            </div>
          </div>
          <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">WhatsApp</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Localização da loja *
            </label>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              Busque seu endereço, use sua localização atual ou toque no mapa para soltar o alfinete.
            </p>
            <LocationPicker value={location} onChange={setLocation} />
          </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Segmento</label>
              <select
                value={categoryKey}
                onChange={(e) => { setCategoryKey(e.target.value); setSubKey(""); }}
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Selecione um segmento…</option>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subcategoria</label>
              <select
                value={subKey}
                onChange={(e) => setSubKey(e.target.value)}
                disabled={!categoryKey || subOptions.length === 0}
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">{categoryKey ? "Selecione uma subcategoria…" : "Escolha o segmento primeiro"}</option>
                {subOptions.map((s) => (
                  <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={saving}
            className="h-12 w-full rounded-xl bg-accent text-accent-foreground font-bold shadow-glow hover:bg-accent/90"
          >
            {saving ? "Criando sua loja..." : "Criar loja e continuar configurando →"}
          </Button>

          {isListingsManager && (
            <Link
              to="/admin/parceiros"
              className="block text-center text-xs font-bold text-primary hover:underline"
            >
              Gerenciar estabelecimentos parceiros
            </Link>
          )}
          <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            ← Voltar ao início
          </Link>
        </form>
      </div>
    </div>
  );
};

type ExtHours = Record<string, { open: string; close: string; closed: boolean }>;
const EXT_DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];
const defaultExtHours: ExtHours = EXT_DAYS.reduce((acc, d) => {
  acc[d.key] = { open: "09:00", close: "18:00", closed: false };
  return acc;
}, {} as ExtHours);

const ExternalCatalogOnboarding = ({ userId, onBack }: { userId: string; onBack: () => void }) => {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("🏪");
  const [categoryKey, setCategoryKey] = useState(CATEGORIES[0].key);
  const [subKey, setSubKey] = useState("");
  const [catalogUrl, setCatalogUrl] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hours, setHours] = useState<ExtHours>(defaultExtHours);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const subOptions = SUBCATEGORIES[categoryKey] ?? [];

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo deve ter no máximo 2MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("listing-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("listing-logos").getPublicUrl(path);
    setLogo(data.publicUrl);
    toast.success("Logo enviada");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) return toast.error("Informe o nome do estabelecimento");
    if (!catalogUrl.trim()) return toast.error("Informe o link do seu catálogo");
    setSaving(true);
    const { error } = await supabase.from("external_listings" as any).insert({
      name: name.trim(),
      logo: logo.trim() || null,
      category_key: categoryKey,
      subcategory_key: subKey || null,
      catalog_url: catalogUrl.trim(),
      address: address.trim() || null,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      opening_hours: hours,
      active: true,
      delivery_time: deliveryTime || null,
      delivery_fee: deliveryFee,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Seu catálogo foi cadastrado no itChat! 🎉");
    qc.invalidateQueries({ queryKey: ["external-listings"] });
    onBack();
  };

  const isImageUrl = (s: string) => /^https?:\/\//i.test(s);

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="container mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <button
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-glow">
            <StoreIcon className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-bold">Cadastre seu catálogo 🔗</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Adicione o link do seu catálogo digital existente e apareça no itChat para milhares de clientes.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-3xl bg-card p-6 shadow-float space-y-4">
          <div className="flex gap-3">
            <label className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted text-3xl hover:border-primary">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
              {isImageUrl(logo) ? (
                <img src={logo} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span>{logo || "🏪"}</span>
              )}
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/80 text-[10px] font-bold">
                  Enviando...
                </span>
              )}
            </label>
            <div className="flex-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pizzaria do João"
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Clique na imagem para enviar a logo</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Link do seu catálogo *
            </label>
            <input
              required
              value={catalogUrl}
              onChange={(e) => setCatalogUrl(e.target.value)}
              placeholder="https://anota.ai/seu-restaurante"
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Cole aqui o link do Anota Aí, Cardápio Web, Menudino ou qualquer outro catálogo digital.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Segmento *</label>
              <select
                value={categoryKey}
                onChange={(e) => { setCategoryKey(e.target.value); setSubKey(""); }}
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subcategoria</label>
              <select
                value={subKey}
                onChange={(e) => setSubKey(e.target.value)}
                disabled={subOptions.length === 0}
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">Selecione…</option>
                {subOptions.map((s) => (
                  <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Endereço</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade"
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 inline-block">
              Localização no mapa
            </label>
            <LocationPicker
              value={location ? { lat: location.lat, lng: location.lng, address: address || "" } : null}
              onChange={(c) => setLocation({ lat: c.lat, lng: c.lng })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tempo de entrega</label>
              <select
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Selecione...</option>
                {[20, 30, 40, 50, 60, 90].map((m) => (
                  <option key={m} value={`${m} min`}>{`Até ${m} min`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Frete a partir de (R$)</label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={deliveryFee ?? ""}
                onChange={(e) => setDeliveryFee(e.target.value === "" ? null : Number(e.target.value))}
                placeholder="0,00"
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Horário de funcionamento
            </label>
            <div className="mt-2 space-y-1.5">
              {EXT_DAYS.map((d) => {
                const h = hours[d.key];
                return (
                  <div key={d.key} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                    <span className="w-10 text-xs font-bold uppercase">{d.label}</span>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={!h.closed}
                        onChange={(e) => setHours({ ...hours, [d.key]: { ...h, closed: !e.target.checked } })}
                      />
                      {h.closed ? "Fechado" : "Aberto"}
                    </label>
                    {!h.closed && (
                      <div className="ml-auto flex items-center gap-1">
                        <input
                          type="time"
                          value={h.open}
                          onChange={(e) => setHours({ ...hours, [d.key]: { ...h, open: e.target.value } })}
                          className="rounded border px-2 py-1 text-xs"
                        />
                        <span className="text-muted-foreground">→</span>
                        <input
                          type="time"
                          value={h.close}
                          onChange={(e) => setHours({ ...hours, [d.key]: { ...h, close: e.target.value } })}
                          className="rounded border px-2 py-1 text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={saving}
            className="h-12 w-full rounded-xl bg-accent text-accent-foreground font-bold shadow-glow hover:bg-accent/90"
          >
            {saving ? "Cadastrando..." : "Cadastrar catálogo no itChat →"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Admin;


