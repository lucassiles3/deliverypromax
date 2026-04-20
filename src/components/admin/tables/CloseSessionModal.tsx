import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banknote, CreditCard, QrCode, Wallet, Plus, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";

type Method = "cash" | "pix" | "credit" | "debit" | "voucher";
type Payment = { method: Method; amount: number; payer?: string };

const labels: Record<Method, { label: string; icon: typeof Banknote }> = {
  cash: { label: "Dinheiro", icon: Banknote },
  pix: { label: "PIX", icon: QrCode },
  credit: { label: "Crédito", icon: CreditCard },
  debit: { label: "Débito", icon: CreditCard },
  voucher: { label: "Vale-refeição", icon: Wallet },
};

export const CloseSessionModal = ({
  storeId, session, tableNumber, onClose, onClosed,
}: {
  storeId: string;
  session: any;
  tableNumber: number;
  onClose: () => void;
  onClosed: () => void;
}) => {
  const qc = useQueryClient();
  const total = Number(session.total);
  const [payments, setPayments] = useState<Payment[]>([{ method: "cash", amount: total }]);
  const [saving, setSaving] = useState(false);

  const sumPaid = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);
  const remaining = +(total - sumPaid).toFixed(2);

  const addPayment = () => setPayments([...payments, { method: "cash", amount: Math.max(0, remaining) }]);
  const removePay = (i: number) => setPayments(payments.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<Payment>) =>
    setPayments(payments.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const finalize = async () => {
    if (Math.abs(remaining) > 0.01) {
      if (remaining > 0) return toast.error(`Faltam ${brl(remaining)}`);
    }
    setSaving(true);
    // 1. inserir pagamentos
    const payRows = payments
      .filter((p) => Number(p.amount) > 0)
      .map((p) => ({
        session_id: session.id,
        store_id: storeId,
        method: p.method,
        amount: Number(p.amount),
        payer_name: p.payer || null,
      }));
    if (payRows.length) {
      const { error } = await supabase.from("table_payments").insert(payRows);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }

    // 2. registrar no caixa aberto (se houver)
    const { data: register } = await supabase.rpc("get_open_cash_register" as any, { _store_id: storeId });
    if (register) {
      const movements = payRows.map((p) => ({
        cash_register_id: register,
        store_id: storeId,
        type: "sale",
        amount: p.amount,
        payment_method: p.method,
        description: `Mesa ${tableNumber} · sessão ${session.id.slice(0, 8)}`,
      }));
      if (movements.length) await supabase.from("cash_movements").insert(movements);
    }

    // 3. fechar comanda
    const { error: closeErr } = await supabase
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString(), cash_register_id: register ?? null })
      .eq("id", session.id);
    setSaving(false);
    if (closeErr) return toast.error(closeErr.message);

    toast.success("🎉 Mesa finalizada");
    if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
    qc.invalidateQueries({ queryKey: ["tables", storeId] });
    qc.invalidateQueries({ queryKey: ["open-sessions", storeId] });
    onClosed();
  };

  const printReceipt = () => {
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return;
    const lines = payments
      .filter((p) => Number(p.amount) > 0)
      .map((p) => `${labels[p.method].label}: ${brl(Number(p.amount))}`)
      .join("<br/>");
    w.document.write(`
      <html><body style="font-family:monospace;padding:16px;font-size:12px">
        <h2 style="text-align:center;margin:0 0 8px">Mesa ${tableNumber}</h2>
        <hr/>
        <p>Subtotal: ${brl(Number(session.subtotal))}</p>
        <p>Serviço (${session.service_fee_percent}%): ${brl(Number(session.service_fee))}</p>
        <p>Desconto: ${brl(Number(session.discount))}</p>
        <h3>Total: ${brl(total)}</h3>
        <hr/>
        ${lines}
        <hr/>
        <p style="text-align:center">Obrigado!</p>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 200);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar mesa {tableNumber}</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-bold">{brl(Number(session.subtotal))}</span></div>
          <div className="flex justify-between"><span>Serviço ({session.service_fee_percent}%)</span><span className="font-bold">{brl(Number(session.service_fee))}</span></div>
          <div className="flex justify-between"><span>Desconto</span><span className="font-bold">- {brl(Number(session.discount))}</span></div>
          <div className="mt-1 flex justify-between border-t pt-1 text-base">
            <span className="font-bold">Total</span>
            <span className="font-display text-xl font-bold text-primary">{brl(total)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Pagamentos</Label>
          {payments.map((p, i) => {
            const Icon = labels[p.method].icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={p.method}
                  onChange={(e) => update(i, { method: e.target.value as Method })}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={p.amount}
                  onChange={(e) => update(i, { amount: Number(e.target.value) })}
                  className="flex-1"
                />
                <Input
                  placeholder="Pessoa (opc.)"
                  value={p.payer ?? ""}
                  onChange={(e) => update(i, { payer: e.target.value })}
                  className="w-32"
                />
                {payments.length > 1 && (
                  <button onClick={() => removePay(i)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addPayment}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar pagamento
          </Button>
          <div className={`text-xs font-bold ${Math.abs(remaining) < 0.01 ? "text-green-600" : "text-destructive"}`}>
            {Math.abs(remaining) < 0.01 ? "✓ Quitado" : remaining > 0 ? `Falta ${brl(remaining)}` : `Troco ${brl(-remaining)}`}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={printReceipt}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={finalize} disabled={saving || (remaining > 0.01)}>
            {saving ? "Finalizando…" : "Finalizar e liberar mesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
