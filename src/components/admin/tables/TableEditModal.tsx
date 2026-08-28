import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { RestaurantTable, Sector } from "@/hooks/useTables";

type Props = {
  storeId: string;
  table: RestaurantTable | null;
  sectors: Sector[];
  onClose: () => void;
};

export const TableEditModal = ({ storeId, table, sectors, onClose }: Props) => {
  const qc = useQueryClient();
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [sectorId, setSectorId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNumber(table ? String(table.number) : "");
    setName(table?.name ?? "");
    setCapacity(String(table?.capacity ?? 4));
    setSectorId(table?.sector_id ?? "");
    setNotes(table?.notes ?? "");
  }, [table]);

  const save = async () => {
    if (!number) return toast.error("Informe o número da mesa");
    setSaving(true);
    const payload = {
      store_id: storeId,
      number: Number(number),
      name: name || null,
      capacity: Number(capacity) || 4,
      sector_id: sectorId || null,
      notes: notes || null,
    };
    const { error } = table
      ? await supabase.from("tables").update(payload).eq("id", table.id)
      : await supabase.from("tables").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(table ? "Mesa atualizada" : "Mesa criada");
    qc.invalidateQueries({ queryKey: ["tables", storeId] });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{table ? `Editar mesa ${table.number}` : "Criar mesa"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Número</Label>
            <Input type="number" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <Label>Capacidade</Label>
            <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Nome (opcional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Varanda, VIP, Balcão" />
          </div>
          <div className="col-span-2">
            <Label>Setor</Label>
            <select
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Sem setor —</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
