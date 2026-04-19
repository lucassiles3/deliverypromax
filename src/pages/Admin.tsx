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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useStoreAccess, canAccessSection } from "@/hooks/useStoreAccess";
import { useStoreToggles } from "@/hooks/useStoreToggles";
import { Printer } from "lucide-react";

type DbStatus = "pending_payment" | "received" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
type Tab = "dashboard" | "orders" | "pdv" | "products" | "customers" | "marketing" | "financial" | "reports" | "store" | "settings" | "team" | "integrations";
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
      const order: Tab[] = ["dashboard","orders","products","customers","marketing","financial","reports","store","settings","team","integrations"];
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
    const base = "Painel Admin • FoodFlash";
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
            playDing();
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
    return (
      <div className="min-h-screen bg-muted/40 p-6">
        <div className="container mx-auto max-w-md rounded-2xl bg-card p-8 text-center shadow-soft">
          <h1 className="font-display text-2xl font-bold">Sem lojas atribuídas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ainda não é dona de nenhuma loja. Fale com o administrador.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">← Voltar</Link>
        </div>
      </div>
    );
  }

  const currentStore = stores.find((s) => s.id === storeId);

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> App
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-xl font-bold">Painel do dono</h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                setSoundEnabled((v) => !v);
                if (!soundEnabled) playDing();
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

      <div className="container py-6">
        <div className="mb-6 rounded-2xl gradient-primary p-5 text-primary-foreground shadow-soft">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiBlock icon={DollarSign} label="Faturamento" value={`R$ ${kpis.revenue.toFixed(2).replace(".", ",")}`} />
            <KpiBlock icon={ShoppingBag} label="Pedidos" value={String(kpis.count)} divider />
            <KpiBlock icon={Package} label="Em andamento" value={String(kpis.active)} divider />
            <KpiBlock icon={TrendingUp} label="Ticket médio" value={`R$ ${kpis.avg.toFixed(2).replace(".", ",")}`} divider />
          </div>
        </div>

        <div className="mb-5 flex gap-2 border-b overflow-x-auto">
          {[
            { id: "dashboard" as const, label: "Dashboard" },
            { id: "orders" as const, label: "Pedidos ao vivo" },
            { id: "products" as const, label: "Cardápio" },
            { id: "customers" as const, label: "Clientes" },
            { id: "marketing" as const, label: "Marketing" },
            { id: "financial" as const, label: "Financeiro" },
            { id: "reports" as const, label: "Relatórios" },
            { id: "store" as const, label: "Loja" },
            { id: "settings" as const, label: "Operação" },
            { id: "team" as const, label: "Equipe" },
            { id: "integrations" as const, label: "Integrações" },
          ]
            .filter((t) => canAccessSection(currentRole, t.id))
            .map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-bold transition-smooth ${
                  tab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {t.id === "orders" && pendingCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground animate-pulse">
                    {pendingCount}
                  </span>
                )}
                {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
        </div>

        {tab === "dashboard" && storeId && canAccessSection(currentRole, "dashboard") && <DashboardTab storeId={storeId} />}
        {tab === "orders" && storeId && canAccessSection(currentRole, "orders") && <OrdersKanban storeId={storeId} />}
        {tab === "products" && storeId && canAccessSection(currentRole, "products") && <MenuTab storeId={storeId} />}
        {tab === "customers" && storeId && canAccessSection(currentRole, "customers") && <CustomersTab storeId={storeId} />}
        {tab === "marketing" && storeId && canAccessSection(currentRole, "marketing") && <MarketingTab storeId={storeId} />}
        {tab === "financial" && storeId && currentStore && canAccessSection(currentRole, "financial") && (
          <FinancialTab storeId={storeId} storeName={currentStore.name} />
        )}
        {tab === "reports" && storeId && currentStore && canAccessSection(currentRole, "reports") && (
          <ReportsTab storeId={storeId} storeName={currentStore.name} />
        )}
        {tab === "store" && storeId && canAccessSection(currentRole, "store") && <StoreSettingsTab storeId={storeId} />}
        {tab === "settings" && storeId && canAccessSection(currentRole, "settings") && <SettingsTab storeId={storeId} />}
        {tab === "team" && storeId && canAccessSection(currentRole, "team") && <TeamTab storeId={storeId} />}
        {tab === "integrations" && storeId && canAccessSection(currentRole, "integrations") && <IntegrationsTab storeId={storeId} />}
      </div>

      {storeId && (
        <CustomerHistoryDrawer
          phone={historyPhone}
          storeId={storeId}
          onClose={() => setHistoryPhone(null)}
        />
      )}
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
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-80">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-1 font-display text-2xl font-bold leading-tight">{value}</div>
  </div>
);

export default Admin;
