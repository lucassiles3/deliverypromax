import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Lock,
  Unlock,
  Receipt,
  ArrowDownToLine,
  ArrowUpFromLine,
  Printer,
  History,
  X,
} from "lucide-react";
import { printReceipt, type PrintData, type PrintFormat } from "@/lib/printReceipt";
import { useStoreToggles } from "@/hooks/useStoreToggles";

type Product = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
};

type CartItem = {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
};

type PaymentLine = {
  method: "cash" | "pix" | "credit" | "debit";
  amount: number;
};

const PAY_LABEL: Record<PaymentLine["method"], string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit: "Crédito",
  debit: "Débito",
};

export const PDVTab = ({
  storeId,
  storeName,
  fullscreen = false,
}: {
  storeId: string;
  storeName: string;
  fullscreen?: boolean;
}) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toggles } = useStoreToggles(storeId);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showCash, setShowCash] = useState(false);

  // Caixa aberto
  const { data: openRegister } = useQuery({
    queryKey: ["pdv-cash-open", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("store_id", storeId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Produtos
  const { data: products = [] } = useQuery({
    queryKey: ["pdv-products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, price, image_url, active")
        .eq("store_id", storeId)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  // Histórico de vendas PDV
  const { data: history = [] } = useQuery({
    queryKey: ["pdv-history", storeId],
    enabled: !!storeId && showHistory,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name, total, payment_method, created_at, status")
        .eq("store_id", storeId)
        .eq("method", "pickup")
        .eq("notes", "[PDV]")
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);

  const addProduct = (p: Product) => {
    setCart((c) => {
      const found = c.find((i) => i.product_id === p.id);
      if (found) {
        return c.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...c,
        { product_id: p.id, product_name: p.name, unit_price: Number(p.price), quantity: 1 },
      ];
    });
  };

  const setQty = (id: string, qty: number) => {
    if (qty <= 0) return setCart((c) => c.filter((i) => i.product_id !== id));
    setCart((c) => c.map((i) => (i.product_id === id ? { ...i, quantity: qty } : i)));
  };

  const addPayment = (method: PaymentLine["method"]) => {
    setPayments((ps) => [...ps, { method, amount: remaining > 0 ? remaining : total }]);
  };

  const updatePayment = (idx: number, amount: number) => {
    setPayments((ps) => ps.map((p, i) => (i === idx ? { ...p, amount } : p)));
  };

  const removePayment = (idx: number) => {
    setPayments((ps) => ps.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    setCart([]);
    setPayments([]);
    setDiscount(0);
    setCustomerName("");
    setCustomerPhone("");
  };

  const finishSale = async () => {
    if (cart.length === 0) return toast.error("Carrinho vazio");
    if (!openRegister) return toast.error("Abra o caixa antes de vender");
    if (paid < total) return toast.error("Pagamento insuficiente");

    const mainPayment = payments[0]?.method ?? "cash";

    // 1. Cria order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        store_id: storeId,
        customer_name: customerName.trim() || "Cliente balcão",
        customer_phone: customerPhone.trim() || "",
        total,
        subtotal,
        delivery_fee: 0,
        coupon_discount: discount,
        method: "pickup",
        payment_method: mainPayment,
        status: "delivered",
        notes: "[PDV]",
        change_for: change > 0 ? paid : null,
        user_id: user?.id ?? null,
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error(orderErr);
      return toast.error("Falha ao registrar venda");
    }

    // 2. Items
    const itemsPayload = cart.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));
    await supabase.from("order_items").insert(itemsPayload);

    // 3. PDV payments
    const payPayload = payments.map((p) => ({
      order_id: order.id,
      store_id: storeId,
      method: p.method,
      amount: p.amount,
      change_given: p.method === "cash" && change > 0 ? change : 0,
    }));
    await supabase.from("pdv_payments").insert(payPayload);

    // 4. Cash movement (apenas dinheiro entra fisicamente no caixa)
    const cashPaid = payments
      .filter((p) => p.method === "cash")
      .reduce((s, p) => s + p.amount, 0);
    if (cashPaid > 0) {
      await supabase.from("cash_movements").insert({
        cash_register_id: openRegister.id,
        store_id: storeId,
        order_id: order.id,
        type: "sale",
        payment_method: "cash",
        amount: cashPaid - (change > 0 ? change : 0),
        description: `Venda PDV #${order.id.slice(0, 6).toUpperCase()}`,
        created_by: user?.id ?? null,
        created_by_name: user?.email ?? null,
      });
    }

    toast.success(`Venda registrada • Total ${formatBRL(total)}`);

    // 5. Auto-print
    if (toggles.auto_print_enabled) {
      printReceipt(
        {
          storeName,
          orderId: order.id,
          orderShortId: order.id.slice(0, 6).toUpperCase(),
          createdAt: order.created_at,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          method: "pdv",
          paymentMethod: mainPayment,
          changeFor: change > 0 ? paid : null,
          items: cart.map((i) => ({
            quantity: i.quantity,
            product_name: i.product_name,
            unit_price: i.unit_price,
          })),
          subtotal,
          discount,
          total,
        } as PrintData,
        toggles.print_format as PrintFormat,
      );
    }

    clearAll();
    qc.invalidateQueries({ queryKey: ["pdv-history", storeId] });
    qc.invalidateQueries({ queryKey: ["pdv-cash-open", storeId] });
  };

  return (
    <div className={fullscreen ? "min-h-screen bg-muted/40" : ""}>
      <div className={`grid gap-4 ${fullscreen ? "p-4" : ""} lg:grid-cols-[1fr_400px]`}>
        {/* Esquerda: produtos */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto…"
                className="w-full rounded-xl border-2 border-border bg-card py-2.5 pl-10 pr-3 text-sm font-semibold outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
              <History className="mr-1.5 h-4 w-4" /> Histórico
            </Button>
            <Button
              variant={openRegister ? "outline" : "default"}
              size="sm"
              onClick={() => setShowCash(true)}
            >
              {openRegister ? (
                <>
                  <Unlock className="mr-1.5 h-4 w-4 text-green-600" /> Caixa aberto
                </>
              ) : (
                <>
                  <Lock className="mr-1.5 h-4 w-4" /> Abrir caixa
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="rounded-xl border-2 border-border bg-card p-3 text-left transition-smooth hover:border-primary hover:shadow-md active:scale-[0.98]"
              >
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="mb-2 aspect-square w-full rounded-lg object-cover"
                  />
                )}
                <div className="line-clamp-2 text-sm font-bold">{p.name}</div>
                <div className="mt-1 text-sm font-bold text-primary">{formatBRL(p.price)}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado.
              </p>
            )}
          </div>
        </div>

        {/* Direita: carrinho */}
        <aside className="flex h-fit flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft lg:sticky lg:top-4">
          <h3 className="font-display text-lg font-bold">Venda atual</h3>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome (opcional)"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Telefone (opcional)"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="max-h-[35vh] space-y-1.5 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Carrinho vazio</p>
            ) : (
              cart.map((i) => (
                <div
                  key={i.product_id}
                  className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
                >
                  <div className="flex-1 truncate">
                    <div className="truncate text-sm font-bold">{i.product_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatBRL(i.unit_price)} cada
                    </div>
                  </div>
                  <button
                    onClick={() => setQty(i.product_id, i.quantity - 1)}
                    className="rounded bg-background p-1 hover:bg-muted"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{i.quantity}</span>
                  <button
                    onClick={() => setQty(i.product_id, i.quantity + 1)}
                    className="rounded bg-background p-1 hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="w-16 text-right text-sm font-bold">
                    {formatBRL(i.unit_price * i.quantity)}
                  </span>
                  <button
                    onClick={() => setQty(i.product_id, 0)}
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-1.5 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatBRL(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Desconto</span>
              <input
                type="number"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded border border-border bg-background px-2 py-0.5 text-right outline-none focus:border-primary"
              />
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-primary">{formatBRL(total)}</span>
            </div>
          </div>

          {/* Pagamentos */}
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pagamentos
            </p>
            <div className="grid grid-cols-4 gap-1">
              {(["cash", "pix", "credit", "debit"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => addPayment(m)}
                  disabled={total === 0}
                  className="rounded-lg border border-border bg-background py-2 text-xs font-bold hover:border-primary disabled:opacity-40"
                >
                  + {PAY_LABEL[m]}
                </button>
              ))}
            </div>
            {payments.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5 text-sm"
              >
                <span className="flex-1 font-bold">{PAY_LABEL[p.method]}</span>
                <input
                  type="number"
                  min={0}
                  value={p.amount}
                  onChange={(e) => updatePayment(idx, Math.max(0, Number(e.target.value) || 0))}
                  className="w-24 rounded border border-border bg-background px-2 py-0.5 text-right outline-none focus:border-primary"
                />
                <button
                  onClick={() => removePayment(idx)}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {payments.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Pago {formatBRL(paid)}{remaining > 0 ? ` • Falta ${formatBRL(remaining)}` : ""}
                </span>
                {change > 0 && (
                  <span className="font-bold text-green-600">Troco {formatBRL(change)}</span>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={finishSale}
            disabled={cart.length === 0 || paid < total || !openRegister}
            className="gradient-primary font-bold"
            size="lg"
          >
            <Receipt className="mr-2 h-4 w-4" /> Finalizar venda
          </Button>
          {!openRegister && (
            <p className="text-center text-[11px] text-amber-600">
              ⚠️ Abra o caixa antes de vender
            </p>
          )}
          {cart.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Limpar tudo
            </button>
          )}
        </aside>
      </div>

      {showHistory && (
        <HistoryDrawer history={history as any} onClose={() => setShowHistory(false)} />
      )}
      {showCash && (
        <CashDrawer
          storeId={storeId}
          openRegister={openRegister}
          onClose={() => setShowCash(false)}
        />
      )}
    </div>
  );
};

const formatBRL = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

const HistoryDrawer = ({ history, onClose }: { history: any[]; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
    <div
      className="h-full w-full max-w-md overflow-y-auto bg-background p-5 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-xl font-bold">Vendas PDV de hoje</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>
      {history.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda hoje.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((o) => (
            <li key={o.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex justify-between font-bold">
                <span>#{o.id.slice(0, 6).toUpperCase()}</span>
                <span className="text-primary">{formatBRL(Number(o.total))}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{o.customer_name}</span>
                <span>{new Date(o.created_at).toLocaleTimeString("pt-BR")}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-between border-t pt-3 font-bold">
        <span>Total do dia</span>
        <span className="text-primary">
          {formatBRL(history.reduce((s, o) => s + Number(o.total), 0))}
        </span>
      </div>
    </div>
  </div>
);

const CashDrawer = ({
  storeId,
  openRegister,
  onClose,
}: {
  storeId: string;
  openRegister: any;
  onClose: () => void;
}) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [initial, setInitial] = useState(0);
  const [counted, setCounted] = useState(0);
  const [notes, setNotes] = useState("");
  const [movAmount, setMovAmount] = useState(0);
  const [movDesc, setMovDesc] = useState("");

  // Esperado quando há caixa aberto
  const { data: expected = 0 } = useQuery({
    queryKey: ["pdv-cash-expected", openRegister?.id],
    enabled: !!openRegister?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cash_register_expected", {
        _register_id: openRegister.id,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    refetchInterval: 5000,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["pdv-cash-movements", openRegister?.id],
    enabled: !!openRegister?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("cash_register_id", openRegister.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCash = async () => {
    const { error } = await supabase.from("cash_registers").insert({
      store_id: storeId,
      initial_amount: initial,
      opened_by: user?.id ?? null,
      opened_by_name: user?.email ?? null,
      status: "open",
    });
    if (error) return toast.error(error.message);
    toast.success("Caixa aberto");
    qc.invalidateQueries({ queryKey: ["pdv-cash-open", storeId] });
    onClose();
  };

  const closeCash = async () => {
    if (!openRegister) return;
    const diff = counted - expected;
    const { error } = await supabase
      .from("cash_registers")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: user?.id ?? null,
        closed_by_name: user?.email ?? null,
        expected_amount: expected,
        counted_amount: counted,
        difference: diff,
        notes,
      })
      .eq("id", openRegister.id);
    if (error) return toast.error(error.message);
    toast.success(
      `Caixa fechado • ${diff === 0 ? "sem divergência" : diff > 0 ? `sobra ${formatBRL(diff)}` : `falta ${formatBRL(-diff)}`}`,
    );
    qc.invalidateQueries({ queryKey: ["pdv-cash-open", storeId] });
    onClose();
  };

  const addMovement = async (type: "withdrawal" | "deposit") => {
    if (!openRegister || movAmount <= 0) return;
    const { error } = await supabase.from("cash_movements").insert({
      cash_register_id: openRegister.id,
      store_id: storeId,
      type,
      payment_method: "cash",
      amount: type === "withdrawal" ? -Math.abs(movAmount) : Math.abs(movAmount),
      description: movDesc || (type === "withdrawal" ? "Sangria" : "Suprimento"),
      created_by: user?.id ?? null,
      created_by_name: user?.email ?? null,
    });
    if (error) return toast.error(error.message);
    setMovAmount(0);
    setMovDesc("");
    qc.invalidateQueries({ queryKey: ["pdv-cash-movements", openRegister.id] });
    qc.invalidateQueries({ queryKey: ["pdv-cash-expected", openRegister.id] });
    toast.success(type === "withdrawal" ? "Sangria registrada" : "Suprimento registrado");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">
            {openRegister ? "Caixa aberto" : "Abrir caixa"}
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!openRegister ? (
          <div className="space-y-3">
            <label className="block text-sm">
              Valor inicial (troco)
              <input
                type="number"
                min={0}
                value={initial}
                onChange={(e) => setInitial(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 w-full rounded-lg border-2 border-border bg-background px-3 py-2 font-bold outline-none focus:border-primary"
              />
            </label>
            <Button onClick={openCash} className="w-full gradient-primary" size="lg">
              <Unlock className="mr-2 h-4 w-4" /> Abrir caixa
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary/5 p-3 text-sm">
              <div className="flex justify-between">
                <span>Aberto em</span>
                <span className="font-bold">
                  {new Date(openRegister.opened_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Inicial</span>
                <span className="font-bold">{formatBRL(Number(openRegister.initial_amount))}</span>
              </div>
              <div className="flex justify-between text-base">
                <span>Esperado em dinheiro</span>
                <span className="font-bold text-primary">{formatBRL(expected)}</span>
              </div>
            </div>

            {/* Sangria/Suprimento */}
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Movimentação
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={movAmount}
                  onChange={(e) => setMovAmount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="Valor"
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={movDesc}
                  onChange={(e) => setMovDesc(e.target.value)}
                  placeholder="Descrição (opcional)"
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => addMovement("withdrawal")}>
                  <ArrowUpFromLine className="mr-1 h-3.5 w-3.5" /> Sangria
                </Button>
                <Button size="sm" variant="outline" onClick={() => addMovement("deposit")}>
                  <ArrowDownToLine className="mr-1 h-3.5 w-3.5" /> Suprimento
                </Button>
              </div>
            </div>

            {/* Movimentos */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Histórico
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {movements.length === 0 ? (
                  <li className="text-muted-foreground">Nenhum movimento ainda</li>
                ) : (
                  movements.map((m: any) => (
                    <li key={m.id} className="flex justify-between rounded bg-muted/30 px-2 py-1">
                      <span>
                        <strong>{labelMov(m.type)}</strong> • {m.description ?? ""}
                      </span>
                      <span
                        className={
                          Number(m.amount) < 0 ? "font-bold text-destructive" : "font-bold text-green-600"
                        }
                      >
                        {formatBRL(Number(m.amount))}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Fechar caixa */}
            <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-destructive">
                Fechar caixa
              </p>
              <label className="block text-sm">
                Valor contado em dinheiro
                <input
                  type="number"
                  min={0}
                  value={counted}
                  onChange={(e) => setCounted(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border-2 border-border bg-background px-3 py-2 font-bold outline-none focus:border-primary"
                />
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Observações (opcional)"
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {counted > 0 && (
                <div className="mt-2 text-sm">
                  Diferença:{" "}
                  <strong
                    className={
                      counted - expected === 0
                        ? "text-foreground"
                        : counted - expected > 0
                          ? "text-green-600"
                          : "text-destructive"
                    }
                  >
                    {formatBRL(counted - expected)}
                  </strong>
                </div>
              )}
              <Button
                onClick={closeCash}
                variant="destructive"
                className="mt-2 w-full"
                size="lg"
              >
                <Lock className="mr-2 h-4 w-4" /> Fechar caixa (Relatório Z)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const labelMov = (t: string) =>
  ({ sale: "Venda", withdrawal: "Sangria", deposit: "Suprimento", adjustment: "Ajuste" } as Record<
    string,
    string
  >)[t] ?? t;
