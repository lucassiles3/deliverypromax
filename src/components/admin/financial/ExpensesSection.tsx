import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Receipt, Calendar } from "lucide-react";
import { brl } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  cmv: "CMV (custo dos produtos)",
  operational: "Operacional",
  marketing: "Marketing",
  payroll: "Folha de pagamento",
  rent: "Aluguel",
  utilities: "Utilidades (luz, água, internet)",
  tax: "Impostos",
  other: "Outros",
};

export const ExpensesSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [filterDays, setFilterDays] = useState(30);

  const fromDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - filterDays);
    return d.toISOString().slice(0, 10);
  }, [filterDays]);

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-cats", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("expense_categories").select("*").eq("store_id", storeId).eq("active", true).order("position");
      return data ?? [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", storeId, filterDays],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("*, expense_categories(name, kind)")
        .eq("store_id", storeId)
        .gte("expense_date", fromDate)
        .order("expense_date", { ascending: false });
      return data ?? [];
    },
  });

  const total = useMemo(() => expenses.reduce((s, e: any) => s + Number(e.amount), 0), [expenses]);
  const byKind = useMemo(() => {
    const m = new Map<string, number>();
    expenses.forEach((e: any) => {
      const k = e.expense_categories?.kind ?? "other";
      m.set(k, (m.get(k) ?? 0) + Number(e.amount));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const remove = async (id: string) => {
    if (!confirm("Excluir despesa?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["expenses", storeId] });
  };

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <Receipt className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Despesas</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{expenses.length}</span>
        <div className="ml-auto flex items-center gap-2">
          <select value={filterDays} onChange={(e) => setFilterDays(Number(e.target.value))} className="rounded-xl border-2 px-2 py-1.5 text-sm font-semibold">
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" /> Nova despesa</Button>
          <CategoryButton storeId={storeId} onCreated={() => qc.invalidateQueries({ queryKey: ["expense-cats", storeId] })} />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">Total no período</div>
          <div className="font-display text-2xl font-bold">{brl(total)}</div>
        </div>
        {byKind.slice(0, 3).map(([kind, value]) => (
          <div key={kind} className="rounded-xl bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">{KIND_LABEL[kind] ?? kind}</div>
            <div className="font-display text-xl font-bold">{brl(value)}</div>
          </div>
        ))}
      </div>

      {adding && (
        <ExpenseForm
          storeId={storeId}
          categories={categories}
          onClose={() => setAdding(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["expenses", storeId] });
            setAdding(false);
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Categoria</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Nenhuma despesa.</td></tr>
            )}
            {expenses.map((e: any) => (
              <tr key={e.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  <Calendar className="mr-1 inline h-3 w-3" />
                  {new Date(e.expense_date).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-3 py-2">{e.description}{e.recurring && <span className="ml-2 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">{e.recurrence}</span>}</td>
                <td className="px-3 py-2 text-xs">{e.expense_categories?.name ?? "—"}</td>
                <td className="px-3 py-2 text-right font-bold text-destructive">- {brl(Number(e.amount))}</td>
                <td className="px-3 py-2">
                  <button onClick={() => remove(e.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const ExpenseForm = ({ storeId, categories, onClose, onSaved }: { storeId: string; categories: any[]; onClose: () => void; onSaved: () => void }) => {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category_id: categories[0]?.id ?? "",
    expense_date: new Date().toISOString().slice(0, 10),
    recurring: false,
    recurrence: "monthly",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.description.trim()) return toast.error("Descrição obrigatória");
    if (!Number(form.amount)) return toast.error("Valor inválido");
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      store_id: storeId,
      description: form.description.trim(),
      amount: Number(form.amount),
      category_id: form.category_id || null,
      expense_date: form.expense_date,
      recurring: form.recurring,
      recurrence: form.recurring ? form.recurrence : null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Despesa registrada");
    onSaved();
  };

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição" className="rounded-xl border-2 px-3 py-2 text-sm sm:col-span-2" />
        <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Valor (R$)" className="rounded-xl border-2 px-3 py-2 text-sm" />
        <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="rounded-xl border-2 px-3 py-2 text-sm" />
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="rounded-xl border-2 px-3 py-2 text-sm sm:col-span-2">
          <option value="">— Sem categoria —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({KIND_LABEL[c.kind] ?? c.kind})</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} /> Recorrente
        </label>
        {form.recurring && (
          <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })} className="rounded-xl border-2 px-3 py-2 text-sm">
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </select>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Registrar"}</Button>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
};

const CategoryButton = ({ storeId, onCreated }: { storeId: string; onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("operational");

  const create = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("expense_categories").insert({ store_id: storeId, name: name.trim(), kind });
    if (error) return toast.error(error.message);
    toast.success("Categoria criada");
    setName("");
    setOpen(false);
    onCreated();
  };

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>+ Categoria</Button>;
  return (
    <div className="flex items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria" className="rounded-xl border-2 px-2 py-1.5 text-sm" />
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-xl border-2 px-2 py-1.5 text-sm">
        {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <Button size="sm" onClick={create}>OK</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>×</Button>
    </div>
  );
};
