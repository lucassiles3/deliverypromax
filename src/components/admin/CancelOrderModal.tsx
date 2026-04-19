import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const REASONS = [
  { value: "Produto indisponível", by: "store" as const },
  { value: "Erro no pedido (cliente)", by: "customer" as const },
  { value: "Não localizado para entrega", by: "courier" as const },
  { value: "Solicitação do cliente", by: "customer" as const },
  { value: "Outro", by: "store" as const },
];

export const CancelOrderModal = ({
  orderId,
  storeId,
  open,
  onClose,
}: {
  orderId: string | null;
  storeId: string;
  open: boolean;
  onClose: () => void;
}) => {
  const qc = useQueryClient();
  const [reason, setReason] = useState(REASONS[0].value);
  const [free, setFree] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!orderId) return;
    const sel = REASONS.find((r) => r.value === reason)!;
    const finalReason = reason === "Outro" ? free.trim() || "Outro" : reason;
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: finalReason,
        cancel_by: sel.by,
      })
      .eq("id", orderId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido cancelado");
    qc.invalidateQueries({ queryKey: ["admin-orders", storeId] });
    qc.invalidateQueries({ queryKey: ["dashboard-live", storeId] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="text-sm font-bold">Motivo</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border-2 bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.value}
              </option>
            ))}
          </select>
          {reason === "Outro" && (
            <textarea
              value={free}
              onChange={(e) => setFree(e.target.value)}
              placeholder="Descreva o motivo..."
              rows={3}
              className="w-full rounded-lg border-2 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          )}
          <p className="text-xs text-muted-foreground">
            O cliente será notificado do cancelamento.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
