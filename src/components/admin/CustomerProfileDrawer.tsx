import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  X,
  Phone,
  MapPin,
  Award,
  ShoppingBag,
  Star,
  TrendingUp,
  Calendar,
  Package,
  Tag,
} from "lucide-react";

const fmt = (n: number) =>
  `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDT = (d: string | Date) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const CustomerProfileDrawer = ({
  storeId,
  phone,
  onClose,
}: {
  storeId: string;
  phone: string | null;
  onClose: () => void;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-profile", storeId, phone],
    enabled: !!phone,
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select(
          "id, user_id, customer_name, customer_phone, total, status, payment_method, method, address, coupon_code, cashback_used, created_at, order_items(product_name, quantity, unit_price)",
        )
        .eq("store_id", storeId)
        .eq("customer_phone", phone!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userId = orders?.find((o) => o.user_id)?.user_id ?? null;
      let points = 0;
      let cashback = 0;
      let pointsLedger: any[] = [];
      if (userId) {
        const { data: pts } = await supabase
          .from("loyalty_points")
          .select("*")
          .eq("store_id", storeId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        pointsLedger = pts ?? [];
        points = pointsLedger
          .filter((p) => !p.expires_at || new Date(p.expires_at) > new Date())
          .reduce((s, p) => s + p.delta, 0);

        const { data: loy } = await supabase
          .from("user_loyalty")
          .select("cashback")
          .eq("user_id", userId)
          .maybeSingle();
        cashback = Number(loy?.cashback ?? 0);
      }

      return { orders: orders ?? [], userId, points, cashback, pointsLedger };
    },
  });

  if (!phone) return null;

  const orders = data?.orders ?? [];
  const valid = orders.filter((o) => o.status !== "cancelled");
  const total = valid.reduce((s, o) => s + Number(o.total), 0);
  const avg = valid.length ? total / valid.length : 0;
  const customerName = orders[0]?.customer_name ?? phone;

  // Aggregate addresses & top items
  const addressUse = new Map<string, { addr: any; count: number; lastAt: Date }>();
  const itemCount = new Map<string, { qty: number; revenue: number }>();
  const couponsUsed = new Map<string, number>();
  for (const o of valid) {
    if (o.address) {
      const key = JSON.stringify(o.address);
      const e = addressUse.get(key);
      const at = new Date(o.created_at);
      if (e) {
        e.count++;
        if (at > e.lastAt) e.lastAt = at;
      } else {
        addressUse.set(key, { addr: o.address, count: 1, lastAt: at });
      }
    }
    if (o.coupon_code) couponsUsed.set(o.coupon_code, (couponsUsed.get(o.coupon_code) ?? 0) + 1);
    for (const it of o.order_items ?? []) {
      const e = itemCount.get(it.product_name);
      if (e) {
        e.qty += it.quantity;
        e.revenue += it.quantity * Number(it.unit_price);
      } else {
        itemCount.set(it.product_name, { qty: it.quantity, revenue: it.quantity * Number(it.unit_price) });
      }
    }
  }
  const topItems = Array.from(itemCount.entries())
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5);
  const addresses = Array.from(addressUse.values()).sort((a, b) => b.count - a.count);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl overflow-y-auto bg-background shadow-strong animate-slide-up">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {customerName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{customerName}</h2>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {phone}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="space-y-5 p-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={ShoppingBag} label="Pedidos" value={String(valid.length)} />
              <Stat icon={TrendingUp} label="Gasto total" value={fmt(total)} />
              <Stat icon={Star} label="Ticket médio" value={fmt(avg)} />
              <Stat icon={Award} label="Pontos" value={String(data?.points ?? 0)} />
            </div>

            {/* Addresses */}
            {addresses.length > 0 && (
              <Section title="Endereços salvos" icon={MapPin}>
                <div className="space-y-2">
                  {addresses.map((a, i) => (
                    <div key={i} className="rounded-xl border bg-card p-3">
                      <div className="text-sm font-bold">
                        {a.addr.street}, {a.addr.number}
                        {a.addr.complement && ` - ${a.addr.complement}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.addr.neighborhood}{a.addr.city && ` • ${a.addr.city}`}{a.addr.cep && ` • ${a.addr.cep}`}
                      </div>
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                        Usado {a.count}× • último em {fmtDT(a.lastAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Top items */}
            {topItems.length > 0 && (
              <Section title="Itens mais pedidos" icon={Package}>
                <div className="space-y-1.5">
                  {topItems.map(([name, info]) => (
                    <div key={name} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
                      <div>
                        <div className="text-sm font-bold">{name}</div>
                        <div className="text-xs text-muted-foreground">{info.qty}× pedido(s)</div>
                      </div>
                      <div className="text-sm font-bold text-primary">{fmt(info.revenue)}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Coupons */}
            {couponsUsed.size > 0 && (
              <Section title="Cupons utilizados" icon={Tag}>
                <div className="flex flex-wrap gap-2">
                  {Array.from(couponsUsed.entries()).map(([code, n]) => (
                    <span key={code} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      {code} • {n}×
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Points history */}
            {(data?.pointsLedger?.length ?? 0) > 0 && (
              <Section title="Histórico de pontos" icon={Award}>
                <div className="space-y-1">
                  {data!.pointsLedger.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-1.5 text-sm">
                      <div>
                        <div className="font-bold">{p.reason}</div>
                        <div className="text-xs text-muted-foreground">{fmtDT(p.created_at)}</div>
                      </div>
                      <div className={`font-bold ${p.delta > 0 ? "text-green-600" : "text-destructive"}`}>
                        {p.delta > 0 ? "+" : ""}
                        {p.delta} pts
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Order history */}
            <Section title={`Histórico de pedidos (${orders.length})`} icon={Calendar}>
              <div className="space-y-2">
                {orders.length === 0 && (
                  <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                    Sem pedidos ainda.
                  </div>
                )}
                {orders.map((o) => (
                  <div key={o.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs font-bold">#{o.id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">{fmtDT(o.created_at)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary">{fmt(Number(o.total))}</div>
                        <div className="text-[11px] text-muted-foreground capitalize">
                          {o.status} • {o.payment_method}
                        </div>
                      </div>
                    </div>
                    {(o.order_items ?? []).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {o.order_items
                          .map((it: any) => `${it.quantity}× ${it.product_name}`)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </aside>
    </>
  );
};

const Stat = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-xl border bg-card p-3">
    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3 w-3" /> {label}
    </div>
    <div className="mt-1 font-display text-lg font-bold">{value}</div>
    {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
  </div>
);

const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Phone;
  children: React.ReactNode;
}) => (
  <section>
    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-4 w-4" /> {title}
    </h3>
    {children}
  </section>
);
