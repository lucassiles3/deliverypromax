import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Check, X, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useTables } from "@/hooks/useTables";

export const ReservationsView = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const { data: tables = [] } = useTables(storeId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", people: "2", when: "", tableId: "", notes: "" });

  const { data: reservations = [] } = useQuery({
    queryKey: ["reservations", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_reservations")
        .select("*, tables:table_id(number, name)")
        .eq("store_id", storeId)
        .order("reserved_for", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const create = async () => {
    if (!form.name || !form.when) return toast.error("Preencha nome e data/hora");
    const { error } = await supabase.from("table_reservations").insert({
      store_id: storeId,
      table_id: form.tableId || null,
      customer_name: form.name,
      customer_phone: form.phone || null,
      people: Number(form.people) || 2,
      reserved_for: new Date(form.when).toISOString(),
      notes: form.notes || null,
      status: "confirmed",
    });
    if (error) return toast.error(error.message);
    toast.success("Reserva criada");
    setShowForm(false);
    setForm({ name: "", phone: "", people: "2", when: "", tableId: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["reservations", storeId] });
  };

  const updateStatus = async (id: string, status: "pending" | "confirmed" | "seated" | "cancelled" | "no_show") => {
    const { error } = await supabase.from("table_reservations").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reservations", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="font-display text-lg font-bold">Reservas</h3>
        <Button onClick={() => setShowForm((s) => !s)}><Plus className="mr-1 h-4 w-4" />Nova reserva</Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Pessoas</Label><Input type="number" value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} /></div>
            <div><Label>Data e hora</Label><Input type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} /></div>
            <div>
              <Label>Mesa (opcional)</Label>
              <select value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Qualquer —</option>
                {tables.map((t) => <option key={t.id} value={t.id}>Mesa {t.number}{t.name ? ` · ${t.name}` : ""}</option>)}
              </select>
            </div>
            <div className="col-span-full"><Label>Observações</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-3 flex gap-2"><Button onClick={create}>Salvar</Button><Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button></div>
        </div>
      )}

      <div className="rounded-2xl border bg-card">
        {reservations.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma reserva</div>
        ) : (
          reservations.map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-bold">{r.customer_name} <span className="text-xs text-muted-foreground">· {r.people}p</span></div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.reserved_for).toLocaleString("pt-BR")}
                  {r.tables && ` · Mesa ${r.tables.number}`}
                  {r.customer_phone && ` · ${r.customer_phone}`}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                r.status === "confirmed" ? "bg-green-500/10 text-green-700" :
                r.status === "seated" ? "bg-blue-500/10 text-blue-700" :
                r.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                r.status === "no_show" ? "bg-muted text-muted-foreground" :
                "bg-amber-500/10 text-amber-700"
              }`}>{r.status}</span>
              <div className="flex gap-1">
                <button onClick={() => updateStatus(r.id, "seated")} title="Chegou" className="rounded p-1 text-green-600 hover:bg-muted"><Check className="h-4 w-4" /></button>
                <button onClick={() => updateStatus(r.id, "cancelled")} title="Cancelar" className="rounded p-1 text-destructive hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
