import { useMemo, useState } from "react";
import { LayoutGrid, ListOrdered, CalendarClock, ChefHat, Trophy, Map as MapIcon } from "lucide-react";
import { useOpenSessions, useTables } from "@/hooks/useTables";
import { brl } from "@/lib/format";
import { TablesGrid } from "./tables/TablesGrid";
import { SectorsManager } from "./tables/SectorsManager";
import { ReservationsView } from "./tables/ReservationsView";
import { KitchenDisplay } from "./tables/KitchenDisplay";
import { WaiterRanking } from "./tables/WaiterRanking";
import { TableMap } from "./tables/TableMap";
import { TableCalls } from "./tables/TableCalls";

type View = "grid" | "map" | "reservations" | "kitchen" | "ranking" | "sectors";

export const TablesTab = ({ storeId }: { storeId: string }) => {
  const [view, setView] = useState<View>("grid");
  const { data: tables = [] } = useTables(storeId);
  const { data: sessions = [] } = useOpenSessions(storeId);

  const kpis = useMemo(() => {
    const occupied = tables.filter((t) => t.status === "occupied").length;
    const free = tables.filter((t) => t.status === "available").length;
    const reserved = tables.filter((t) => t.status === "reserved").length;
    const blocked = tables.filter((t) => t.status === "blocked").length;
    const totalOpen = sessions.reduce((s, x) => s + Number(x.subtotal || 0), 0);
    const avg = sessions.length ? totalOpen / sessions.length : 0;
    return { occupied, free, reserved, blocked, totalOpen, avg, tables: tables.length };
  }, [tables, sessions]);

  const tabs: { id: View; label: string; icon: typeof LayoutGrid }[] = [
    { id: "grid", label: "Mesas", icon: LayoutGrid },
    { id: "map", label: "Mapa do salão", icon: MapIcon },
    { id: "kitchen", label: "Produção (KDS)", icon: ChefHat },
    { id: "reservations", label: "Reservas", icon: CalendarClock },
    { id: "ranking", label: "Ranking garçons", icon: Trophy },
    { id: "sectors", label: "Setores", icon: ListOrdered },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Mesas" value={String(kpis.tables)} />
        <Stat label="Ocupadas" value={String(kpis.occupied)} tone="bg-red-500/10 text-red-600" />
        <Stat label="Livres" value={String(kpis.free)} tone="bg-green-500/10 text-green-600" />
        <Stat label="Em comanda" value={brl(kpis.totalOpen)} />
        <Stat label="Ticket médio" value={brl(kpis.avg)} />
      </div>

      <TableCalls storeId={storeId} />

      <div className="flex gap-2 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-bold transition-smooth ${
              view === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {view === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {view === "grid" && <TablesGrid storeId={storeId} />}
      {view === "map" && <TableMap storeId={storeId} />}
      {view === "kitchen" && <KitchenDisplay storeId={storeId} />}
      {view === "reservations" && <ReservationsView storeId={storeId} />}
      {view === "ranking" && <WaiterRanking storeId={storeId} />}
      {view === "sectors" && <SectorsManager storeId={storeId} />}
    </div>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className={`rounded-2xl border bg-card p-4 ${tone ?? ""}`}>
    <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">{label}</div>
    <div className="mt-1 font-display text-2xl font-bold leading-none">{value}</div>
  </div>
);
