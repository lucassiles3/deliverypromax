import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Plan = { id: string; name: string; slug: string; price_monthly: number; trial_days: number };
type Sub = {
  id: string; store_id: string; plan_id: string | null; status: string;
  monthly_amount: number; trial_ends_at: string | null; next_payment_at: string | null;
  stores: { name: string } | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export default function MasterSubscriptions() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);

  const load = async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("subscription_plans").select("*").order("sort_order"),
      supabase
        .from("store_subscriptions")
        .select("id,store_id,plan_id,status,monthly_amount,trial_ends_at,next_payment_at,stores(name)")
        .order("created_at", { ascending: false }),
    ]);
    setPlans((p as Plan[]) || []);
    setSubs((s as any) || []);
  };
  useEffect(() => { load(); }, []);

  const updateSub = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("store_subscriptions").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Assinatura atualizada");
    load();
  };

  const groups = {
    trial: subs.filter(s => s.status === "trial").length,
    active: subs.filter(s => s.status === "active").length,
    overdue: subs.filter(s => s.status === "overdue").length,
    cancelled: subs.filter(s => s.status === "cancelled").length,
  };
  const mrr = subs.filter(s => s.status === "active").reduce((a, b) => a + Number(b.monthly_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Ativas", groups.active],
          ["Trial", groups.trial],
          ["Inadimplentes", groups.overdue],
          ["Canceladas", groups.cancelled],
          ["MRR", fmt(mrr)],
        ].map(([l, v]) => (
          <Card key={String(l)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-2xl font-bold mt-1">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Planos disponíveis</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="border border-border rounded-lg p-4">
              <p className="font-bold">{p.name}</p>
              <p className="text-2xl font-bold mt-2">{fmt(p.price_monthly)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
              <p className="text-xs text-muted-foreground mt-1">{p.trial_days} dias de trial</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Assinaturas das lojas</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3">Loja</th>
                <th className="text-left p-3">Plano</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Mensal</th>
                <th className="text-left p-3">Próx. cobrança</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{s.stores?.name || "—"}</td>
                  <td className="p-3">
                    <Select value={s.plan_id || ""} onValueChange={(v) => {
                      const plan = plans.find(p => p.id === v);
                      updateSub(s.id, { plan_id: v, monthly_amount: plan?.price_monthly || 0 } as any);
                    }}>
                      <SelectTrigger className="h-8 w-32"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select value={s.status} onValueChange={(v) => updateSub(s.id, { status: v } as any)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["trial","active","overdue","cancelled","blocked"].map(x =>
                          <SelectItem key={x} value={x}>{x}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right">{fmt(Number(s.monthly_amount))}</td>
                  <td className="p-3 text-muted-foreground">
                    {s.next_payment_at ? new Date(s.next_payment_at).toLocaleDateString("pt-BR") :
                     s.trial_ends_at ? `Trial até ${new Date(s.trial_ends_at).toLocaleDateString("pt-BR")}` : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => updateSub(s.id, {
                      next_payment_at: new Date(Date.now() + 30*86400000).toISOString(),
                      status: "active",
                    } as any)}>Renovar 30d</Button>
                  </td>
                </tr>
              ))}
              {subs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem assinaturas.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
