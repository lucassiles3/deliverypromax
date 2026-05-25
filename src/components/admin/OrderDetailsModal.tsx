import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  MapPin,
  CreditCard,
  Banknote,
  QrCode,
  History,
  MessageCircle,
  Printer,
  Bike,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCouriers } from "@/hooks/useCouriers";
import { printReceipt, type PrintData } from "@/lib/printReceipt";

const PAY_LABEL: Record<string, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  received: "Recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu p/ entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const OrderDetailsModal = ({
  orderId,
  open,
  onClose,
}: {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
}) => {
  const { data: order } = useQuery({
    queryKey: ["order-detail", orderId],
    enabled: !!orderId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, store_id, courier_id, customer_name, customer_phone, total, subtotal, delivery_fee, coupon_code, coupon_discount, cashback_used, status, method, payment_method, change_for, address, delivery_lat, delivery_lng, created_at, accepted_at, cancel_reason, cancel_by, notes, courier_tracking_url, courier_tracking_provider, courier_tracking_notes, pickup_code, pickup_handler_name, pickup_confirmed_at, order_items(id, product_name, quantity, unit_price, notes, customizations)"
        )
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["order-history", orderId],
    enabled: !!orderId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("id, from_status, to_status, note, created_at")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const qc = useQueryClient();
  const { data: couriers = [] } = useCouriers(order?.store_id ?? null);

  const { data: storeInfo } = useQuery({
    queryKey: ["store-print-info", order?.store_id],
    enabled: !!order?.store_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("name, phone, print_format, address_street, address_number, address_neighborhood, city")
        .eq("id", order!.store_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!order) return null;

  const addr = order.address as
    | { street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; cep?: string }
    | null;

  const PayIcon =
    order.payment_method === "pix" ? QrCode : order.payment_method === "cash" ? Banknote : CreditCard;

  const items = (order.order_items ?? []) as Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
    customizations: any;
  }>;

  const waLink = `https://wa.me/55${(order.customer_phone ?? "").replace(/\D/g, "")}`;
  const mapsLink =
    order.delivery_lat && order.delivery_lng
      ? `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`
      : addr
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${addr.street ?? ""} ${addr.number ?? ""} ${addr.neighborhood ?? ""} ${addr.city ?? ""}`
          )}`
        : null;

  const printOrder = () => {
    const data: PrintData = {
      storeName: storeInfo?.name ?? "Loja",
      storePhone: storeInfo?.phone ?? null,
      storeAddress: [
        storeInfo?.address_street && `${storeInfo.address_street}${storeInfo.address_number ? `, ${storeInfo.address_number}` : ""}`,
        storeInfo?.address_neighborhood,
        storeInfo?.city,
      ].filter(Boolean).join(" — ") || null,
      orderId: order.id,
      orderShortId: order.id.slice(0, 6).toUpperCase(),
      createdAt: order.created_at,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      method: order.method as any,
      paymentMethod: order.payment_method,
      changeFor: order.change_for,
      address: order.address,
      notes: order.notes,
      items: items as any,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.delivery_fee || 0),
      discount: Number(order.coupon_discount || 0),
      total: Number(order.total),
    };
    const ok = printReceipt(data, (storeInfo?.print_format as any) ?? "thermal_80mm");
    if (!ok) toast.error("Popup bloqueado pelo navegador. Libere popups para imprimir.");
  };

  const FLOW: Array<{ id: string; label: string }> = [
    { id: "received", label: "Recebido" },
    { id: "preparing", label: "Em preparo" },
    { id: "ready", label: "Pronto" },
    { id: "out_for_delivery", label: "A caminho" },
    { id: "delivered", label: "Entregue" },
  ];
  const idx = FLOW.findIndex((f) => f.id === order.status);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  const prev = idx > 0 ? FLOW[idx - 1] : null;
  const isFinal = order.status === "delivered" || order.status === "cancelled";

  const changeStatus = async (to: string) => {
    const { error } = await supabase.from("orders").update({ status: to as any }).eq("id", order.id);
    if (error) return toast.error(error.message);
    toast.success(`Status alterado para ${STATUS_LABEL[to] ?? to}`);
    qc.invalidateQueries({ queryKey: ["order-detail", order.id] });
    qc.invalidateQueries({ queryKey: ["order-history", order.id] });
    qc.invalidateQueries({ queryKey: ["kanban-orders", order.store_id ?? ""] });
    qc.invalidateQueries({ queryKey: ["orders-history"] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-5xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-2">
            <span className="truncate">Pedido #{order.id.slice(0, 6).toUpperCase()}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
            <button
              onClick={printOrder}
              className="ml-auto rounded-lg p-2 hover:bg-muted"
              title="Imprimir comanda"
            >
              <Printer className="h-4 w-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        {!isFinal && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Trocar status:
            </span>
            {prev && (
              <button
                onClick={() => changeStatus(prev.id)}
                className="rounded-lg border bg-card px-3 py-1.5 text-xs font-bold hover:bg-muted"
              >
                ← {prev.label}
              </button>
            )}
            {next && (
              <button
                onClick={() => changeStatus(next.id)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                {next.label} →
              </button>
            )}
            <button
              onClick={() => changeStatus("cancelled")}
              className="ml-auto rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20"
            >
              Cancelar pedido
            </button>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {/* Cliente */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cliente
            </h4>
            <p className="text-base font-semibold">{order.customer_name}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-500/20"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold hover:bg-muted/70"
              >
                <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
              </a>
            </div>

            {order.method === "delivery" && addr && (
              <div className="mt-3 rounded-lg bg-muted/40 p-3">
                <h5 className="mb-1 text-[11px] font-bold uppercase text-muted-foreground">
                  Endereço de entrega
                </h5>
                <p className="text-sm">
                  {addr.street}, {addr.number}
                  {addr.complement ? ` — ${addr.complement}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {addr.neighborhood}
                  {addr.city ? ` — ${addr.city}` : ""} • CEP {addr.cep}
                </p>
                {mapsLink && (
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <MapPin className="h-3 w-3" /> Abrir rota no Google Maps
                  </a>
                )}
              </div>
            )}

            <div className="mt-3 rounded-lg bg-muted/40 p-3">
              <h5 className="mb-1 text-[11px] font-bold uppercase text-muted-foreground">
                Pagamento
              </h5>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <PayIcon className="h-4 w-4 text-primary" />
                {PAY_LABEL[order.payment_method ?? "pix"]}
              </p>
              {order.payment_method === "cash" && order.change_for && (
                <p className="mt-1 text-xs text-amber-600">
                  💵 Troco para R$ {Number(order.change_for).toFixed(2).replace(".", ",")} (devolver
                  R${" "}
                  {Math.max(0, Number(order.change_for) - Number(order.total))
                    .toFixed(2)
                    .replace(".", ",")}
                  )
                </p>
              )}
            </div>

            {order.method === "logistics" && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <h5 className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-primary">
                  📦 Retirada por app de logística
                </h5>
                {(order as any).pickup_code && (
                  <div className="mb-2 flex items-center justify-between rounded-md bg-background px-3 py-2">
                    <span className="text-[11px] uppercase text-muted-foreground">Código de retirada</span>
                    <span className="font-mono text-lg font-bold tracking-widest text-primary">
                      #{(order as any).pickup_code}
                    </span>
                  </div>
                )}
                {(order as any).pickup_handler_name && (
                  <p className="text-xs text-muted-foreground">
                    Expedidor: <strong className="text-foreground">{(order as any).pickup_handler_name}</strong>
                  </p>
                )}
                {(order as any).courier_tracking_url ? (
                  <>
                    {(order as any).courier_tracking_provider && (
                      <p className="text-xs text-muted-foreground">
                        App: <strong className="text-foreground">{(order as any).courier_tracking_provider}</strong>
                      </p>
                    )}
                    <a
                      href={(order as any).courier_tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                    >
                      🔗 Acompanhar rota do entregador
                    </a>
                    {(order as any).courier_tracking_notes && (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        📝 {(order as any).courier_tracking_notes}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Aguardando o cliente chamar e colar o link do entregador (após status “Pronto”).
                  </p>
                )}
                {(order as any).pickup_confirmed_at && (
                  <p className="mt-2 text-[11px] text-success">
                    ✓ Entrega confirmada ao motorista em{" "}
                    {new Date((order as any).pickup_confirmed_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            )}

            {order.method === "delivery" && !isFinal && (
              <div className="mt-3 rounded-lg bg-muted/40 p-3">
                <h5 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-muted-foreground">
                  <Bike className="h-3.5 w-3.5" /> Entregador
                </h5>
                <select
                  value={order.courier_id ?? ""}
                  onChange={async (e) => {
                    const val = e.target.value || null;
                    const { error } = await supabase
                      .from("orders")
                      .update({ courier_id: val })
                      .eq("id", order.id);
                    if (error) return toast.error(error.message);
                    toast.success(val ? "Entregador atribuído" : "Entregador removido");
                    qc.invalidateQueries({ queryKey: ["order-detail", order.id] });
                    qc.invalidateQueries({ queryKey: ["kanban-orders", order.store_id] });
                  }}
                  className="w-full rounded-lg border-2 border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                >
                  <option value="">— Não atribuído —</option>
                  {couriers
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.is_online ? "🟢 " : "⚫ "}
                        {c.name}
                        {c.vehicle_plate ? ` (${c.vehicle_plate})` : ""}
                      </option>
                    ))}
                </select>
                {couriers.length === 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Nenhum entregador cadastrado. Vá em <strong>Entregadores</strong>.
                  </p>
                )}
              </div>
            )}
            {order.cancel_reason && (
              <div className="mt-3 rounded-lg bg-destructive/10 p-3">
                <h5 className="mb-1 text-[11px] font-bold uppercase text-destructive">
                  Motivo do cancelamento
                </h5>
                <p className="text-sm">{order.cancel_reason}</p>
                {order.cancel_by && (
                  <p className="text-xs text-muted-foreground">por: {order.cancel_by}</p>
                )}
              </div>
            )}
          </section>

          {/* Itens */}
          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Itens
            </h4>
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="rounded-lg bg-muted/40 p-2 text-sm">
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
                    <p className="ml-5 text-xs italic text-muted-foreground">📝 {it.notes}</p>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-3 space-y-0.5 border-t pt-2 text-xs">
              <Row label="Subtotal" value={order.subtotal} />
              {Number(order.delivery_fee) > 0 && (
                <Row label="Entrega" value={order.delivery_fee} />
              )}
              {Number(order.coupon_discount) > 0 && (
                <Row
                  label={`Cupom ${order.coupon_code}`}
                  value={-Number(order.coupon_discount)}
                  positive
                />
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span>R$ {Number(order.total).toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Histórico */}
        <section className="mt-4 rounded-xl border bg-muted/20 p-3">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Histórico de status
          </h4>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem registros.</p>
          ) : (
            <ol className="space-y-1.5">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-card px-2 py-0.5 font-bold">
                    {STATUS_LABEL[h.to_status] ?? h.to_status}
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(h.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                  {h.note && <span className="italic text-muted-foreground">— {h.note}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value, positive }: { label: string; value: number; positive?: boolean }) => (
  <div className={`flex justify-between ${positive ? "text-green-600" : "text-muted-foreground"}`}>
    <span>{label}</span>
    <span>
      {value < 0 ? "-" : ""}R$ {Math.abs(Number(value)).toFixed(2).replace(".", ",")}
    </span>
  </div>
);
