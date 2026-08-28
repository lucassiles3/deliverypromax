import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";

type Item = { id: string; product_name: string; quantity: number; unit_price: number; total: number };
type Session = { total: number; subtotal: number; service_fee: number };

export const SplitBillModal = ({ session, items, onClose }: { session: Session; items: Item[]; onClose: () => void }) => {
  const [mode, setMode] = useState<"equal" | "items">("equal");
  const [people, setPeople] = useState("2");
  const [assigned, setAssigned] = useState<Record<string, number>>({}); // itemId -> personIndex (1..N)
  const n = Math.max(1, Number(people) || 1);
  const equalShare = useMemo(() => Number(session.total) / n, [session.total, n]);

  const perPerson = useMemo(() => {
    if (mode !== "items") return [];
    const totals: number[] = Array.from({ length: n }, () => 0);
    items.forEach((it) => {
      const p = assigned[it.id];
      if (p && p >= 1 && p <= n) totals[p - 1] += Number(it.total);
    });
    // rateia serviço proporcional
    const subSum = totals.reduce((a, b) => a + b, 0) || 1;
    const fee = Number(session.service_fee);
    return totals.map((t) => t + (t / subSum) * fee);
  }, [assigned, items, n, mode, session.service_fee]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Dividir conta · Total {brl(Number(session.total))}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("equal")}
            className={`rounded-full px-3 py-1 text-xs font-bold ${mode === "equal" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Dividir igualmente
          </button>
          <button
            onClick={() => setMode("items")}
            className={`rounded-full px-3 py-1 text-xs font-bold ${mode === "items" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Dividir por itens
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm">Pessoas:</span>
          <Input type="number" value={people} onChange={(e) => setPeople(e.target.value)} className="w-24" />
        </div>

        {mode === "equal" ? (
          <div className="rounded-xl border bg-muted/40 p-4 text-center">
            <div className="text-xs uppercase text-muted-foreground">Cada pessoa paga</div>
            <div className="mt-1 font-display text-3xl font-bold text-primary">{brl(equalShare)}</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="max-h-72 overflow-y-auto rounded-xl border">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0">
                  <div className="flex-1">
                    <div className="text-sm font-bold">{it.quantity}x {it.product_name}</div>
                    <div className="text-xs text-muted-foreground">{brl(Number(it.total))}</div>
                  </div>
                  <select
                    value={assigned[it.id] ?? ""}
                    onChange={(e) => setAssigned({ ...assigned, [it.id]: Number(e.target.value) })}
                    className="rounded border bg-background px-2 py-1 text-xs"
                  >
                    <option value="">—</option>
                    {Array.from({ length: n }).map((_, i) => (
                      <option key={i} value={i + 1}>Pessoa {i + 1}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {perPerson.map((t, i) => (
                <div key={i} className="rounded-lg border bg-muted/40 p-2 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground">Pessoa {i + 1}</div>
                  <div className="font-bold text-primary">{brl(t)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
