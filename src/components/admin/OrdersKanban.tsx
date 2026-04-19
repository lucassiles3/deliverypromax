import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
} from "lucide-react";
import { differenceInMinutes, differenceInSeconds } from "date-fns";
import { OrderDetailsModal } from "./OrderDetailsModal";
import { CancelOrderModal } from "./CancelOrderModal";

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

export const OrdersKanban = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [, force] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const lastAlertRef = useRef<Map<string, number>>(new Map());
  const autoCancelledRef = useRef<Set<string>>(new Set());

  // Re-render every 5s for timers
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Store settings
  const { data: settings } = useQuery({
    queryKey: ["store-settings", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("accept_alert_min, autocancel_min, autocancel_enabled, sound_alerts_enabled")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Active orders
  const { data: orders = [] } = useQuery({
    queryKey: ["kanban-orders", storeId],
    enabled: !!storeId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, total, status, method, payment_method, created_at, accepted_at, user_id, order_items(product_name, quantity)"
        )
        .eq("store_id", storeId)
        .in("status", ["received", "preparing", "ready", "out_for_delivery", "delivered"])
        .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  // Recurring customers (orders count by user_id from full history)
  const { data: recurring = new Set<string>() } = useQuery({
    queryKey: ["recurring-customers", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("user_id")
        .eq("store_id", storeId)
        .not("user_id", "is", null);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data ?? []).forEach((r) => {
        if (r.user_id) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
      });
      return new Set(Array.from(counts.entries()).filter(([, c]) => c >= 2).map(([id]) => id));
    },
  });

  // Realtime
  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`kanban:${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => qc.invalidateQueries({ queryKey: ["kanban-orders", storeId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, qc]);

  // Sound alert + auto-cancel
  const playDing = () => {
    if (!settings?.sound_alerts_enabled) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      [880, 1100, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.3, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.45);
      });
      setTimeout(() => ctx.close(), 1500);
    } catch {
      /* ignore */
    }
  };

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
          playDing();
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
      {totalActive === 0 && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-2 font-display text-lg font-bold">Nenhum pedido ativo nas últimas 12h</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando um cliente fizer um pedido, ele aparecerá aqui em <strong>Novos</strong> com os botões{" "}
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">✓ Aceitar</span>{" "}
            e <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-bold text-destructive">✕ Recusar</span>.
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                nextLabel=""
                ghost
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
}: {
  col: (typeof COLUMNS)[number];
  orders: OrderRow[];
  recurring: Set<string>;
  alertMin: number;
  onMoveNext: (id: string) => void;
  onView: (id: string) => void;
  onCancel: (id: string) => void;
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
  nextLabel,
  ghost,
}: {
  order: OrderRow;
  isRecurring: boolean;
  alertMin: number;
  onView: () => void;
  onCancel: () => void;
  onMoveNext: () => void;
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
        <span className="text-[11px]">{order.method === "delivery" ? "🛵" : "🏪"}</span>
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
            onClick={() => window.print()}
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
