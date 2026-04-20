import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOpenSessions, useTables, type TableStatus } from "@/hooks/useTables";
import { brl } from "@/lib/format";

const colorOf: Record<TableStatus, string> = {
  available: "bg-green-500",
  occupied: "bg-red-500",
  reserved: "bg-amber-500",
  blocked: "bg-muted-foreground",
};

export const TableMap = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const { data: tables = [] } = useTables(storeId);
  const { data: sessions = [] } = useOpenSessions(storeId);
  const sessionByTable = new Map(sessions.map((s) => [s.table_id, s]));
  const ref = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const onMouseDown = (id: string) => setDragId(id);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragId || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 90, e.clientX - rect.left - 45));
    const y = Math.max(0, Math.min(rect.height - 90, e.clientY - rect.top - 45));
    qc.setQueryData(["tables", storeId], (old: any[] = []) =>
      old.map((t) => (t.id === dragId ? { ...t, position_x: x, position_y: y } : t)),
    );
  };
  const onMouseUp = async () => {
    if (!dragId) return;
    const t = (qc.getQueryData<any[]>(["tables", storeId]) ?? []).find((x) => x.id === dragId);
    setDragId(null);
    if (t) {
      await supabase.from("tables").update({ position_x: t.position_x, position_y: t.position_y }).eq("id", t.id);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Arraste as mesas para organizar o mapa do salão. Posição é salva automaticamente.</p>
      <div
        ref={ref}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        className="relative h-[600px] rounded-2xl border-2 border-dashed border-border bg-muted/20"
      >
        {tables.map((t) => {
          const sess = sessionByTable.get(t.id);
          return (
            <div
              key={t.id}
              onMouseDown={() => onMouseDown(t.id)}
              style={{ left: t.position_x, top: t.position_y }}
              className={`absolute flex h-[90px] w-[90px] cursor-move flex-col items-center justify-center rounded-2xl text-white shadow-lg ${colorOf[t.status]}`}
            >
              <div className="text-xs font-bold">Mesa</div>
              <div className="font-display text-2xl font-bold leading-none">{t.number}</div>
              {sess && <div className="mt-0.5 text-[10px] font-bold">{brl(Number(sess.subtotal))}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
