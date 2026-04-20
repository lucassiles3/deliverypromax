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
    document.title = "Detalhes do pedido • FoodFlash";
  }, []);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-details", id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total, subtotal, delivery_fee, coupon_code, coupon_discount, cashback_used, cashback_earned, change_for, status, method, payment_method, address, notes, customer_name, customer_phone, created_at, accepted_at, updated_at, store_id, table_number, stores(name, logo, phone, whatsapp_phone, slug), order_items(id, product_name, quantity, unit_price, notes, customizations)",
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
          <span className="text-3xl">{order.stores?.logo ?? "🏪"}</span>
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
              {order.method === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}
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

        {/* Itens */}
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
            {Number(order.cashback_used) > 0 && (
              <div className="flex justify-between text-success">
                <dt>Cashback usado</dt>
                <dd>−{brl(Number(order.cashback_used))}</dd>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{brl(Number(order.total))}</dd>
            </div>
            {Number(order.cashback_earned) > 0 && (
              <p className="mt-1 text-xs text-success">
                ✨ Você ganhou {brl(Number(order.cashback_earned))} de cashback
              </p>
            )}
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

export default OrderDetails;
