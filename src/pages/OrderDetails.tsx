import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  MapPin,
  CreditCard,
  Tag,
  HelpCircle,
  MessageCircle,
  Phone,
  Receipt,
  Copy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { StatusTimeline } from "@/components/order/StatusTimeline";
import { OrderReviews } from "@/components/order/OrderReviews";
import { LazyCourierMap as CourierMap } from "@/components/LazyCourierMap";
import { PickupMap } from "@/components/PickupMap";
import { RouteReplay } from "@/components/RouteReplay";
import { useCourierLocation } from "@/hooks/useCourierLocation";
import { AdBanner } from "@/components/AdBanner";

type DbStatus =
  | "pending_payment"
  | "received"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

const stepDefs: { key: DbStatus; label: string; icon: typeof Clock }[] = [
  { key: "received", label: "Recebido", icon: Clock },
  { key: "preparing", label: "Em preparo", icon: Package },
  { key: "out_for_delivery", label: "A caminho", icon: Truck },
  { key: "delivered", label: "Entregue", icon: CheckCircle2 },
];

const idxOf = (s: DbStatus) =>
  ["pending_payment", "received", "preparing", "ready", "out_for_delivery", "delivered"].indexOf(s);

const paymentLabel: Record<string, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  crypto: "Criptomoeda",
};

const pixKeyTypeLabel: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Celular",
  random: "Chave aleatória",
};

const cryptoLabel: Record<string, string> = {
  btc: "Bitcoin (BTC)",
  eth: "Ethereum (ETH)",
  usdc: "USDC",
  usdt: "USDT",
};

const OrderDetails = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    document.title = "Detalhes do pedido • Itchat Brasil";
  }, []);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-details", id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total, subtotal, delivery_fee, coupon_code, coupon_discount, cashback_used, cashback_earned, change_for, status, method, payment_method, address, delivery_lat, delivery_lng, notes, customer_name, customer_phone, created_at, accepted_at, updated_at, store_id, table_number, courier_id, courier_tracking_url, courier_tracking_notes, courier_tracking_provider, pickup_code, pickup_handler_name, pickup_confirmed_at, couriers:courier_id(id, name, phone, vehicle_type, vehicle_plate, photo_url), stores(name, logo, phone, whatsapp_phone, slug, lat, lng, address_cep, address_street, address_number, address_complement, address_neighborhood, city, pickup_prep_time_min, opening_hours, logistics_pickup_release_when_ready, logistics_pickup_require_code, logistics_pickup_require_confirm, logistics_pickup_instructions, pix_key, pix_key_type, pix_beneficiary_name, pix_beneficiary_bank, crypto_wallets), order_items(id, product_id, product_name, quantity, unit_price, notes, customizations)",
        )
        .eq("id", id!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Realtime
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`order-details:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["order-details", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const wppLink = useMemo(() => {
    const phone = order?.stores?.whatsapp_phone || order?.stores?.phone;
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, "");
    if (!digits) return null;
    const msg =
      `Olá! Sou *${order?.customer_name ?? ""}*. Tenho uma dúvida sobre meu pedido *#${order?.id?.slice(0, 6).toUpperCase()}* (${brl(Number(order?.total ?? 0))}) feito na *${order?.stores?.name ?? "loja"}*.`;
    return `https://wa.me/55${digits}?text=${encodeURIComponent(msg)}`;
  }, [order]);

  const cancellable = useMemo(() => {
    if (!order) return false;
    return ["pending_payment", "received"].includes(order.status as DbStatus);
  }, [order]);

  const handleCancel = async () => {
    if (!order) return;
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          cancel_by: "customer",
          cancel_reason: cancelReason || "Cancelado pelo cliente",
        })
        .eq("id", order.id);
      if (error) throw error;
      toast.success("Pedido cancelado");
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ["order-details", order.id] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao cancelar pedido");
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!order) {
    return (
      <div className="min-h-screen bg-muted/40">
        <div className="container max-w-2xl py-10 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-xl font-bold">Pedido não encontrado</h1>
          <Link
            to="/meus-pedidos"
            className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const status = order.status as DbStatus;
  const isCancelled = status === "cancelled";
  const currentIdx = idxOf(status);
  const items = (order.order_items ?? []) as Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
    customizations: any;
  }>;
  const addr = order.address as any;
  const date = new Date(order.created_at).toLocaleString("pt-BR");

  const paymentLinkMatch = order.notes?.match(/\[LINK_PAGAMENTO\]\s*(\S+)/);
  const paymentLink = paymentLinkMatch?.[1];

  return (
    <div className="min-h-screen bg-muted/40 pb-24">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-3">
          <Link
            to="/meus-pedidos"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-xl font-bold">Detalhes do pedido</h1>
        </div>
      </header>

      <div className="container max-w-3xl space-y-4 py-6">
        {/* Header da loja */}
        <section className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
          {order.stores?.logo && /^https?:\/\//.test(order.stores.logo) ? (
            <img src={order.stores.logo} alt={order.stores?.name ?? "Loja"} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="text-3xl">{order.stores?.logo ?? "🏪"}</span>
          )}
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold">{order.stores?.name ?? "Loja"}</h2>
            <p className="text-xs text-muted-foreground">
              Pedido <button
                className="font-mono font-bold text-foreground hover:underline"
                onClick={() => {
                  navigator.clipboard.writeText(order.id);
                  toast.success("ID copiado");
                }}
              >#{order.id.slice(0, 8).toUpperCase()}</button> • {date}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold">{brl(Number(order.total))}</div>
            <p className="text-[11px] text-muted-foreground">
              {order.method === "delivery" ? "🛵 Entrega" : order.method === "logistics" ? "📦 Retirada por app" : "🏪 Retirada"}
            </p>
          </div>
        </section>

        {/* Status */}
        <section className="rounded-2xl bg-card p-5 shadow-soft">
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Status
          </h3>
          {isCancelled ? (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-bold">Pedido cancelado</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {stepDefs.map((step, i) => {
                const reached = currentIdx >= idxOf(step.key);
                const isCurrent = currentIdx === idxOf(step.key);
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full transition-smooth ${
                          reached ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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
                    {i < stepDefs.length - 1 && (
                      <div
                        className={`mx-1 h-0.5 flex-1 ${
                          currentIdx > idxOf(step.key) ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Rastreamento em tempo real (delivery em rota) */}
        {order.method === "delivery" && status === "out_for_delivery" && order.courier_id && (
          <LiveCourierTracking
            courierId={order.courier_id}
            courier={(order as any).couriers}
            destLat={order.delivery_lat}
            destLng={order.delivery_lng}
            storeLat={(order.stores as any)?.lat ?? null}
            storeLng={(order.stores as any)?.lng ?? null}
            storeName={order.stores?.name}
          />
        )}

        {/* Logística por app (Uber/Lalamove/99) */}
        {order.method === "logistics" && !isCancelled && status !== "delivered" && (
          <LogisticsPickupSection order={order as any} />
        )}

        {/* Mapa de retirada (pickup) */}
        {order.method === "pickup" && !isCancelled && status !== "delivered" && (
          <PickupMap
            storeName={order.stores?.name ?? "Loja"}
            storeLat={(order.stores as any)?.lat ?? null}
            storeLng={(order.stores as any)?.lng ?? null}
            storeAddress={[
              (order.stores as any)?.address_street &&
                `${(order.stores as any).address_street}${(order.stores as any).address_number ? `, ${(order.stores as any).address_number}` : ""}`,
              (order.stores as any)?.address_neighborhood,
              (order.stores as any)?.city,
            ]
              .filter(Boolean)
              .join(" • ") || null}
            pickupReadyAt={
              order.accepted_at && (order.stores as any)?.pickup_prep_time_min
                ? new Date(
                    new Date(order.accepted_at).getTime() +
                      Number((order.stores as any).pickup_prep_time_min) * 60000,
                  ).toISOString()
                : null
            }
          />
        )}

        {/* Histórico de trajeto após entrega (delivery) */}
        {order.method === "delivery" && status === "delivered" && order.courier_id && (
          <RouteReplay
            orderId={order.id}
            destLat={order.delivery_lat}
            destLng={order.delivery_lng}
            storeLat={(order.stores as any)?.lat ?? null}
            storeLng={(order.stores as any)?.lng ?? null}
            storeName={order.stores?.name}
          />
        )}

        <section className="rounded-2xl bg-card p-5 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <Receipt className="h-4 w-4" /> Itens
          </h3>
          <ul className="space-y-3">
            {items.map((it) => {
              const customs = Array.isArray(it.customizations) ? it.customizations : [];
              return (
                <li key={it.id} className="flex justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <p className="text-sm font-bold">
                      {it.quantity}× {it.product_name}
                    </p>
                    {customs.map((c: any, i: number) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        ↳ {c.groupName}: {(c.selections ?? []).map((s: any) => s.name).join(", ")}
                      </p>
                    ))}
                    {it.notes && <p className="text-xs italic text-muted-foreground">📝 {it.notes}</p>}
                  </div>
                  <span className="text-sm font-bold">{brl(Number(it.unit_price) * it.quantity)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Resumo financeiro */}
        <section className="rounded-2xl bg-card p-5 shadow-soft">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Resumo
          </h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{brl(Number(order.subtotal))}</dd>
            </div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Entrega</dt>
                <dd>{brl(Number(order.delivery_fee))}</dd>
              </div>
            )}
            {Number(order.coupon_discount) > 0 && (
              <div className="flex justify-between text-success">
                <dt className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" /> Cupom {order.coupon_code}
                </dt>
                <dd>−{brl(Number(order.coupon_discount))}</dd>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{brl(Number(order.total))}</dd>
            </div>
          </dl>
        </section>

        {/* Pagamento */}
        <section className="rounded-2xl bg-card p-5 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <CreditCard className="h-4 w-4" /> Pagamento
          </h3>
          <p className="text-sm">
            <strong>{paymentLabel[order.payment_method] ?? order.payment_method}</strong>
            {order.payment_method === "cash" && order.change_for && (
              <span className="text-muted-foreground"> • Troco para {brl(Number(order.change_for))}</span>
            )}
          </p>
          {paymentLink && (
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              <CreditCard className="h-4 w-4" /> Abrir link de pagamento
            </a>
          )}
        </section>

        {/* Histórico de status */}
        <StatusTimeline orderId={order.id} />

        <AdBanner
          slotId={import.meta.env.VITE_ADSENSE_SLOT_ORDER_DETAILS}
          variant="rectangle"
          label="Banner detalhes do pedido"
        />

        {/* Avaliações (apenas após entrega) */}
        {status === "delivered" && (
          <OrderReviews
            orderId={order.id}
            storeId={order.store_id}
            userId={user.id}
            storeName={order.stores?.name ?? "loja"}
            items={items.map((it) => ({
              id: it.id,
              product_id: (it as any).product_id ?? null,
              product_name: it.product_name,
            }))}
          />
        )}

        {/* Endereço */}
        {order.method === "delivery" && addr && (
          <section className="rounded-2xl bg-card p-5 shadow-soft">
            <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-4 w-4" /> Endereço de entrega
            </h3>
            <p className="text-sm">
              {addr.street}, {addr.number}
              {addr.complement ? ` — ${addr.complement}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {addr.neighborhood}
              {addr.city ? ` • ${addr.city}` : ""}
              {addr.cep ? ` • CEP ${addr.cep}` : ""}
            </p>
          </section>
        )}

        {/* Ações */}
        <section className="grid gap-2 sm:grid-cols-2">
          {wppLink && (
            <a
              href={wppLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-success font-bold text-success-foreground shadow-card hover:opacity-90"
            >
              <MessageCircle className="h-5 w-5" /> Falar com a loja
            </a>
          )}
          {order.stores?.phone && (
            <a
              href={`tel:${String(order.stores.phone).replace(/\D/g, "")}`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card font-bold hover:border-primary"
            >
              <Phone className="h-5 w-5" /> Ligar para a loja
            </a>
          )}
          <button
            onClick={() => setHelpOpen(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card font-bold hover:border-primary"
          >
            <HelpCircle className="h-5 w-5" /> Preciso de ajuda
          </button>
          {cancellable && (
            <button
              onClick={() => setCancelOpen(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-destructive/30 bg-destructive/5 font-bold text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-5 w-5" /> Cancelar pedido
            </button>
          )}
          <button
            onClick={() => navigate(`/loja/${order.stores?.slug ?? ""}`)}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground sm:col-span-2"
          >
            🔁 Pedir novamente
          </button>
        </section>
      </div>

      {/* Cancelar */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pedido?</DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita. Conte para a loja o motivo do cancelamento.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo (opcional)"
            className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajuda */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Precisa de ajuda?</DialogTitle>
            <DialogDescription>
              Escolha uma opção. A maioria das dúvidas é resolvida direto com a loja.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {wppLink && (
              <a
                href={wppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border-2 border-border p-3 text-sm font-bold hover:border-primary"
              >
                <MessageCircle className="h-5 w-5 text-success" />
                Falar com a loja no WhatsApp
              </a>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(order.id);
                toast.success("Número do pedido copiado");
              }}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-border p-3 text-left text-sm font-bold hover:border-primary"
            >
              <Copy className="h-5 w-5 text-primary" />
              Copiar número do pedido
            </button>
            {cancellable && (
              <button
                onClick={() => {
                  setHelpOpen(false);
                  setCancelOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-destructive/30 p-3 text-left text-sm font-bold text-destructive hover:bg-destructive/5"
              >
                <XCircle className="h-5 w-5" />
                Quero cancelar este pedido
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LiveCourierTracking = ({
  courierId,
  courier,
  destLat,
  destLng,
  storeLat,
  storeLng,
  storeName,
}: {
  courierId: string;
  courier: { name?: string; phone?: string | null; vehicle_plate?: string | null; photo_url?: string | null } | null;
  destLat: number | null;
  destLng: number | null;
  storeLat?: number | null;
  storeLng?: number | null;
  storeName?: string;
}) => {
  const loc = useCourierLocation(courierId);
  return (
    <section className="rounded-2xl bg-card p-5 shadow-soft">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <Truck className="h-4 w-4" /> Rastreamento ao vivo
      </h3>
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/40 p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
          {courier?.photo_url ? (
            <img src={courier.photo_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            "🛵"
          )}
        </div>
        <div className="flex-1">
          <p className="font-bold">{courier?.name ?? "Entregador"}</p>
          <p className="text-xs text-muted-foreground">
            {courier?.vehicle_plate ?? "A caminho"}
            {loc?.updated_at && (
              <> • atualizado {new Date(loc.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
            )}
          </p>
        </div>
        {courier?.phone && (
          <a
            href={`tel:${String(courier.phone).replace(/\D/g, "")}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-success-foreground"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>
      <CourierMap
        courierLat={loc?.lat ?? null}
        courierLng={loc?.lng ?? null}
        destLat={destLat}
        destLng={destLng}
        storeLat={storeLat ?? null}
        storeLng={storeLng ?? null}
        courierLabel={courier?.name ?? "Entregador"}
        destLabel="Seu endereço"
        storeLabel={storeName}
        height={280}
      />
      {!loc && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Aguardando o entregador ativar o GPS…
        </p>
      )}
    </section>
  );
};

/* =========================================================================
 * Logística por app (Uber/Lalamove/iFood Pegue&Leve)
 *  - Quando o pedido vira "pronto" (ou se a loja desativou a trava), exibe:
 *      • dados da loja (nome, endereço, telefone, horário)
 *      • dados da retirada (código, nome do pedido, expedidor)
 *      • instruções automáticas (+ instrução personalizada da loja)
 *      • botões: copiar tudo, WhatsApp, abrir Uber
 *      • formulário para colar o link de rastreio do entregador
 * =======================================================================*/
const LogisticsPickupSection = ({ order }: { order: any }) => {
  const qc = useQueryClient();
  const store = order.stores ?? {};
  const fullAddress = [
    store.address_street && `${store.address_street}${store.address_number ? `, ${store.address_number}` : ""}`,
    store.address_complement,
    store.address_neighborhood,
    store.city,
    store.address_cep && `CEP ${store.address_cep}`,
  ]
    .filter(Boolean)
    .join(" • ");

  const copy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const [url, setUrl] = useState<string>(order.courier_tracking_url ?? "");
  const [saving, setSaving] = useState(false);

  const status = order.status as string;
  const releaseOnlyWhenReady = store.logistics_pickup_release_when_ready !== false;
  const isReadyOrLater = status === "ready" || status === "out_for_delivery";
  const pickupUnlocked = !releaseOnlyWhenReady || isReadyOrLater;
  const canSendCourier = isReadyOrLater;
  const alreadySent = !!order.courier_tracking_url;
  const showCode = !!order.pickup_code && (store.logistics_pickup_require_code !== false);

  // Horário de hoje
  const today = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  const todayHours = (store.opening_hours as any)?.[today];

  // Resumo formatado para copiar / compartilhar
  const orderShort = String(order.id).slice(0, 6).toUpperCase();
  const summary = [
    `🏪 ${store.name ?? "Loja"}`,
    fullAddress && `📍 ${fullAddress}`,
    store.phone && `📞 ${store.phone}`,
    todayHours && `🕒 Hoje ${todayHours.open}–${todayHours.close}`,
    "",
    showCode && `🔑 Código de retirada: #${order.pickup_code}`,
    `🧾 Pedido ${order.customer_name ? `de ${order.customer_name}` : `#${orderShort}`}`,
    order.pickup_handler_name && `👤 Entregar a: ${order.pickup_handler_name}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Deep links Uber (pickup = loja, dropoff = cliente).
  // Geramos dois links — Moto (até 10kg) e Carro (>10kg) — sinalizando a
  // preferência de veículo no parâmetro product_id quando suportado pelo app.
  const buildUber = (vehicle: "moto" | "car"): string | null => {
    if (store.lat == null || store.lng == null) return null;
    const params = new URLSearchParams({
      action: "setPickup",
      "pickup[latitude]": String(store.lat),
      "pickup[longitude]": String(store.lng),
      "pickup[nickname]": store.name ?? "Loja",
      "pickup[formatted_address]": fullAddress || "",
    });
    if (order.delivery_lat != null && order.delivery_lng != null) {
      params.set("dropoff[latitude]", String(order.delivery_lat));
      params.set("dropoff[longitude]", String(order.delivery_lng));
      const addr = (order.address as any) ?? {};
      const addrLabel = [addr.street && `${addr.street}, ${addr.number ?? ""}`, addr.neighborhood, addr.city]
        .filter(Boolean)
        .join(" • ");
      if (addrLabel) params.set("dropoff[formatted_address]", addrLabel);
    }
    if (vehicle === "moto") params.set("product_id", "uber-moto");
    return `https://m.uber.com/ul/?${params.toString()}`;
  };
  const uberMotoUrl = buildUber("moto");
  const uberCarUrl = buildUber("car");

  const shareWhatsApp = () => {
    const text = encodeURIComponent(summary);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const validUrl = (s: string) => {
    try {
      const u = new URL(s.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const submit = async () => {
    if (!validUrl(url)) return toast.error("Cole um link válido (https://...)");
    setSaving(true);
    try {
      const patch: any = {
        courier_tracking_url: url.trim(),
      };
      // Se a loja NÃO exige confirmação, já promove para "saiu para entrega"
      if (status === "ready" && store.logistics_pickup_require_confirm === false) {
        patch.status = "out_for_delivery";
      }
      const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
      if (error) throw error;
      toast.success("Link enviado para a loja!");
      qc.invalidateQueries({ queryKey: ["order-details", order.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl bg-card p-5 shadow-soft">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
        📦 Retirada por app de logística
      </h3>

      {/* Mensagem de prontidão */}
      {pickupUnlocked ? (
        <div className="rounded-xl border-2 border-success/30 bg-success/5 p-3 text-sm">
          ✅ <strong>Seu pedido já está pronto para retirada.</strong> Agora você pode solicitar um motorista
          (Uber, 99 ou similar) para buscar seu pedido.
        </div>
      ) : (
        <div className="rounded-xl border-2 border-warning/30 bg-warning/10 p-3 text-sm">
          ⏳ Aguarde a loja marcar o pedido como <strong>pronto</strong>. Em seguida você poderá chamar um motorista
          e colar aqui o link de rastreio.
        </div>
      )}

      {/* Dados do estabelecimento */}
      <div className="rounded-xl border-2 border-dashed bg-muted/40 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase text-muted-foreground">Estabelecimento</p>
        <p className="text-sm font-bold">{store.name}</p>
        {fullAddress && <p className="mt-0.5 text-sm">{fullAddress}</p>}
        {store.phone && <p className="mt-0.5 text-xs text-muted-foreground">📞 {store.phone}</p>}
        {todayHours && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            🕒 Hoje {todayHours.open}–{todayHours.close}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => copy(fullAddress, "Endereço")}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-background text-xs font-bold hover:border-primary"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar endereço
          </button>
          {store.phone && (
            <button
              onClick={() => copy(store.phone, "Telefone da loja")}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-background text-xs font-bold hover:border-primary"
            >
              <Phone className="h-3.5 w-3.5" /> Copiar telefone
            </button>
          )}
        </div>
      </div>

      {/* Dados da retirada */}
      {pickupUnlocked && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase text-primary">Dados da retirada</p>
          {showCode && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-background px-3 py-2">
              <span className="text-[11px] uppercase text-muted-foreground">Código</span>
              <span className="font-mono text-2xl font-bold tracking-widest text-primary">
                #{order.pickup_code}
              </span>
            </div>
          )}
          <p className="text-sm">
            <span className="text-muted-foreground">Pedido:</span>{" "}
            <strong>{order.customer_name ? `Pedido ${order.customer_name}` : `#${orderShort}`}</strong>
          </p>
          {order.pickup_handler_name && (
            <p className="text-sm">
              <span className="text-muted-foreground">Quem vai entregar:</span>{" "}
              <strong>{order.pickup_handler_name}</strong>
            </p>
          )}
        </div>
      )}

      {/* Instruções automáticas */}
      {pickupUnlocked && (
        <div className="rounded-xl border bg-background p-3">
          <p className="mb-2 text-[11px] font-bold uppercase text-muted-foreground">Instruções para o motorista</p>
          <ul className="space-y-1 text-xs">
            {showCode && <li>• Informe ao motorista o código <strong>#{order.pickup_code}</strong></li>}
            <li>• A retirada será feita no balcão de entregas</li>
            <li>• O motorista deve informar o nome do cliente ({order.customer_name})</li>
            {store.logistics_pickup_require_confirm && (
              <li>• Aguarde a confirmação da loja antes do motorista sair</li>
            )}
            {store.logistics_pickup_instructions && (
              <li className="mt-2 rounded-md bg-muted/40 p-2 italic">📝 {store.logistics_pickup_instructions}</li>
            )}
          </ul>
        </div>
      )}

      {/* Botões inteligentes */}
      {pickupUnlocked && (
        <div className="space-y-2">
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-xs">
            🛵 <strong>Uber Moto</strong> para pedidos/itens de até <strong>10&nbsp;kg</strong>.
            🚗 <strong>Uber Carro</strong> para volumes acima de 10&nbsp;kg.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => copy(summary, "Informações da retirada")}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-background text-xs font-bold hover:border-primary"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar tudo
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-xs font-bold text-white hover:opacity-90"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </button>
            {uberMotoUrl && (
              <a
                href={uberMotoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground text-xs font-bold text-background hover:opacity-90"
              >
                🛵 Uber Moto · ≤10kg
              </a>
            )}
            {uberCarUrl && (
              <a
                href={uberCarUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground text-xs font-bold text-background hover:opacity-90"
              >
                🚗 Uber Carro · &gt;10kg
              </a>
            )}
          </div>
        </div>
      )}

      {/* Formulário do link de rastreio */}
      <div className="border-t pt-3">
        {!canSendCourier && (
          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Após chamar o motorista, cole aqui o link de rastreio do app — a loja poderá acompanhar a rota.
          </p>
        )}
        {canSendCourier && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              {alreadySent ? "Atualizar entregador" : "Enviar link do entregador para a loja"}
            </p>
            <input
              placeholder="Cole o link de rastreio (https://...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <Button onClick={submit} disabled={saving} className="h-12 w-full rounded-xl gradient-primary font-bold">
              {saving ? "Enviando..." : alreadySent ? "Atualizar link" : "Enviar link"}
            </Button>
          </div>
        )}
        {alreadySent && (
          <a
            href={order.courier_tracking_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            🔗 Abrir rastreio do entregador
          </a>
        )}
        {order.pickup_confirmed_at && (
          <p className="mt-2 text-center text-[11px] text-success">
            ✓ Loja confirmou a entrega ao motorista
          </p>
        )}
      </div>
    </section>
  );
};

export default OrderDetails;
