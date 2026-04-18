import { X, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CustomerHistoryDrawer = ({
  phone,
  storeId,
  onClose,
}: {
  phone: string | null;
  storeId: string;
  onClose: () => void;
}) => {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["customer-history", storeId, phone],
    enabled: !!phone,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, method, created_at, customer_name")
        .eq("store_id", storeId)
        .eq("customer_phone", phone!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!phone) return null;

  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);
  const name = orders[0]?.customer_name ?? "Cliente";
  const isVip = orders.length >= 5;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <aside
        className="relative h-full w-full max-w-md overflow-y-auto bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b bg-card/95 p-5 backdrop-blur">
          <div>
            <h2 className="font-display text-lg font-bold">{name}</h2>
            <a
              href={`https://wa.me/55${phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Phone className="h-3 w-3" /> {phone}
            </a>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2 p-5">
          <Stat label="Pedidos" value={String(orders.length)} />
          <Stat label="Gasto total" value={`R$ ${totalSpent.toFixed(0)}`} />
          <Stat label="Tipo" value={isVip ? "⭐ VIP" : "Normal"} accent={isVip} />
        </div>

        <div className="px-5 pb-5">
          <h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">
            Histórico de pedidos
          </h3>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && orders.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          )}
          <ul className="space-y-2">
            {orders.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-xl border bg-background p-3"
              >
                <div>
                  <p className="font-display text-sm font-bold">
                    #{o.id.slice(0, 6).toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("pt-BR")} •{" "}
                    {o.method === "delivery" ? "Entrega" : "Retirada"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">R$ {Number(o.total).toFixed(2).replace(".", ",")}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">{o.status}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div
    className={`rounded-xl p-3 text-center ${
      accent ? "gradient-primary text-primary-foreground" : "bg-muted"
    }`}
  >
    <div className="text-[10px] font-bold uppercase opacity-80">{label}</div>
    <div className="mt-0.5 font-display text-base font-bold">{value}</div>
  </div>
);
