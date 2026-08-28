import { useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Package, Truck, CheckCircle2, XCircle, ChevronRight, MessageCircle, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdBanner } from "@/components/AdBanner";

type DbStatus = "pending_payment" | "received" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

const steps: { key: DbStatus; label: string; icon: typeof Clock }[] = [
  { key: "received", label: "Recebido", icon: Clock },
  { key: "preparing", label: "Em preparo", icon: Package },
  { key: "out_for_delivery", label: "Saiu p/ entrega", icon: Truck },
  { key: "delivered", label: "Entregue", icon: CheckCircle2 },
];

const pickupSteps: { key: DbStatus; label: string; icon: typeof Clock }[] = [
  { key: "received", label: "Recebido", icon: Clock },
  { key: "preparing", label: "Em preparo", icon: Package },
  { key: "ready", label: "Pronto p/ retirar", icon: CheckCircle2 },
  { key: "delivered", label: "Retirado", icon: CheckCircle2 },
];

const statusIndex = (s: DbStatus) => {
  const order: DbStatus[] = ["pending_payment", "received", "preparing", "ready", "out_for_delivery", "delivered"];
  return order.indexOf(s);
};

const MyOrders = () => {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total, status, method, created_at, store_id, address, delivery_lat, delivery_lng, pickup_code, stores(name, logo, phone, whatsapp_phone, lat, lng, address_street, address_number, address_neighborhood, city), order_items(id, product_name, quantity)",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime — atualiza ao mudar status
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`my-orders:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-orders", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  useEffect(() => {
    document.title = "Meus pedidos • Itchat Brasil";
  }, []);

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-xl font-bold">Meus pedidos</h1>
        </div>
      </header>

      <div className="container max-w-3xl py-6">
        <AdBanner
          slotId={import.meta.env.VITE_ADSENSE_SLOT_ORDERS}
          variant="leaderboard"
          label="Banner meus pedidos — topo"
        />
        {orders.length === 0 ? (
          <div className="rounded-2xl bg-card p-12 text-center shadow-soft">
            <Package className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-display text-xl font-bold">Nenhum pedido ainda</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando você fizer um pedido, ele aparece aqui em tempo real.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Explorar lojas
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const status = o.status as DbStatus;
              const isCancelled = status === "cancelled";
              const currentIdx = statusIndex(status);
              const items = (o.order_items ?? []) as Array<{
                id: string;
                product_name: string;
                quantity: number;
              }>;
              const store = o.stores as {
                name: string;
                logo: string | null;
                phone: string | null;
                whatsapp_phone: string | null;
                lat: number | null;
                lng: number | null;
                address_street: string | null;
                address_number: string | null;
                address_neighborhood: string | null;
                city: string | null;
              } | null;
              const wppDigits = (store?.whatsapp_phone || store?.phone || "").replace(/\D/g, "");
              const wppLink = wppDigits
                ? `https://wa.me/55${wppDigits}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre meu pedido #${o.id.slice(0, 6).toUpperCase()}`)}`
                : null;
              const date = new Date(o.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });

              const isPickup = o.method === "pickup";
              const isLogistics = o.method === "logistics";
              const isReady = status === "ready";
              const activeSteps = isPickup || isLogistics ? pickupSteps : steps;

              const buildUberUrl = (vehicle: "moto" | "car") => {
                if (store?.lat == null || store?.lng == null) return null;
                const storeAddr = [
                  store.address_street && `${store.address_street}, ${store.address_number ?? ""}`,
                  store.address_neighborhood,
                  store.city,
                ]
                  .filter(Boolean)
                  .join(" • ");
                const params = new URLSearchParams({
                  action: "setPickup",
                  "pickup[latitude]": String(store.lat),
                  "pickup[longitude]": String(store.lng),
                  "pickup[nickname]": store.name ?? "Loja",
                  "pickup[formatted_address]": storeAddr,
                });
                if (o.delivery_lat != null && o.delivery_lng != null) {
                  params.set("dropoff[latitude]", String(o.delivery_lat));
                  params.set("dropoff[longitude]", String(o.delivery_lng));
                  const addr = (o.address as any) ?? {};
                  const lbl = [addr.street && `${addr.street}, ${addr.number ?? ""}`, addr.neighborhood, addr.city]
                    .filter(Boolean)
                    .join(" • ");
                  if (lbl) params.set("dropoff[formatted_address]", lbl);
                }
                // Sinaliza preferência de veículo no link (Uber Moto x carro).
                if (vehicle === "moto") params.set("product_id", "uber-moto");
                return `https://m.uber.com/ul/?${params.toString()}`;
              };
              const uberMoto = buildUberUrl("moto");
              const uberCar = buildUberUrl("car");

              return (
                <article key={o.id} className="overflow-hidden rounded-2xl bg-card shadow-soft">
                  <header className="flex flex-wrap items-center gap-3 border-b p-4">
                    {store?.logo && /^https?:\/\//.test(store.logo) ? (
                      <img
                        src={store.logo}
                        alt={store?.name ?? "Loja"}
                        className="h-10 w-10 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-2xl">{store?.logo ?? "🏪"}</span>
                    )}
                    <div className="flex-1">
                      <h3 className="font-display text-lg font-bold">{store?.name ?? "Loja"}</h3>
                      <p className="text-xs text-muted-foreground">
                        Pedido #{o.id.slice(0, 6).toUpperCase()} • {date} •{" "}
                        {o.method === "delivery"
                          ? "🛵 Entrega"
                          : o.method === "logistics"
                            ? "📦 Retirada por app"
                            : "🏪 Retirada"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold">
                        R$ {Number(o.total).toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                  </header>

                  {/* Timeline */}
                  <div className="p-5">
                    {isCancelled ? (
                      <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-destructive">
                        <XCircle className="h-5 w-5" />
                        <span className="font-bold">Pedido cancelado</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        {activeSteps.map((step, i) => {
                          const reached = currentIdx >= statusIndex(step.key);
                          const isCurrent = currentIdx === statusIndex(step.key);
                          const Icon = step.icon;
                          return (
                            <div key={step.key} className="flex flex-1 items-center">
                              <div className="flex flex-col items-center gap-1">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-smooth ${
                                    reached
                                      ? "gradient-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  } ${isCurrent ? "ring-4 ring-primary/20 animate-pulse" : ""}`}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                <span
                                  className={`text-[10px] font-bold ${
                                    reached ? "text-foreground" : "text-muted-foreground"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                              {i < activeSteps.length - 1 && (
                                <div
                                  className={`mx-1 h-0.5 flex-1 ${
                                    currentIdx > statusIndex(step.key) ? "bg-primary" : "bg-muted"
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Aviso: pronto para retirada */}
                    {isPickup && isReady && (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border-2 border-success/30 bg-success/10 p-3 text-sm text-success">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                          <p className="font-bold">Disponível para retirada!</p>
                          <p className="text-xs opacity-90">
                            Vá até a loja para retirar seu pedido.
                            {o.pickup_code && (
                              <>
                                {" "}Código: <strong>#{o.pickup_code}</strong>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Aviso: pronto para chamar logística */}
                    {isLogistics && isReady && (
                      <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div className="flex-1">
                            <p className="font-bold text-foreground">
                              Pedido pronto — chame um motorista
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Use <strong>moto</strong> para itens de até <strong>10&nbsp;kg</strong> ou{" "}
                              <strong>carro</strong> para volumes maiores.
                            </p>
                          </div>
                        </div>
                        {(uberMoto || uberCar) && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {uberMoto && (
                              <a
                                href={uberMoto}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-foreground text-xs font-bold text-background hover:opacity-90"
                              >
                                🛵 Uber Moto · ≤10kg
                              </a>
                            )}
                            {uberCar && (
                              <a
                                href={uberCar}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-foreground text-xs font-bold text-background hover:opacity-90"
                              >
                                🚗 Uber Carro · &gt;10kg
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Itens */}
                    <ul className="mt-4 space-y-1 border-t pt-3 text-sm">
                      {items.slice(0, 3).map((it) => (
                        <li key={it.id} className="flex justify-between text-muted-foreground">
                          <span>
                            {it.quantity}× {it.product_name}
                          </span>
                        </li>
                      ))}
                      {items.length > 3 && (
                        <li className="text-xs italic text-muted-foreground">
                          + {items.length - 3} {items.length - 3 === 1 ? "item" : "itens"}
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-2 gap-2 border-t bg-muted/30 p-3 sm:grid-cols-4">
                    <button
                      onClick={() => navigate(`/meus-pedidos/${o.id}`)}
                      className="col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:opacity-90 sm:col-span-1"
                    >
                      Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    {wppLink && (
                      <a
                        href={wppLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success/10 text-xs font-bold text-success hover:bg-success/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Falar
                      </a>
                    )}
                    <button
                      onClick={() => navigate(`/meus-pedidos/${o.id}`)}
                      className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-bold hover:border-primary"
                    >
                      <HelpCircle className="h-3.5 w-3.5" /> Ajuda
                    </button>
                    {["pending_payment", "received"].includes(status) && (
                      <button
                        onClick={() => navigate(`/meus-pedidos/${o.id}`)}
                        className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 text-xs font-bold text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancelar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
