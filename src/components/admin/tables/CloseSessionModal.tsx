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
import { useStoreToggles } from "@/hooks/useStoreToggles";

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
  const { toggles } = useStoreToggles(storeId);
  const total = Number(session.total);
  const [payments, setPayments] = useState<Payment[]>([{ method: "cash", amount: total }]);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

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

    // 4. criar pedido tipo "mesa" no Kanban (status delivered) para histórico/integrações
    try {
      const { data: items } = await supabase
        .from("table_session_items")
        .select("product_id, product_name, quantity, unit_price, notes")
        .eq("session_id", session.id);
      const primaryMethod = (payRows[0]?.method ?? "cash") as string;
      const pmMap: Record<string, string> = { cash: "cash", pix: "pix", credit: "credit_card", debit: "debit_card", voucher: "voucher" };
      const { data: ord } = await supabase
        .from("orders")
        .insert({
          store_id: storeId,
          customer_name: session.customer_name || `Mesa ${tableNumber}`,
          customer_phone: session.customer_phone || "—",
          subtotal: Number(session.subtotal),
          delivery_fee: 0,
          total: Number(session.total),
          method: "pickup",
          payment_method: pmMap[primaryMethod] as any,
          status: "delivered",
          source: "mesa",
          table_session_id: session.id,
          table_number: tableNumber,
          notes: session.notes || `Comanda mesa ${tableNumber} · ${session.people} pessoa(s)`,
        })
        .select("id")
        .maybeSingle();
      if (ord && items?.length) {
        await supabase.from("order_items").insert(
          items.map((it: any) => ({
            order_id: ord.id,
            product_id: it.product_id,
            product_name: it.product_name,
            quantity: it.quantity,
            unit_price: Number(it.unit_price),
            notes: it.notes,
          })),
        );
      }
    } catch (e) {
      console.warn("Falha ao criar pedido kanban da mesa:", e);
    }

    toast.success("🎉 Mesa finalizada");
    if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
    qc.invalidateQueries({ queryKey: ["tables", storeId] });
    qc.invalidateQueries({ queryKey: ["open-sessions", storeId] });
    onClosed();
  };

  const printReceipt = async () => {
    try {
      setPrinting(true);
      const format = (toggles.print_format ?? "thermal_80mm") as "a4" | "thermal_80mm" | "thermal_58mm";

      const [storeRes, itemsRes] = await Promise.all([
        supabase
          .from("stores")
          .select(
            "name, tagline, phone, cnpj, instagram, address_cep, address_street, address_number, address_complement, address_neighborhood, city, address_state"
          )
          .eq("id", storeId)
          .maybeSingle(),
        supabase
          .from("table_session_items")
          .select("product_name, quantity, unit_price, notes, customer_name")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true }),
      ]);

      const store = storeRes.data ?? {};
      const items = itemsRes.data ?? [];

      const fullAddress = [
        (store as any).address_street &&
          `${(store as any).address_street}${(store as any).address_number ? `, ${(store as any).address_number}` : ""}`,
        (store as any).address_complement,
        (store as any).address_neighborhood,
        [(store as any).city, (store as any).address_state].filter(Boolean).join("/"),
        (store as any).address_cep && `CEP ${(store as any).address_cep}`,
      ]
        .filter(Boolean)
        .join(" — ");

      const isThermal58 = format === "thermal_58mm";
      const isThermal80 = format === "thermal_80mm";
      const isThermal = isThermal58 || isThermal80;

      const css = isThermal58
        ? `@page{size:58mm auto;margin:1mm}body{font-family:'Courier New',monospace;font-size:10px;line-height:1.25;width:54mm;margin:0;color:#000}h1{font-size:12px;margin:0 0 3px;text-align:center}h2{font-size:11px;margin:6px 0 3px;text-align:center}.center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px dashed #000;margin:4px 0}.row{display:flex;justify-content:space-between;gap:4px}.item{margin-bottom:3px}.item-row{display:flex;justify-content:space-between;gap:4px}.item-extras{padding-left:6px;font-size:9px;color:#333}.total{font-size:12px;font-weight:bold}.small{font-size:9px}`
        : isThermal80
        ? `@page{size:80mm auto;margin:2mm}body{font-family:'Courier New',monospace;font-size:11px;line-height:1.3;width:76mm;margin:0;color:#000}h1{font-size:14px;margin:0 0 4px;text-align:center}h2{font-size:12px;margin:8px 0 4px;text-align:center}.center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;gap:6px}.item{margin-bottom:4px}.item-row{display:flex;justify-content:space-between;gap:6px}.item-extras{padding-left:8px;font-size:10px;color:#333}.total{font-size:14px;font-weight:bold}.small{font-size:10px}`
        : `@page{size:A4;margin:12mm}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#111;max-width:600px;margin:0 auto}h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:14px 0 6px}.center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px solid #ddd;margin:10px 0}.row{display:flex;justify-content:space-between;gap:12px}.item{margin-bottom:6px;padding-bottom:4px;border-bottom:1px dashed #eee}.item-row{display:flex;justify-content:space-between;gap:12px;font-weight:600}.item-extras{padding-left:12px;font-size:12px;color:#555}.total{font-size:18px;font-weight:bold}.small{font-size:11px;color:#555}`;

      const esc = (s: any) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const itemsHtml = items.length
        ? items
            .map((it: any) => {
              const sub = Number(it.quantity) * Number(it.unit_price || 0);
              return `<div class="item">
                <div class="item-row"><span>${it.quantity}× ${esc(it.product_name)}</span><span>${brl(sub)}</span></div>
                ${it.customer_name ? `<div class="item-extras">Cliente: ${esc(it.customer_name)}</div>` : ""}
                ${it.notes ? `<div class="item-extras">Obs: ${esc(it.notes)}</div>` : ""}
              </div>`;
            })
            .join("")
        : '<div class="small center">Sem itens registrados</div>';

      const paysHtml = payments
        .filter((p) => Number(p.amount) > 0)
        .map(
          (p) =>
            `<div class="row"><span>${labels[p.method].label}${p.payer ? ` (${esc(p.payer)})` : ""}</span><span>${brl(Number(p.amount))}</span></div>`
        )
        .join("");

      const openedAt = session.opened_at ? new Date(session.opened_at).toLocaleString("pt-BR") : "—";
      const closedAt = new Date().toLocaleString("pt-BR");

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Comanda Mesa ${tableNumber}</title><style>${css}</style></head><body>
  <h1>${esc((store as any).name || "Estabelecimento")}</h1>
  ${(store as any).tagline ? `<div class="center small">${esc((store as any).tagline)}</div>` : ""}
  <div class="center small">
    ${(store as any).cnpj ? `CNPJ: ${esc((store as any).cnpj)}<br/>` : ""}
    ${(store as any).phone ? `Tel: ${esc((store as any).phone)}<br/>` : ""}
    ${fullAddress ? `${esc(fullAddress)}<br/>` : ""}
    ${(store as any).instagram ? `Instagram: ${esc((store as any).instagram)}` : ""}
  </div>
  <div class="divider"></div>

  <div class="center bold">CUPOM NÃO FISCAL — COMANDA</div>
  <div class="row"><span class="bold">Mesa</span><span class="bold">#${tableNumber}</span></div>
  <div class="row"><span>Sessão</span><span>${esc(String(session.id).slice(0, 8).toUpperCase())}</span></div>
  ${session.customer_name ? `<div class="row"><span>Cliente</span><span>${esc(session.customer_name)}</span></div>` : ""}
  ${session.people ? `<div class="row"><span>Pessoas</span><span>${session.people}</span></div>` : ""}
  ${session.waiter_name ? `<div class="row"><span>Garçom</span><span>${esc(session.waiter_name)}</span></div>` : ""}
  <div class="row small"><span>Aberta em</span><span>${openedAt}</span></div>
  <div class="row small"><span>Fechada em</span><span>${closedAt}</span></div>

  <h2>ITENS CONSUMIDOS</h2>
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>

  <div class="row"><span>Subtotal</span><span>${brl(Number(session.subtotal))}</span></div>
  ${
    Number(session.service_fee_percent) > 0
      ? `<div class="row"><span>Serviço (${session.service_fee_percent}%)</span><span>${brl(Number(session.service_fee))}</span></div>`
      : ""
  }
  ${Number(session.discount) > 0 ? `<div class="row"><span>Desconto</span><span>- ${brl(Number(session.discount))}</span></div>` : ""}
  <div class="row total"><span>TOTAL</span><span>${brl(total)}</span></div>

  <h2>PAGAMENTOS</h2>
  ${paysHtml || '<div class="small center">Nenhum pagamento informado</div>'}
  ${session.notes ? `<div class="divider"></div><div class="small"><span class="bold">Observações da comanda:</span><br/>${esc(session.notes)}</div>` : ""}

  <div class="divider"></div>
  <div class="center small">Obrigado pela preferência!<br/>Volte sempre 🧡</div>

  <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},300)},120)};</script>
</body></html>`;

      const w = window.open("", "_blank", isThermal ? "width=380,height=640" : "width=720,height=900");
      if (!w) {
        toast.error("Popup bloqueado — habilite popups para imprimir.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao imprimir");
    } finally {
      setPrinting(false);
    }
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
          <Button variant="outline" onClick={printReceipt} disabled={printing}><Printer className="mr-1 h-4 w-4" />{printing ? "Imprimindo…" : "Imprimir"}</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={finalize} disabled={saving || (remaining > 0.01)}>
            {saving ? "Finalizando…" : "Finalizar e liberar mesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
