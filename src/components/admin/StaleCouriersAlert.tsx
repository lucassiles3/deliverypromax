import { AlertTriangle, MapPin, RefreshCw, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStaleCouriers, useReassignStaleOrders, useUnassignOrder } from "@/hooks/useStaleCouriers";

export const StaleCouriersAlert = ({ storeId }: { storeId: string }) => {
  const { data } = useStaleCouriers(storeId);
  const reassign = useReassignStaleOrders(storeId);
  const unassign = useUnassignOrder(storeId);

  if (!data || data.alerts.length === 0) return null;

  const critical = data.alerts.filter((a) => a.level === "critical");

  return (
    <div className="space-y-2 rounded-2xl border-2 border-amber-500/50 bg-amber-500/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-display text-sm font-bold text-amber-700">
              {data.alerts.length} entregador(es) sem atualizar GPS
            </p>
            <p className="text-xs text-muted-foreground">
              Alerta acima de {data.alertMin}min • Reatribuição automática em {data.reassignMin}min
            </p>
          </div>
        </div>
        {critical.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            disabled={reassign.isPending}
            onClick={() => reassign.mutate()}
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${reassign.isPending ? "animate-spin" : ""}`} />
            Reatribuir {critical.length}
          </Button>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {data.alerts.map((a) => (
          <li
            key={a.order_id}
            className={`flex items-center justify-between gap-2 rounded-xl border-2 p-2.5 text-xs ${
              a.level === "critical"
                ? "border-destructive/40 bg-destructive/5"
                : "border-amber-500/30 bg-card"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate font-bold">
                #{a.order_id.slice(0, 6).toUpperCase()} • {a.courier_name}
              </p>
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {a.last_update
                  ? `${a.minutes_stale}min sem GPS`
                  : "GPS nunca enviado"}
              </p>
            </div>
            <button
              onClick={() => unassign.mutate(a.order_id)}
              disabled={unassign.isPending}
              className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 font-bold hover:bg-muted/70"
              title="Devolver à fila"
            >
              <UserX className="h-3 w-3" />
              Liberar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
