import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMyCourier } from "@/hooks/useCouriers";
import { useCourierLocationBroadcast } from "@/hooks/useCourierLocation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, MapPin, Bike, Phone, CheckCircle2, Navigation } from "lucide-react";
import { toast } from "sonner";

const Entregador = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: courier, isLoading } = useMyCourier();
  const qc = useQueryClient();
  const [online, setOnline] = useState(courier?.is_online ?? false);

  useEffect(() => {
    setOnline(courier?.is_online ?? false);
  }, [courier?.is_online]);

  const { error: gpsError, lastUpdate } = useCourierLocationBroadcast(
    courier?.id ?? null,
    courier?.store_id ?? null,
    online,
  );

  const { data: orders = [] } = useQuery({
    queryKey: ["courier-orders", courier?.id],
    enabled: !!courier?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, total, status, address, delivery_lat, delivery_lng, created_at",
        )
        .eq("courier_id", courier!.id)
        .in("status", ["ready", "out_for_delivery"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // Realtime updates on assigned orders
  useEffect(() => {
    if (!courier?.id) return;
    const ch = supabase
      .channel(`courier-orders:${courier.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `courier_id=eq.${courier.id}` },
        () => qc.invalidateQueries({ queryKey: ["courier-orders", courier.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [courier?.id, qc]);

  const toggleOnline = async (v: boolean) => {
    setOnline(v);
    if (!courier) return;
    await supabase.from("couriers").update({ is_online: v }).eq("id", courier.id);
    if (v) toast.success("Você está online! Compartilhando localização.");
    else toast.message("Você está offline.");
  };

  const advance = async (id: string, current: string) => {
    const next =
      current === "ready" ? "out_for_delivery" : current === "out_for_delivery" ? "delivered" : null;
    if (!next) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next === "delivered" ? "Pedido entregue! 🎉" : "Saiu para entrega!");
    qc.invalidateQueries({ queryKey: ["courier-orders", courier?.id] });
  };

  if (authLoading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!courier) {
    return (
      <div className="min-h-screen bg-muted/40 p-6">
        <div className="container mx-auto max-w-md rounded-2xl bg-card p-8 text-center shadow-soft">
          <Bike className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold">Você não é um entregador</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta não está vinculada a nenhum estabelecimento como entregador. Peça ao gerente da loja
            para te cadastrar e vincular seu usuário.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">
            ← Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Sair
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-lg font-bold">
            🛵 {courier.stores?.name}
          </h1>
        </div>
      </header>

      <div className="container space-y-4 py-6">
        {/* Online status */}
        <div className="rounded-2xl gradient-primary p-5 text-primary-foreground shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase opacity-80">Status</div>
              <div className="font-display text-2xl font-bold">
                {online ? "Online 🟢" : "Offline ⚪"}
              </div>
              <div className="mt-1 text-xs opacity-90">
                {online
                  ? lastUpdate
                    ? `📍 GPS atualizado ${lastUpdate.toLocaleTimeString()}`
                    : "📍 Aguardando GPS…"
                  : "Ative para começar a receber e entregar pedidos"}
              </div>
              {gpsError && <div className="mt-1 text-xs font-bold">⚠️ {gpsError}</div>}
            </div>
            <Switch checked={online} onCheckedChange={toggleOnline} className="scale-150" />
          </div>
        </div>

        {/* Profile */}
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bike className="h-6 w-6" />
            </div>
            <div>
              <div className="font-bold">{courier.name}</div>
              <div className="text-xs text-muted-foreground">
                {courier.vehicle_type} {courier.vehicle_plate ? `• ${courier.vehicle_plate}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Orders */}
        <div>
          <h2 className="mb-2 font-display text-lg font-bold">
            Meus pedidos ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Nenhum pedido atribuído no momento.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o: any) => {
                const addr = o.address as any;
                const addressStr = addr
                  ? `${addr.street ?? ""}, ${addr.number ?? ""} ${addr.neighborhood ? "- " + addr.neighborhood : ""}`
                  : "Endereço não informado";
                const mapsUrl = o.delivery_lat && o.delivery_lng
                  ? `https://www.google.com/maps/dir/?api=1&destination=${o.delivery_lat},${o.delivery_lng}`
                  : addr
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`
                    : null;

                return (
                  <div key={o.id} className="rounded-2xl bg-card p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-bold text-muted-foreground">
                          #{o.id.slice(0, 6).toUpperCase()}
                        </div>
                        <div className="mt-0.5 font-display text-lg font-bold">
                          {o.customer_name}
                        </div>
                        <div className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{addressStr}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-xl font-bold">
                          R$ {Number(o.total).toFixed(2).replace(".", ",")}
                        </div>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            o.status === "out_for_delivery"
                              ? "bg-purple-500/10 text-purple-600"
                              : "bg-blue-500/10 text-blue-600"
                          }`}
                        >
                          {o.status === "out_for_delivery" ? "A caminho" : "Pronto"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-muted px-3 py-2 text-xs font-bold hover:bg-muted/70"
                        >
                          <Navigation className="h-3.5 w-3.5" /> Rotas
                        </a>
                      )}
                      {o.customer_phone && (
                        <a
                          href={`tel:${o.customer_phone}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-muted px-3 py-2 text-xs font-bold hover:bg-muted/70"
                        >
                          <Phone className="h-3.5 w-3.5" /> Ligar
                        </a>
                      )}
                      {o.status === "ready" && (
                        <Button size="sm" className="ml-auto" onClick={() => advance(o.id, o.status)}>
                          Saiu p/ entrega
                        </Button>
                      )}
                      {o.status === "out_for_delivery" && (
                        <Button size="sm" className="ml-auto" onClick={() => advance(o.id, o.status)}>
                          <CheckCircle2 className="mr-1 h-4 w-4" /> Entregue
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Entregador;
