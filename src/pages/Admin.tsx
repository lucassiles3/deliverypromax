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
import { ProductFormModal, ProductFormData } from "@/components/admin/ProductFormModal";
import { CustomerHistoryDrawer } from "@/components/admin/CustomerHistoryDrawer";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { MenuTab } from "@/components/admin/MenuTab";

type DbStatus = "pending_payment" | "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
type Tab = "dashboard" | "orders" | "products" | "reports";
type StatusFilter = "all" | "active" | DbStatus;
type MethodFilter = "all" | "delivery" | "pickup";

const statusConfig: Record<DbStatus, { label: string; color: string; icon: typeof Clock; next?: DbStatus }> = {
  pending_payment: { label: "Aguardando pgto", color: "bg-muted text-muted-foreground", icon: Clock, next: "received" },
  received: { label: "Recebido", color: "bg-blue-500/10 text-blue-600", icon: Clock, next: "preparing" },
  preparing: { label: "Em preparo", color: "bg-amber-500/10 text-amber-600", icon: Package, next: "out_for_delivery" },
  out_for_delivery: { label: "Saiu p/ entrega", color: "bg-purple-500/10 text-purple-600", icon: Truck, next: "delivered" },
  delivered: { label: "Entregue", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive", icon: Clock },
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [soundEnabled, setSoundEnabled] = useState(true);

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

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ["admin-stores", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name, logo, slug").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!storeId && stores.length) setStoreId(stores[0].id);
  }, [stores, storeId]);

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

  const openNew = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };
  const openEdit = (p: any) => {
    setEditingProduct({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: Number(p.price),
      old_price: p.old_price !== null ? Number(p.old_price) : null,
      image_url: p.image_url,
      active: p.active,
      bestseller: p.bestseller,
      promo: p.promo,
      track_stock: !!p.track_stock,
      stock: p.stock,
    });
    setProductModalOpen(true);
  };

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
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={DollarSign} label="Faturamento" value={`R$ ${kpis.revenue.toFixed(2).replace(".", ",")}`} accent="primary" />
          <Kpi icon={ShoppingBag} label="Pedidos" value={String(kpis.count)} />
          <Kpi icon={Package} label="Em andamento" value={String(kpis.active)} />
          <Kpi icon={TrendingUp} label="Ticket médio" value={`R$ ${kpis.avg.toFixed(2).replace(".", ",")}`} />
        </div>

        <div className="mb-5 flex gap-2 border-b">
          {[
            { id: "dashboard" as const, label: "Dashboard" },
            { id: "orders" as const, label: "Pedidos ao vivo" },
            { id: "products" as const, label: "Produtos" },
            { id: "reports" as const, label: "Relatórios" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-smooth ${
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

        {tab === "dashboard" && storeId && <DashboardTab storeId={storeId} />}

        {tab === "orders" && (
          <div className="space-y-3">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 shadow-soft">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por #, nome ou telefone..."
                  className="w-full rounded-lg border-2 bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-lg border-2 bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="active">Ativos</option>
                <option value="all">Todos</option>
                <option value="received">Recebidos</option>
                <option value="preparing">Em preparo</option>
                <option value="out_for_delivery">Saiu p/ entrega</option>
                <option value="delivered">Entregues</option>
                <option value="cancelled">Cancelados</option>
              </select>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}
                className="rounded-lg border-2 bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="all">Todos métodos</option>
                <option value="delivery">🛵 Entrega</option>
                <option value="pickup">🏪 Retirada</option>
              </select>
            </div>

            {filteredOrders.length === 0 && (
              <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
                Nenhum pedido encontrado com esses filtros.
              </p>
            )}
            {filteredOrders.map((o) => {
              const cfg = statusConfig[o.status as DbStatus];
              const Icon = cfg.icon;
              const orderItems = (o.order_items ?? []) as Array<{
                id: string;
                product_name: string;
                quantity: number;
                unit_price: number;
                notes: string | null;
                customizations: any;
              }>;
              const itemsCount = orderItems.length;
              const time = new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              const isOpen = expandedOrder === o.id;
              const addr = o.address as
                | { street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; cep?: string }
                | null;
              const PayIcon =
                o.payment_method === "pix"
                  ? QrCode
                  : o.payment_method === "cash"
                    ? Banknote
                    : CreditCard;
              const payLabel: Record<string, string> = {
                pix: "Pix",
                cash: "Dinheiro",
                credit: "Cartão de crédito",
                debit: "Cartão de débito",
              };
              return (
                <div key={o.id} className="overflow-hidden rounded-2xl bg-card shadow-soft">
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="font-display text-lg">#{o.id.slice(0, 6).toUpperCase()}</strong>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {o.method === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          <PayIcon className="h-3 w-3" /> {payLabel[o.payment_method ?? "pix"]}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <button
                          onClick={() => setHistoryPhone(o.customer_phone)}
                          className="font-semibold hover:text-primary hover:underline"
                          title="Ver histórico do cliente"
                        >
                          {o.customer_name}
                        </button>
                        {" "}• {itemsCount} itens • {time}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-display text-lg font-bold">
                          R$ {Number(o.total).toFixed(2).replace(".", ",")}
                        </div>
                      </div>
                      <button
                        onClick={() => setHistoryPhone(o.customer_phone)}
                        className="rounded-lg p-2 hover:bg-muted"
                        title="Histórico do cliente"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setExpandedOrder(isOpen ? null : o.id)}
                        className="rounded-lg p-2 hover:bg-muted"
                        aria-label="Ver detalhes"
                      >
                        <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {cfg.next && (
                        <Button
                          onClick={() => advanceStatus(o.id, o.status as DbStatus)}
                          size="sm"
                          className="rounded-xl gradient-primary font-bold"
                        >
                          Avançar →
                        </Button>
                      )}
                      {o.status !== "delivered" && o.status !== "cancelled" && (
                        <button
                          onClick={() => cancelOrder(o.id)}
                          className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                          title="Cancelar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t bg-muted/30 p-4 text-sm">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Cliente</h4>
                          <p className="font-semibold">{o.customer_name}</p>
                          <a
                            href={`https://wa.me/55${o.customer_phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" /> {o.customer_phone}
                          </a>

                          {o.method === "delivery" && addr && (
                            <div className="mt-3">
                              <h4 className="mb-1 text-xs font-bold uppercase text-muted-foreground">Endereço</h4>
                              <p className="text-sm">
                                {addr.street}, {addr.number}
                                {addr.complement ? ` — ${addr.complement}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {addr.neighborhood}
                                {addr.city ? ` — ${addr.city}` : ""} • CEP {addr.cep}
                              </p>
                              {o.delivery_lat && o.delivery_lng && (
                                <a
                                  href={`https://www.google.com/maps?q=${o.delivery_lat},${o.delivery_lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                >
                                  <MapPin className="h-3 w-3" /> Abrir no Google Maps
                                </a>
                              )}
                            </div>
                          )}

                          <div className="mt-3">
                            <h4 className="mb-1 text-xs font-bold uppercase text-muted-foreground">Pagamento</h4>
                            <p className="inline-flex items-center gap-1 text-sm">
                              <PayIcon className="h-4 w-4 text-primary" /> {payLabel[o.payment_method ?? "pix"]}
                            </p>
                            {o.payment_method === "cash" && o.change_for && (
                              <p className="text-xs text-warning">
                                💵 Troco para R$ {Number(o.change_for).toFixed(2).replace(".", ",")} (devolver R${" "}
                                {Math.max(0, Number(o.change_for) - Number(o.total)).toFixed(2).replace(".", ",")})
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Itens</h4>
                          <ul className="space-y-1.5">
                            {orderItems.map((it) => (
                              <li key={it.id} className="text-sm">
                                <div className="flex justify-between gap-2">
                                  <span>
                                    <strong>{it.quantity}×</strong> {it.product_name}
                                  </span>
                                  <span className="shrink-0 font-semibold">
                                    R$ {(Number(it.unit_price) * it.quantity).toFixed(2).replace(".", ",")}
                                  </span>
                                </div>
                                {Array.isArray(it.customizations) &&
                                  it.customizations.map((c: any, ci: number) => (
                                    <p key={ci} className="ml-5 text-xs text-muted-foreground">
                                      ↳ {c.groupName}: {(c.selections ?? []).map((s: any) => s.name).join(", ")}
                                    </p>
                                  ))}
                                {it.notes && (
                                  <p className="ml-5 text-xs text-muted-foreground">📝 {it.notes}</p>
                                )}
                              </li>
                            ))}
                          </ul>

                          <div className="mt-3 space-y-0.5 border-t pt-2 text-xs">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal</span>
                              <span>R$ {Number(o.subtotal).toFixed(2).replace(".", ",")}</span>
                            </div>
                            {Number(o.delivery_fee) > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Entrega</span>
                                <span>R$ {Number(o.delivery_fee).toFixed(2).replace(".", ",")}</span>
                              </div>
                            )}
                            {Number(o.coupon_discount) > 0 && (
                              <div className="flex justify-between text-success">
                                <span>Cupom {o.coupon_code}</span>
                                <span>-R$ {Number(o.coupon_discount).toFixed(2).replace(".", ",")}</span>
                              </div>
                            )}
                            {Number(o.cashback_used) > 0 && (
                              <div className="flex justify-between text-success">
                                <span>Cashback</span>
                                <span>-R$ {Number(o.cashback_used).toFixed(2).replace(".", ",")}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t pt-1 font-bold">
                              <span>Total</span>
                              <span>R$ {Number(o.total).toFixed(2).replace(".", ",")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "products" && storeId && <MenuTab storeId={storeId} />}

        {tab === "reports" && storeId && currentStore && (
          <ReportsTab storeId={storeId} storeName={currentStore.name} />
        )}
      </div>

      {storeId && (
        <ProductFormModal
          open={productModalOpen}
          initial={editingProduct}
          storeId={storeId}
          onClose={() => setProductModalOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-products", storeId] })}
        />
      )}

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

const Kpi = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  accent?: "primary";
}) => (
  <div
    className={`rounded-2xl p-4 shadow-soft ${
      accent === "primary" ? "gradient-primary text-primary-foreground" : "bg-card"
    }`}
  >
    <div className="flex items-center gap-2 text-xs font-medium opacity-90">
      <Icon className="h-4 w-4" />
      {label}
    </div>
    <div className="mt-1 font-display text-2xl font-bold">{value}</div>
  </div>
);

export default Admin;
