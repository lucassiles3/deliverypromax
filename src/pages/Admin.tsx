import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { resolveAsset } from "@/lib/assetMap";
import { ProductFormData } from "@/components/admin/ProductFormModal";
import { CustomerHistoryDrawer } from "@/components/admin/CustomerHistoryDrawer";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { MenuTab } from "@/components/admin/MenuTab";
import { OrdersKanban } from "@/components/admin/OrdersKanban";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { StoreSettingsTab } from "@/components/admin/StoreSettingsTab";
import { FinancialTab } from "@/components/admin/FinancialTab";
import { CustomersTab } from "@/components/admin/CustomersTab";
import { MarketingTab } from "@/components/admin/MarketingTab";
import { TeamTab } from "@/components/admin/TeamTab";
import { IntegrationsTab } from "@/components/admin/IntegrationsTab";
import { PDVTab } from "@/components/admin/PDVTab";
import { TablesTab } from "@/components/admin/TablesTab";
import { CouriersTab } from "@/components/admin/CouriersTab";
import StockTab from "@/components/admin/StockTab";
import HistoryTab from "@/components/admin/HistoryTab";

import { useStoreAccess, canAccessSection } from "@/hooks/useStoreAccess";
import { useStoreToggles } from "@/hooks/useStoreToggles";
import { StoreOpenToggle } from "@/components/admin/StoreOpenToggle";
import { Printer } from "lucide-react";

type DbStatus = "pending_payment" | "received" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
type Tab = "dashboard" | "orders" | "pdv" | "tables" | "products" | "stock" | "customers" | "marketing" | "financial" | "reports" | "history" | "store" | "settings" | "team" | "integrations" | "couriers";
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
  const [tab, setTab] = useState<Tab>("dashboard");
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
    refetchInterval: 15000,
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

  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`orders:${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin-orders", storeId] });
          if (payload.eventType === "INSERT") {
            toast.success("🔔 Novo pedido recebido!");
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, qc, soundEnabled]);

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
                <SheetTitle className="font-display text-lg">Painel do dono</SheetTitle>
              </SheetHeader>

              <div className="border-b p-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Loja</label>
                <select
                  value={storeId ?? ""}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.logo} {s.name}
                    </option>
                  ))}
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
          <span className="hidden text-border md:inline">|</span>
          <h1 className="hidden font-display text-xl font-bold md:block">Painel do dono</h1>

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
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.logo} {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

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

          {tab === "dashboard" && storeId && canAccessSection(currentRole, "dashboard") && <DashboardTab storeId={storeId} onNavigate={(t) => setTab(t as Tab)} />}
          {tab === "orders" && storeId && canAccessSection(currentRole, "orders") && <OrdersKanban storeId={storeId} />}
          {tab === "pdv" && storeId && currentStore && canAccessSection(currentRole, "pdv") && toggles.pdv_enabled && (
            <PDVTab storeId={storeId} storeName={currentStore.name} />
          )}
          {tab === "pdv" && storeId && !toggles.pdv_enabled && (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center">
              <h3 className="font-display text-lg font-bold">PDV desabilitado</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Habilite o PDV em <strong>Operação → PDV</strong> para vender no balcão.
              </p>
            </div>
          )}
          {tab === "tables" && storeId && canAccessSection(currentRole, "tables") && <TablesTab storeId={storeId} />}
          {tab === "products" && storeId && canAccessSection(currentRole, "products") && <MenuTab storeId={storeId} />}
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
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState<import("@/components/admin/LocationPicker").PickedLocation | null>(null);
  const [cuisine, setCuisine] = useState("");
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
      city: city.trim() || null,
      cuisine: cuisine.trim() || null,
      open: true,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível criar a loja");
      return;
    }
    toast.success("Loja criada! Vamos configurar 🚀");
    await qc.invalidateQueries({ queryKey: ["stores"] });
  };

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="container mx-auto max-w-xl">
        <div className="mb-6 text-center">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cidade</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="São Paulo"
                className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Segmento</label>
            <input
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="Hamburgueria, Pizzaria, Mercado…"
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
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

export default Admin;

