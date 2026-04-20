import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { brl, elapsed } from "@/lib/format";
import {
  Plus, Minus, Trash2, Search, ChefHat, CheckCircle2, Clock, Bell, Receipt, Users, Percent,
} from "lucide-react";
import type { RestaurantTable } from "@/hooks/useTables";
import { useAuth } from "@/hooks/useAuth";
import { SplitBillModal } from "./SplitBillModal";
import { CloseSessionModal } from "./CloseSessionModal";

type Props = { storeId: string; table: RestaurantTable; onClose: () => void };

type SessionItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string | null;
  kitchen_status: "pending" | "preparing" | "ready" | "delivered" | "cancelled";
  destination: string;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  image_url: string | null;
};

const kStyle: Record<SessionItem["kitchen_status"], { bg: string; label: string; icon: typeof Clock }> = {
  pending: { bg: "bg-muted text-muted-foreground", label: "Pendente", icon: Clock },
  preparing: { bg: "bg-amber-500/10 text-amber-700", label: "Preparo", icon: ChefHat },
  ready: { bg: "bg-blue-500/10 text-blue-700", label: "Pronto", icon: Bell },
  delivered: { bg: "bg-green-500/10 text-green-700", label: "Entregue", icon: CheckCircle2 },
  cancelled: { bg: "bg-destructive/10 text-destructive", label: "Cancelado", icon: Clock },
};

export const TableSessionDrawer = ({ storeId, table, onClose }: Props) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [openingForm, setOpeningForm] = useState({ people: "2", waiter: "", customerName: "", customerPhone: "" });
  const [showSplit, setShowSplit] = useState(false);
  const [showClose, setShowClose] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["store-members", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_members")
        .select("user_id, display_name, role")
        .eq("store_id", storeId)
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: storeCfg } = useQuery({
    queryKey: ["store-cfg-tables", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("service_fee_percent, service_fee_default_on")
        .eq("id", storeId)
        .maybeSingle();
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pdv-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, category, image_url")
        .eq("store_id", storeId)
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: session, refetch: refetchSession } = useQuery({
    queryKey: ["session-of", table.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_sessions")
        .select("*")
        .eq("table_id", table.id)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["session-items", session?.id],
    enabled: !!session?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_session_items")
        .select("*")
        .eq("session_id", session!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as SessionItem[];
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!session?.id) return;
    const ch = supabase
      .channel(`session-${session.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_session_items", filter: `session_id=eq.${session.id}` }, () => {
        refetchItems();
        refetchSession();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "table_sessions", filter: `id=eq.${session.id}` }, () => {
        refetchSession();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session?.id, refetchItems, refetchSession]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q)),
    );
  }, [products, search, category]);

  const openSession = async () => {
    const waiterMember = members.find((m: any) => m.user_id === openingForm.waiter);
    const fee = storeCfg?.service_fee_default_on ? Number(storeCfg?.service_fee_percent ?? 10) : 0;
    const { error } = await supabase.from("table_sessions").insert({
      store_id: storeId,
      table_id: table.id,
      status: "open",
      people: Number(openingForm.people) || 1,
      waiter_user_id: waiterMember?.user_id ?? null,
      waiter_name: waiterMember?.display_name ?? null,
      customer_name: openingForm.customerName || null,
      customer_phone: openingForm.customerPhone || null,
      service_fee_percent: fee,
    });
    if (error) return toast.error(error.message);
    toast.success("Comanda aberta");
    qc.invalidateQueries({ queryKey: ["tables", storeId] });
    qc.invalidateQueries({ queryKey: ["open-sessions", storeId] });
    refetchSession();
  };

  const addItem = async (p: Product, qty = 1, notes?: string) => {
    if (!session) return;
    const { error } = await supabase.from("table_session_items").insert({
      session_id: session.id,
      store_id: storeId,
      product_id: p.id,
      product_name: p.name,
      quantity: qty,
      unit_price: Number(p.price),
      notes: notes || null,
      created_by: user?.id,
      created_by_name: user?.email ?? null,
    });
    if (error) return toast.error(error.message);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const updateItemQty = async (id: string, qty: number) => {
    if (qty <= 0) {
      await supabase.from("table_session_items").delete().eq("id", id);
    } else {
      await supabase.from("table_session_items").update({ quantity: qty }).eq("id", id);
    }
  };

  const updateItemStatus = async (id: string, kitchen_status: SessionItem["kitchen_status"]) => {
    await supabase.from("table_session_items").update({ kitchen_status }).eq("id", id);
  };

  const removeItem = async (id: string) => {
    if (!confirm("Remover item?")) return;
    await supabase.from("table_session_items").delete().eq("id", id);
  };

  const updateDiscount = async (val: number) => {
    if (!session) return;
    await supabase.from("table_sessions").update({ discount: val }).eq("id", session.id);
    // dispara recálculo via trigger? trigger só dispara em itens/pagamentos. Vamos chamar RPC.
    await supabase.rpc("recalc_table_session" as any, { _session_id: session.id });
    refetchSession();
  };

  const updateFeePct = async (val: number) => {
    if (!session) return;
    await supabase.from("table_sessions").update({ service_fee_percent: val }).eq("id", session.id);
    await supabase.rpc("recalc_table_session" as any, { _session_id: session.id });
    refetchSession();
  };

  const remaining = session ? Number(session.total) - Number(session.paid_amount) : 0;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-3xl overflow-y-auto p-0 sm:max-w-3xl">
        <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="font-display text-2xl">
                Mesa {table.number}
                {table.name && <span className="ml-2 text-base text-muted-foreground">· {table.name}</span>}
              </SheetTitle>
              {session && (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{elapsed(session.opened_at)}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.people} pessoa(s)</span>
                  {session.waiter_name && <span>Garçom: <strong className="text-foreground">{session.waiter_name}</strong></span>}
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

        {!session ? (
          <div className="space-y-4 p-5">
            <h3 className="font-display text-lg font-bold">Abrir comanda</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pessoas</Label>
                <Input type="number" value={openingForm.people} onChange={(e) => setOpeningForm({ ...openingForm, people: e.target.value })} />
              </div>
              <div>
                <Label>Garçom</Label>
                <select
                  value={openingForm.waiter}
                  onChange={(e) => setOpeningForm({ ...openingForm, waiter: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Selecionar —</option>
                  {members.map((m: any) => (
                    <option key={m.user_id} value={m.user_id}>{m.display_name ?? m.user_id.slice(0, 8)} ({m.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Nome do cliente (opcional)</Label>
                <Input value={openingForm.customerName} onChange={(e) => setOpeningForm({ ...openingForm, customerName: e.target.value })} />
              </div>
              <div>
                <Label>Telefone (opcional)</Label>
                <Input value={openingForm.customerPhone} onChange={(e) => setOpeningForm({ ...openingForm, customerPhone: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={openSession}>Abrir comanda</Button>
          </div>
        ) : (
          <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr]">
            {/* Lançamento */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar produto…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${
                      category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {c === "all" ? "Todos" : c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filtered.slice(0, 60).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="flex flex-col rounded-xl border bg-card p-2 text-left transition-smooth hover:border-primary"
                  >
                    <div className="line-clamp-2 text-xs font-bold">{p.name}</div>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <span className="text-xs font-bold text-primary">{brl(Number(p.price))}</span>
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-full rounded-xl border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
                    Nenhum produto
                  </div>
                )}
              </div>
            </div>

            {/* Comanda */}
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border bg-card">
                <div className="border-b px-3 py-2 text-sm font-bold">Comanda</div>
                <div className="max-h-[40vh] overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">Nenhum item lançado</div>
                  ) : (
                    items.map((it) => {
                      const s = kStyle[it.kitchen_status];
                      const isCustomer = (it as any).customer_requested;
                      return (
                        <div
                          key={it.id}
                          className={`flex items-start gap-2 border-b px-3 py-2 last:border-b-0 ${
                            isCustomer && it.kitchen_status === "pending" ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{it.product_name}</span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${s.bg}`}>{s.label}</span>
                              {isCustomer && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                  📱 Cliente
                                </span>
                              )}
                            </div>
                            {it.notes && <div className="text-[11px] text-muted-foreground">📝 {it.notes}</div>}
                            <div className="mt-1 flex items-center gap-1.5">
                              <button onClick={() => updateItemQty(it.id, it.quantity - 1)} className="rounded border p-0.5 hover:bg-muted">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold">{it.quantity}</span>
                              <button onClick={() => updateItemQty(it.id, it.quantity + 1)} className="rounded border p-0.5 hover:bg-muted">
                                <Plus className="h-3 w-3" />
                              </button>
                              <select
                                value={it.kitchen_status}
                                onChange={(e) => updateItemStatus(it.id, e.target.value as any)}
                                className="ml-2 rounded border bg-background px-1 py-0.5 text-[10px]"
                              >
                                <option value="pending">Pendente</option>
                                <option value="preparing">Preparo</option>
                                <option value="ready">Pronto</option>
                                <option value="delivered">Entregue</option>
                                <option value="cancelled">Cancelado</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-bold">{brl(Number(it.total))}</span>
                            <button onClick={() => removeItem(it.id)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-bold">{brl(Number(session.subtotal))}</span></div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground"><Percent className="h-3 w-3" />Serviço</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      defaultValue={Number(session.service_fee_percent)}
                      onBlur={(e) => updateFeePct(Number(e.target.value) || 0)}
                      className="w-14 rounded border bg-background px-1 text-right text-xs"
                    />
                    <span className="text-xs">%</span>
                    <span className="ml-2 font-bold">{brl(Number(session.service_fee))}</span>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Desconto</span>
                  <input
                    type="number"
                    defaultValue={Number(session.discount)}
                    onBlur={(e) => updateDiscount(Number(e.target.value) || 0)}
                    className="w-20 rounded border bg-background px-1 text-right text-xs"
                  />
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 text-base">
                  <span className="font-bold">Total</span>
                  <span className="font-display text-xl font-bold text-primary">{brl(Number(session.total))}</span>
                </div>
                {Number(session.paid_amount) > 0 && (
                  <>
                    <div className="mt-1 flex justify-between text-xs"><span>Pago</span><span className="font-bold">{brl(Number(session.paid_amount))}</span></div>
                    <div className="flex justify-between text-xs"><span>Restante</span><span className="font-bold text-destructive">{brl(remaining)}</span></div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setShowSplit(true)}><Users className="mr-1 h-4 w-4" />Dividir conta</Button>
                <Button onClick={() => setShowClose(true)} disabled={items.length === 0}>
                  <Receipt className="mr-1 h-4 w-4" />Finalizar mesa
                </Button>
              </div>
            </div>
          </div>
        )}

        {showSplit && session && (
          <SplitBillModal session={session} items={items} onClose={() => setShowSplit(false)} />
        )}
        {showClose && session && (
          <CloseSessionModal
            storeId={storeId}
            session={session}
            tableNumber={table.number}
            onClose={() => setShowClose(false)}
            onClosed={() => {
              setShowClose(false);
              onClose();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};
