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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveAsset } from "@/lib/assetMap";

type DbStatus = "pending_payment" | "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

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
  const [tab, setTab] = useState<"orders" | "products" | "reports">("orders");

  useEffect(() => {
    document.title = "Painel Admin • FoodFlash";
  }, []);

  // Stores owned by current user (or all, if admin)
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

  // Products of the selected store
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, price, active, image_url")
        .eq("store_id", storeId!)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Orders of the selected store (with full details for the expandable card)
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
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Realtime: refresh on new orders
  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`orders:${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin-orders", storeId] });
          if (payload.eventType === "INSERT") toast.success("Novo pedido recebido!");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, qc]);

  const advanceStatus = async (id: string, current: DbStatus) => {
    const next = statusConfig[current].next;
    if (!next) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Pedido: ${statusConfig[next].label}`);
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

  const kpis = useMemo(() => {
    const today = orders.reduce((s, o) => s + Number(o.total), 0);
    const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
    const avg = orders.length ? today / orders.length : 0;
    return { revenue: today, active, avg, count: orders.length };
  }, [orders]);

  const topProducts = useMemo(
    () => products.slice(0, 5).map((p, i) => ({ ...p, sold: 50 - i * 7 })),
    [products],
  );

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

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> App
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-xl font-bold">Painel do dono</h1>
          <div className="ml-auto">
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
            { id: "orders", label: "Pedidos ao vivo" },
            { id: "products", label: "Produtos" },
            { id: "reports", label: "Relatórios" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`relative px-4 py-2.5 text-sm font-bold transition-smooth ${
                tab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {tab === "orders" && (
          <div className="space-y-3">
            {orders.length === 0 && (
              <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
                Nenhum pedido ainda. Faça um pedido de teste pelo app!
              </p>
            )}
            {orders.map((o) => {
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
              const payIcon =
                o.payment_method === "pix"
                  ? QrCode
                  : o.payment_method === "cash"
                    ? Banknote
                    : CreditCard;
              const PayIcon = payIcon;
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
                        {o.customer_name} • {itemsCount} itens • {time}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-display text-lg font-bold">
                          R$ {Number(o.total).toFixed(2).replace(".", ",")}
                        </div>
                      </div>
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

        {tab === "products" && (
          <div>
            <div className="mb-4 flex justify-between">
              <p className="text-sm text-muted-foreground">
                {products.filter((p) => p.active).length} ativos de {products.length}
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl bg-card shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Produto</th>
                    <th className="px-4 py-3 text-left">Categoria</th>
                    <th className="px-4 py-3 text-right">Preço</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className={`border-t ${!p.active ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={resolveAsset(p.image_url)} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                          <strong>{p.name}</strong>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          defaultValue={Number(p.price)}
                          step="0.10"
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== Number(p.price)) updatePrice(p.id, v);
                          }}
                          className="w-24 rounded-md border bg-background px-2 py-1 text-right font-bold outline-none focus:border-primary"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            p.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.active ? "Ativo" : "Pausado"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => togglePause(p.id, p.active)}
                          className="rounded-md p-1.5 hover:bg-muted"
                          aria-label="Pausar/ativar"
                        >
                          {p.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl bg-card p-5 shadow-soft">
              <h3 className="mb-4 font-display text-lg font-bold">Vendas dos últimos 7 dias</h3>
              <div className="flex h-44 items-end gap-2">
                {[40, 65, 50, 80, 75, 95, 88].map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md gradient-primary transition-smooth hover:opacity-80"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {["S", "T", "Q", "Q", "S", "S", "D"][i]}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-card p-5 shadow-soft">
              <h3 className="mb-4 font-display text-lg font-bold">Produtos do cardápio</h3>
              <ul className="space-y-3">
                {topProducts.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="font-display text-2xl font-bold text-muted-foreground">#{i + 1}</span>
                    <img src={resolveAsset(p.image_url)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(p.price).toFixed(2).replace(".", ",")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
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
