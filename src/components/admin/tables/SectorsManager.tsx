import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const SectorsManager = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").eq("store_id", storeId).order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("sectors").insert({ store_id: storeId, name: name.trim(), color });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["sectors", storeId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este setor?")) return;
    const { error } = await supabase.from("sectors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sectors", storeId] });
  };

  const startEdit = (s: any) => { setEditingId(s.id); setEditName(s.name); setEditColor(s.color); };
  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("sectors").update({ name: editName, color: editColor }).eq("id", editingId);
    if (error) return toast.error(error.message);
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["sectors", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3 font-display font-bold">Novo setor</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Ex.: Varanda, VIP, Balcão" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border" />
          <Button onClick={create}><Plus className="mr-1 h-4 w-4" />Criar</Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        {sectors.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum setor cadastrado</div>
        ) : (
          sectors.map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              {editingId === s.id ? (
                <>
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-8 w-10 rounded border" />
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                  <button onClick={saveEdit} className="rounded p-1 text-green-600 hover:bg-muted"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingId(null)} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 font-bold">{s.name}</span>
                  <button onClick={() => startEdit(s)} className="rounded p-1 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(s.id)} className="rounded p-1 text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
