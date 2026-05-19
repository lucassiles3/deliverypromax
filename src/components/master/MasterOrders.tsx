import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Order = {
  id: string; status: string; total: number; customer_name: string;
  payment_method: string; created_at: string;
  stores: { name: string; city: string | null } | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const statusColor: Record<string, string> = {
  pending_payment: "bg-amber-500/10 text-amber-700",
  received: "bg-blue-500/10 text-blue-700",
  preparing: "bg-orange-500/10 text-orange-700",
  ready: "bg-purple-500/10 text-purple-700",
  out_for_delivery: "bg-cyan-500/10 text-cyan-700",
  delivered: "bg-green-500/10 text-green-700",
  cancelled: "bg-red-500/10 text-red-700",
};

export default function MasterOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,status,total,customer_name,payment_method,created_at,stores(name,city)")
        .order("created_at", { ascending: false })
        .limit(300);
      setOrders((data as any) || []);
    })();
  }, []);

  const filtered = orders.filter(o =>
    o.customer_name?.toLowerCase().includes(q.toLowerCase()) ||
    o.stores?.name?.toLowerCase().includes(q.toLowerCase()) ||
    o.id.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input className="max-w-md" placeholder="Buscar pedido, loja ou cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3">#Pedido</th>
                <th className="text-left p-3">Loja</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Pagto</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">#{o.id.slice(0,6).toUpperCase()}</td>
                  <td className="p-3">{o.stores?.name || "—"}<span className="text-xs text-muted-foreground block">{o.stores?.city}</span></td>
                  <td className="p-3">{o.customer_name}</td>
                  <td className="p-3 uppercase text-xs">{o.payment_method}</td>
                  <td className="p-3 text-right font-medium">{fmt(Number(o.total))}</td>
                  <td className="p-3"><Badge className={statusColor[o.status] || ""}>{o.status}</Badge></td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
