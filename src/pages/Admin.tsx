import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  ShoppingBag,
  TrendingUp,
  Pause,
  Play,
  Pencil,
  Plus,
  DollarSign,
  Clock,
  CheckCircle2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { stores as seedStores } from "@/data/stores";
import { toast } from "sonner";

type AdminProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
  stock: number | null;
  image: string;
};

type OrderStatus = "received" | "preparing" | "out" | "delivered";

type AdminOrder = {
  id: string;
  customer: string;
  items: number;
  total: number;
  status: OrderStatus;
  time: string;
  method: "delivery" | "pickup";
};

const initialOrders: AdminOrder[] = [
  { id: "#1247", customer: "João S.", items: 3, total: 87.5, status: "received", time: "agora", method: "delivery" },
  { id: "#1246", customer: "Maria O.", items: 2, total: 54.9, status: "preparing", time: "5 min", method: "delivery" },
  { id: "#1245", customer: "Pedro L.", items: 4, total: 119.8, status: "out", time: "18 min", method: "delivery" },
  { id: "#1244", customer: "Ana C.", items: 1, total: 24.9, status: "delivered", time: "32 min", method: "pickup" },
  { id: "#1243", customer: "Carlos M.", items: 5, total: 142.3, status: "delivered", time: "45 min", method: "delivery" },
];

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: typeof Clock; next?: OrderStatus }> = {
  received: { label: "Recebido", color: "bg-blue-500/10 text-blue-600", icon: Clock, next: "preparing" },
  preparing: { label: "Em preparo", color: "bg-amber-500/10 text-amber-600", icon: Package, next: "out" },
  out: { label: "Saiu p/ entrega", color: "bg-purple-500/10 text-purple-600", icon: Truck, next: "delivered" },
  delivered: { label: "Entregue", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
};

const Admin = () => {
  const [storeIdx, setStoreIdx] = useState(0);
  const [tab, setTab] = useState<"orders" | "products" | "reports">("orders");
  const store = seedStores[storeIdx];

  const [products, setProducts] = useState<AdminProduct[]>(() =>
    store.products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      active: true,
      stock: null,
      image: p.image,
    })),
  );

  // Reload products when store changes
  useEffect(() => {
    setProducts(
      store.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        active: true,
        stock: null,
        image: p.image,
      })),
    );
  }, [store]);

  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);

  useEffect(() => {
    document.title = "Painel Admin • FoodFlash";
  }, []);

  // simulate live order coming in every ~25s
  useEffect(() => {
    const t = setInterval(() => {
      const id = `#${1247 + orders.length}`;
      setOrders((prev) => [
        {
          id,
          customer: ["Lucas", "Carla", "Bruno", "Fernanda", "Rafa"][Math.floor(Math.random() * 5)] + ".",
          items: 1 + Math.floor(Math.random() * 4),
          total: Math.round((30 + Math.random() * 120) * 100) / 100,
          status: "received",
          time: "agora",
          method: Math.random() > 0.3 ? "delivery" : "pickup",
        },
        ...prev,
      ]);
      toast.success(`Novo pedido ${id} recebido!`, { description: "Toque para ver os detalhes" });
    }, 30000);
    return () => clearInterval(t);
  }, [orders.length]);

  const advanceStatus = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const next = statusConfig[o.status].next;
        if (!next) return o;
        toast.success(`Pedido ${id}: ${statusConfig[next].label}`);
        return { ...o, status: next };
      }),
    );
  };

  const togglePause = (id: string) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));

  const updatePrice = (id: string, price: number) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, price } : p)));

  // KPIs
  const kpis = useMemo(() => {
    const today = orders.reduce((s, o) => s + o.total, 0);
    const active = orders.filter((o) => o.status !== "delivered").length;
    const avg = orders.length ? today / orders.length : 0;
    return { revenue: today, active, avg, count: orders.length };
  }, [orders]);

  const topProducts = useMemo(
    () =>
      [...products]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5)
        .map((p, i) => ({ ...p, sold: 50 - i * 7 })),
    [products],
  );

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> App
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-xl font-bold">Painel do dono</h1>
          <div className="ml-auto">
            <select
              value={storeIdx}
              onChange={(e) => setStoreIdx(Number(e.target.value))}
              className="rounded-xl border-2 border-border bg-card px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary"
            >
              {seedStores.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.logo} {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* KPIs */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={DollarSign} label="Faturamento hoje" value={`R$ ${kpis.revenue.toFixed(2).replace(".", ",")}`} accent="primary" />
          <Kpi icon={ShoppingBag} label="Pedidos hoje" value={String(kpis.count)} />
          <Kpi icon={Package} label="Em andamento" value={String(kpis.active)} />
          <Kpi icon={TrendingUp} label="Ticket médio" value={`R$ ${kpis.avg.toFixed(2).replace(".", ",")}`} />
        </div>

        {/* Tabs */}
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
            {orders.map((o) => {
              const cfg = statusConfig[o.status];
              const Icon = cfg.icon;
              return (
                <div key={o.id} className="rounded-2xl bg-card p-4 shadow-soft">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="font-display text-lg">{o.id}</strong>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {o.method === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {o.customer} • {o.items} itens • {o.time}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-display text-lg font-bold">R$ {o.total.toFixed(2).replace(".", ",")}</div>
                      </div>
                      {cfg.next && (
                        <Button onClick={() => advanceStatus(o.id)} size="sm" className="rounded-xl gradient-primary font-bold">
                          Avançar →
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "products" && (
          <div>
            <div className="mb-4 flex justify-between">
              <p className="text-sm text-muted-foreground">{products.filter((p) => p.active).length} ativos de {products.length}</p>
              <Button className="gap-2 rounded-xl gradient-primary font-bold">
                <Plus className="h-4 w-4" /> Novo produto
              </Button>
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
                          <img src={p.image} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                          <strong>{p.name}</strong>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={p.price}
                          step="0.10"
                          onChange={(e) => updatePrice(p.id, Number(e.target.value))}
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
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => togglePause(p.id)}
                            className="rounded-md p-1.5 hover:bg-muted"
                            aria-label="Pausar/ativar"
                          >
                            {p.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button className="rounded-md p-1.5 hover:bg-muted" aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
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
              <div className="mt-4 flex justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Total</span>
                <strong className="font-display text-lg">R$ 4.872,30</strong>
              </div>
            </section>

            <section className="rounded-2xl bg-card p-5 shadow-soft">
              <h3 className="mb-4 font-display text-lg font-bold">Produtos mais vendidos</h3>
              <ul className="space-y-3">
                {topProducts.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="font-display text-2xl font-bold text-muted-foreground">#{i + 1}</span>
                    <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sold} pedidos</p>
                    </div>
                    <strong className="text-primary">R$ {(p.price * p.sold).toFixed(0)}</strong>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-card p-5 shadow-soft lg:col-span-2">
              <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full gradient-primary text-xs text-primary-foreground">
                  IA
                </span>
                Sugestões inteligentes
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                  <span className="text-lg">💡</span>
                  <span>
                    O <strong>Smash Bacon Duplo</strong> tem caído 12% nas últimas 2 semanas. Considere uma promoção
                    relâmpago de 15% OFF nos próximos 3 dias.
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                  <span className="text-lg">📈</span>
                  <span>
                    Pedidos crescem 38% nas sextas entre 19h-21h. Recomendado ativar combo "Burger + Fritas + Coca por
                    R$45".
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                  <span className="text-lg">🎯</span>
                  <span>
                    Você tem <strong>23 clientes VIP</strong> que não pedem há 30+ dias. Envie cupom exclusivo de 25% OFF.
                  </span>
                </li>
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
