import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Ticket = {
  id: string; subject: string; body: string; status: string;
  priority: string; created_at: string;
  stores: { name: string } | null;
};
type Msg = { id: string; body: string; author_role: string; created_at: string };

const statusColor: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-700",
  in_progress: "bg-amber-500/10 text-amber-700",
  waiting_customer: "bg-purple-500/10 text-purple-700",
  resolved: "bg-green-500/10 text-green-700",
  closed: "bg-muted text-muted-foreground",
};

export default function MasterSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("id,subject,body,status,priority,created_at,stores(name)")
      .order("created_at", { ascending: false });
    setTickets((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    const { data } = await supabase
      .from("support_ticket_messages")
      .select("*").eq("ticket_id", t.id).order("created_at");
    setMsgs((data as any) || []);
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: selected.id, body: reply.trim(), author_id: user?.id, author_role: "super_admin",
    });
    if (error) return toast.error(error.message);
    setReply("");
    openTicket(selected);
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("support_tickets").update({
      status, resolved_at: status === "resolved" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
      <Card>
        <CardContent className="p-0">
          <div className="p-3 border-b font-semibold text-sm">Tickets ({tickets.length})</div>
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {tickets.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Sem tickets.</p>}
            {tickets.map((t) => (
              <button key={t.id} onClick={() => openTicket(t)}
                className={`w-full text-left p-3 hover:bg-muted/30 ${selected?.id === t.id ? "bg-muted/50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-1">{t.subject}</p>
                  <Badge className={statusColor[t.status] || ""}>{t.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t.stores?.name || "—"} • {new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          {!selected && <p className="text-muted-foreground text-sm">Selecione um ticket.</p>}
          {selected && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{selected.subject}</h3>
                  <p className="text-xs text-muted-foreground">{selected.stores?.name} • Prioridade: {selected.priority}</p>
                </div>
                <Select value={selected.status} onValueChange={(v) => setStatus(selected.id, v)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["open","in_progress","waiting_customer","resolved","closed"].map(s =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="border border-border rounded p-3 bg-muted/30 text-sm whitespace-pre-wrap">{selected.body}</div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {msgs.map(m => (
                  <div key={m.id} className={`p-3 rounded text-sm ${m.author_role === "super_admin" ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                    <p className="text-[10px] text-muted-foreground mb-1">{m.author_role} • {new Date(m.created_at).toLocaleString("pt-BR")}</p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder..." rows={2} />
                <Button onClick={sendReply}>Enviar</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
