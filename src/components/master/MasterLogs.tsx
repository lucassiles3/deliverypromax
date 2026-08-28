import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Log = {
  id: string; event_type: string; severity: string;
  message: string; created_at: string; metadata: any;
};

const sevColor: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-700",
  warning: "bg-amber-500/10 text-amber-700",
  error: "bg-red-500/10 text-red-700",
  success: "bg-green-500/10 text-green-700",
};

export default function MasterLogs() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("platform_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data as any) || []);
    };
    load();
    const ch = supabase.channel("platform_logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "platform_logs" },
        (payload) => setLogs((prev) => [payload.new as Log, ...prev].slice(0, 200))
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {logs.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Nenhum log ainda. Os eventos aparecerão aqui em tempo real.</p>}
          {logs.map((l) => (
            <div key={l.id} className="p-3 flex items-start gap-3 hover:bg-muted/30">
              <Badge className={sevColor[l.severity] || ""}>{l.severity}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{l.message}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{l.event_type}</span> • {new Date(l.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
