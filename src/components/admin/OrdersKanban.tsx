import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrdersChannel } from "@/hooks/useOrdersChannel";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
  closestCenter,
} from "@dnd-kit/core";
import {
  Bell,
  Package,
  CheckCircle2,
  Truck,
  ChefHat,
  XCircle,
  CreditCard,
  Banknote,
  QrCode,
  Eye,
  X as XIcon,
  Repeat,
  Printer,
  History,
  LayoutGrid,
} from "lucide-react";
import { differenceInMinutes, differenceInSeconds } from "date-fns";
import { OrderDetailsModal } from "./OrderDetailsModal";
import { CancelOrderModal } from "./CancelOrderModal";
import { OrdersHistory } from "./OrdersHistory";
import { printReceipt, type PrintData } from "@/lib/printReceipt";
import { StaleCouriersAlert } from "./StaleCouriersAlert";

type DbStatus =
  | "pending_payment"
  | "received"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: DbStatus;
  method: "delivery" | "pickup";
  payment_method: string;
  created_at: string;
  accepted_at: string | null;
  user_id: string | null;
  source?: string | null;
  table_number?: number | null;
  order_items: Array<{ product_name: string; quantity: number }>;
};

const COLUMNS: {
  id: DbStatus;
  label: string;
  hint: string;
  icon: typeof Bell;
  next?: DbStatus;
  nextLabel?: string;
  tone: string;
}[] = [
  {
    id: "pending_payment",
    label: "Aguardando pgto",
    hint: "cliente ainda não pagou",
    icon: CreditCard,
    next: "received",
    nextLabel: "✓ Confirmar pgto",
    tone: "border-muted-foreground/30 bg-muted/40",
  },
  {
    id: "received",
    label: "Novos",
    hint: "aguardando aceite",
    icon: Bell,
    next: "preparing",
    nextLabel: "✓ Aceitar",
    tone: "border-primary/40 bg-primary/5",
  },
  {
    id: "preparing",
    label: "Em preparo",
    hint: "cozinha",
    icon: ChefHat,
    next: "ready",
    nextLabel: "Pronto",
    tone: "border-amber-500/40 bg-amber-500/5",
  },
  {
    id: "ready",
    label: "Pronto",
    hint: "aguarda entregador",
    icon: Package,
    next: "out_for_delivery",
    nextLabel: "Saiu",
    tone: "border-blue-500/40 bg-blue-500/5",
  },
  {
    id: "out_for_delivery",
    label: "A caminho",
    hint: "saiu p/ entrega",
    icon: Truck,
    next: "delivered",
    nextLabel: "Entregue",
    tone: "border-purple-500/40 bg-purple-500/5",
  },
  {
    id: "delivered",
    label: "Entregue",
    hint: "finalizado",
    icon: CheckCircle2,
    tone: "border-green-500/40 bg-green-500/5",
  },
];

const WINDOW_OPTIONS = [
  { id: "12h", label: "12h", hours: 12 },
  { id: "24h", label: "24h", hours: 24 },
  { id: "48h", label: "48h", hours: 48 },
  { id: "7d", label: "7 dias", hours: 24 * 7 },
] as const;

export const OrdersKanban = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [, force] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "history">("kanban");
  const [windowSel, setWindowSel] = useState<(typeof WINDOW_OPTIONS)[number]["id"]>("12h");
  const lastAlertRef = useRef<Map<string, number>>(new Map());
  const autoCancelledRef = useRef<Set<string>>(new Set());

  // Re-render every 5s for timers
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Store settings (incluindo dados pra impressão)
  const { data: settings } = useQuery({
    queryKey: ["store-settings", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(
          "name, phone, accept_alert_min, autocancel_min, autocancel_enabled, sound_alerts_enabled, auto_print_enabled, print_format, address_street, address_number, address_neighborhood, city"
        )
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Active orders
  const windowHours = WINDOW_OPTIONS.find((w) => w.id === windowSel)?.hours ?? 12;
  const { data: orders = [] } = useQuery({
    queryKey: ["kanban-orders", storeId, windowHours],
    enabled: !!storeId,
    // Realtime já invalida em tempo real (canal `kanban:${storeId}` mais abaixo).
    // Mantemos só um refetch de segurança a cada 60s pra recuperar de desconexões.
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, total, status, method, payment_method, created_at, accepted_at, user_id, source, table_number, order_items(product_name, quantity)"
        )
        .eq("store_id", storeId)
        .in("status", ["pending_payment", "received", "preparing", "ready", "out_for_delivery", "delivered"])
        .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * windowHours).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  // Recurring customers — limita ao histórico recente (últimos 90 dias, 2k linhas máx).
  // Evita varredura full-table em lojas com milhares de pedidos.
  const { data: recurring = new Set<string>() } = useQuery({
    queryKey: ["recurring-customers", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("user_id")
        .eq("store_id", storeId)
        .not("user_id", "is", null)
        .gte("created_at", since)
        .limit(2000);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data ?? []).forEach((r) => {
        if (r.user_id) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
      });
      return new Set(Array.from(counts.entries()).filter(([, c]) => c >= 2).map(([id]) => id));
    },
  });

  // Track de pedidos já vistos pra disparar som/print apenas em novos
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Imprime um pedido (usado tanto pelo auto-print quanto pelo botão da impressora)
  const printOrderById = async (orderId: string, opts?: { silent?: boolean }) => {
    try {
      const { data: ord, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, total, subtotal, delivery_fee, coupon_discount, method, payment_method, change_for, address, notes, created_at, order_items(quantity, product_name, unit_price, notes, customizations)"
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error || !ord) {
        if (!opts?.silent) toast.error("Não foi possível carregar o pedido para imprimir");
        return;
      }

      const data: PrintData = {
        storeName: settings?.name ?? "Loja",
        storePhone: settings?.phone ?? null,
        storeAddress: [
          settings?.address_street && `${settings.address_street}${settings.address_number ? `, ${settings.address_number}` : ""}`,
          settings?.address_neighborhood,
          settings?.city,
        ].filter(Boolean).join(" — ") || null,
        orderId: ord.id,
        orderShortId: ord.id.slice(0, 6).toUpperCase(),
        createdAt: ord.created_at,
        customerName: ord.customer_name,
        customerPhone: ord.customer_phone,
        method: ord.method,
        paymentMethod: ord.payment_method,
        changeFor: ord.change_for,
        address: ord.address,
        notes: ord.notes,
        items: (ord.order_items ?? []) as any,
        subtotal: Number(ord.subtotal),
        deliveryFee: Number(ord.delivery_fee || 0),
        discount: Number(ord.coupon_discount || 0),
        total: Number(ord.total),
      };
      const ok = printReceipt(data, (settings?.print_format as any) ?? "thermal_80mm");
      if (!ok && !opts?.silent) toast.error("Popup bloqueado pelo navegador. Libere popups para imprimir.");
    } catch (e) {
      console.warn("print failed", e);
      if (!opts?.silent) toast.error("Falha ao imprimir");
    }
  };

  const autoPrintOrder = async (orderId: string) => {
    if (!settings?.auto_print_enabled) return;
    printOrderById(orderId, { silent: true });
  };

  // 🔔 Pede permissão de notificação do navegador assim que entra no Kanban
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // 🔓 Destrava áudio na primeira interação do usuário (autoplay policy)
  const audioUnlockedRef = useRef(false);
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.01);
        setTimeout(() => ctx.close(), 200);
        audioUnlockedRef.current = true;
      } catch { /* ignore */ }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const notifyNewOrder = (orderId: string, extra?: { total?: number; customer?: string }) => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const short = orderId.slice(0, 6).toUpperCase();
        const body = extra?.customer
          ? `${extra.customer}${extra?.total ? ` · R$ ${Number(extra.total).toFixed(2).replace(".", ",")}` : ""}`
          : "Toque para abrir o painel";
        const n = new Notification(`🔔 Novo pedido #${short}`, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: orderId,
          requireInteraction: true,
        } as NotificationOptions);
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch { /* ignore */ }
    if (navigator.vibrate) {
      try { navigator.vibrate([300, 120, 300, 120, 600]); } catch { /* ignore */ }
    }
  };

  // Realtime: invalidate + auto-print on new order INSERT
  // (canal compartilhado via useOrdersChannel — som/popup é global em <NewOrderAlerts />)
  const onOrderEvent = useCallback(
    (payload: { eventType: string; new: any }) => {
      qc.invalidateQueries({ queryKey: ["kanban-orders", storeId] });
      if (payload.eventType === "INSERT") {
        autoPrintOrder(payload.new.id);
      }
    },
    // autoPrintOrder usa settings; recriamos quando essas flags mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeId, qc, settings?.auto_print_enabled, settings?.print_format],
  );
  useOrdersChannel(storeId, onOrderEvent);


  // Inicializa o "já visto" na primeira carga (não imprime histórico)
  useEffect(() => {
    if (initializedRef.current || !orders) return;
    if (orders.length >= 0) {
      orders.forEach((o) => seenIdsRef.current.add(o.id));
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length === 0 ? null : orders[0]?.id]);



  const autoCancel = async (id: string) => {
    if (autoCancelledRef.current.has(id)) return;
    autoCancelledRef.current.add(id);
    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: "Prazo de aceite expirado",
        cancel_by: "system",
      })
      .eq("id", id)
      .eq("status", "received");
    if (!error) {
      toast.error(`Pedido #${id.slice(0, 6).toUpperCase()} cancelado automaticamente`);
      qc.invalidateQueries({ queryKey: ["kanban-orders", storeId] });
    }
  };

  useEffect(() => {
    if (!settings) return;
    const alertMin = settings.accept_alert_min ?? 3;
    const cancelMin = settings.autocancel_min ?? 5;

    orders.forEach((o) => {
      if (o.status !== "received") return;
      const elapsed = differenceInMinutes(new Date(), new Date(o.created_at));

      if (elapsed >= alertMin) {
        const last = lastAlertRef.current.get(o.id) ?? 0;
        if (Date.now() - last > 30_000) {
          lastAlertRef.current.set(o.id, Date.now());
          try {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new Ctx();
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = "sine"; osc.frequency.value = 1200;
            g.gain.setValueAtTime(0.0001, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
            osc.connect(g).connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.65);
            setTimeout(() => ctx.close(), 800);
          } catch {/* ignore */}
        }
      }
      if (settings.autocancel_enabled && elapsed >= cancelMin) {
        autoCancel(o.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, settings]);

  const grouped = useMemo(() => {
    const map: Record<DbStatus, OrderRow[]> = {
      pending_payment: [],
      received: [],
      preparing: [],
      ready: [],
      out_for_delivery: [],
      delivered: [],
      cancelled: [],
    };
    orders.forEach((o) => map[o.status]?.push(o));
    return map;
  }, [orders]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const moveTo = async (id: string, to: DbStatus) => {
    const order = orders.find((o) => o.id === id);
    if (!order || order.status === to) return;
    const { error } = await supabase.from("orders").update({ status: to }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kanban-orders", storeId] });
    qc.invalidateQueries({ queryKey: ["dashboard-live", storeId] });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const overId = e.over?.id as DbStatus | undefined;
    const activeId = e.active.id as string;
    if (!overId) return;
    moveTo(activeId, overId);
  };

  const draggingOrder = orders.find((o) => o.id === draggingId);

  const totalActive = orders.length;

  return (
    <>
      {/* Toolbar: view + janela */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
          <button
            onClick={() => setView("kanban")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${view === "kanban" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Ativos
          </button>
          <button
            onClick={() => setView("history")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${view === "history" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <History className="h-3.5 w-3.5" /> Histórico
          </button>
        </div>
        {view === "kanban" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Mostrar últimas:</span>
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {WINDOW_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWindowSel(w.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold ${windowSel === w.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {view === "history" ? (
        <OrdersHistory storeId={storeId} />
      ) : (
        <>
      <div className="mb-4"><StaleCouriersAlert storeId={storeId} /></div>
      {totalActive === 0 && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-2 font-display text-lg font-bold">Nenhum pedido ativo na janela selecionada</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Aumente a janela de tempo acima ou veja o <strong>Histórico</strong> para pedidos antigos.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            💡 Dica: confirme no topo da página se você está na loja certa (seletor ao lado do botão Som).
          </p>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setDraggingId(e.active.id as string)}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              col={col}
              orders={grouped[col.id]}
              recurring={recurring}
              alertMin={settings?.accept_alert_min ?? 3}
              onMoveNext={(id) => col.next && moveTo(id, col.next)}
              onView={(id) => setDetailId(id)}
              onCancel={(id) => setCancelId(id)}
              onPrint={(id) => printOrderById(id)}
            />
          ))}
        </div>
        <DragOverlay>
          {draggingOrder && (
            <div className="rotate-2 opacity-90">
              <OrderCard
                order={draggingOrder}
                isRecurring={!!draggingOrder.user_id && recurring.has(draggingOrder.user_id)}
                alertMin={settings?.accept_alert_min ?? 3}
                onView={() => {}}
                onCancel={() => {}}
                onMoveNext={() => {}}
                onPrint={() => {}}
                nextLabel=""
                ghost
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
        </>
      )}

      <OrderDetailsModal
        orderId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />
      <CancelOrderModal
        orderId={cancelId}
        storeId={storeId}
        open={!!cancelId}
        onClose={() => setCancelId(null)}
      />
    </>
  );
};

const Column = ({
  col,
  orders,
  recurring,
  alertMin,
  onMoveNext,
  onView,
  onCancel,
  onPrint,
}: {
  col: (typeof COLUMNS)[number];
  orders: OrderRow[];
  recurring: Set<string>;
  alertMin: number;
  onMoveNext: (id: string) => void;
  onView: (id: string) => void;
  onCancel: (id: string) => void;
  onPrint: (id: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const Icon = col.icon;
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] flex-col rounded-2xl border-2 p-3 transition-colors ${col.tone} ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider">{col.label}</h3>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-bold">
          {orders.length}
        </span>
      </div>
      <p className="mb-3 -mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {col.hint}
      </p>
      <div className="flex-1 space-y-2">
        {orders.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">vazio</p>
        ) : (
          orders.map((o) => (
            <DraggableCard key={o.id} id={o.id}>
              <OrderCard
                order={o}
                isRecurring={!!o.user_id && recurring.has(o.user_id)}
                alertMin={alertMin}
                onView={() => onView(o.id)}
                onCancel={() => onCancel(o.id)}
                onMoveNext={() => onMoveNext(o.id)}
                onPrint={() => onPrint(o.id)}
                nextLabel={col.nextLabel ?? ""}
              />
            </DraggableCard>
          ))
        )}
      </div>
    </div>
  );
};

const DraggableCard = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      {children}
    </div>
  );
};

const OrderCard = ({
  order,
  isRecurring,
  alertMin,
  onView,
  onCancel,
  onMoveNext,
  onPrint,
  nextLabel,
  ghost,
}: {
  order: OrderRow;
  isRecurring: boolean;
  alertMin: number;
  onView: () => void;
  onCancel: () => void;
  onMoveNext: () => void;
  onPrint: () => void;
  nextLabel: string;
  ghost?: boolean;
}) => {
  const PayIcon =
    order.payment_method === "pix" ? QrCode : order.payment_method === "cash" ? Banknote : CreditCard;

  const sinceCreated = differenceInSeconds(new Date(), new Date(order.created_at));
  const sinceAccepted = order.accepted_at
    ? differenceInSeconds(new Date(), new Date(order.accepted_at))
    : null;

  const isReceived = order.status === "received";
  const isLate = isReceived && sinceCreated >= alertMin * 60;

  const itemsSummary = (order.order_items ?? [])
    .slice(0, 3)
    .map((i) => `${i.quantity}× ${i.product_name}`)
    .join(", ");
  const more = (order.order_items?.length ?? 0) - 3;

  return (
    <div
      className={`rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        isLate ? "border-destructive ring-2 ring-destructive/40 animate-pulse" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <strong className="font-display text-sm">#{order.id.slice(0, 6).toUpperCase()}</strong>
        {order.source === "mesa" ? (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
            🍽️ Mesa {order.table_number ?? "?"}
          </span>
        ) : (
          <span className="text-[11px]">{order.method === "delivery" ? "🛵" : "🏪"}</span>
        )}
        <PayIcon className="h-3 w-3 text-muted-foreground" />
        <span className="ml-auto font-display text-sm font-bold">
          R$ {Number(order.total).toFixed(2).replace(".", ",")}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <p className="truncate text-xs font-semibold">{order.customer_name}</p>
        {isRecurring && (
          <span title="Cliente recorrente">
            <Repeat className="h-3 w-3 text-primary" />
          </span>
        )}
      </div>

      {itemsSummary && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {itemsSummary}
          {more > 0 && ` +${more}`}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-bold ${
            isLate ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {isReceived
            ? `⏱ ${formatDuration(sinceCreated)} sem aceite`
            : sinceAccepted !== null
              ? `⏱ ${formatDuration(sinceAccepted)} aceito`
              : `⏱ ${formatDuration(sinceCreated)}`}
        </span>
      </div>

      {!ghost && (
        <div className="mt-2 flex gap-1">
          {nextLabel && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onMoveNext}
              className="flex-1 rounded-lg gradient-primary px-2 py-1.5 text-[11px] font-bold text-primary-foreground"
            >
              {nextLabel} →
            </button>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onView}
            className="rounded-lg bg-muted p-1.5 hover:bg-muted/70"
            title="Ver detalhes"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onPrint}
            className="rounded-lg bg-muted p-1.5 hover:bg-muted/70"
            title="Imprimir comanda"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          {order.status !== "delivered" && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onCancel}
              className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
              title="Cancelar"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h${(m % 60).toString().padStart(2, "0")}`;
}
