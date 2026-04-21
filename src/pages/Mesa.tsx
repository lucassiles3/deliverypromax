import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Receipt, HelpCircle, Check, Plus, Minus, ShoppingBag, Search, X, QrCode, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { brl } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  image_url: string | null;
  description: string | null;
};

const Mesa = () => {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [table, setTable] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<string | null>(null);
  const [tab, setTab] = useState<"menu" | "comanda">("menu");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);
  const [confirmQty, setConfirmQty] = useState(1);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [pixOpen, setPixOpen] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixTxn, setPixTxn] = useState<any>(null);

  useEffect(() => {
    document.title = "Mesa · Pedido";
    if (!token) return;
    (async () => {
      const { data: t } = await supabase
        .from("tables")
        .select("id, store_id, number, name")
        .eq("qr_token", token)
        .maybeSingle();
      if (t) {
        setTable(t);
        const { data: s } = await supabase.from("stores").select("name, logo, slug").eq("id", t.store_id).maybeSingle();
        setStore(s);
      }
      setLoading(false);
    })();
  }, [token]);

  // Sessão aberta da mesa
  const { data: session } = useQuery({
    queryKey: ["mesa-session", table?.id],
    enabled: !!table?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("table_sessions")
        .select("id, status, subtotal, service_fee, service_fee_percent, total, opened_at")
        .eq("table_id", table.id)
        .eq("status", "open")
        .maybeSingle();
      return data;
    },
    refetchInterval: 8000,
  });

  // Produtos da loja
  const { data: products = [] } = useQuery({
    queryKey: ["mesa-products", table?.store_id],
    enabled: !!table?.store_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, category, image_url, description")
        .eq("store_id", table.store_id)
        .eq("active", true)
        .order("position");
      return (data ?? []) as Product[];
    },
  });

  // Itens já lançados
  const { data: items = [] } = useQuery({
    queryKey: ["mesa-items", session?.id],
    enabled: !!session?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("table_session_items")
        .select("id, product_name, quantity, unit_price, total, kitchen_status, customer_requested, notes, created_at")
        .eq("session_id", session!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (category === "all" || p.category === category) && (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products, search, category]);

  const call = async (reason: "waiter" | "bill" | "help") => {
    if (!table) return;
    const { error } = await supabase.from("table_calls").insert({
      store_id: table.store_id,
      table_id: table.id,
      reason,
    });
    if (error) return toast.error(error.message);
    setSent(reason);
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    setTimeout(() => setSent(null), 4000);
  };

  const sendOrder = async () => {
    if (!confirmProduct || !session) return;
    const { error } = await supabase.from("table_session_items").insert({
      session_id: session.id,
      store_id: table.store_id,
      product_id: confirmProduct.id,
      product_name: confirmProduct.name,
      quantity: confirmQty,
      unit_price: Number(confirmProduct.price),
      notes: confirmNotes || null,
      customer_requested: true,
      kitchen_status: "pending",
      created_by_name: "Cliente (Mesa)",
    });
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado para o garçom!");
    if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
    setConfirmProduct(null);
    setConfirmQty(1);
    setConfirmNotes("");
    qc.invalidateQueries({ queryKey: ["mesa-items", session.id] });
    setTab("comanda");
  };

  // Polling do status do PIX após gerar
  useEffect(() => {
    if (!pixTxn?.id) return;
    const ch = supabase
      .channel(`pix-${pixTxn.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payment_transactions", filter: `id=eq.${pixTxn.id}` },
        (payload: any) => {
          if (payload.new?.status === "approved") {
            toast.success("✅ Pagamento confirmado!");
            setPixOpen(false);
            setPixTxn(null);
            qc.invalidateQueries({ queryKey: ["mesa-session", table?.id] });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pixTxn?.id, qc, table?.id]);

  const payWithPix = async () => {
    if (!token || !session) return;
    setPixLoading(true);
    setPixOpen(true);
    setPixTxn(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-create-table`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ qr_token: token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao gerar PIX");
      setPixTxn(json.data);
    } catch (e: any) {
      toast.error(e.message);
      setPixOpen(false);
    } finally {
      setPixLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen" />;
  if (!table) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="rounded-2xl bg-card p-8 text-center shadow-soft">
          <h1 className="font-display text-xl font-bold">Mesa não encontrada</h1>
        </div>
      </div>
    );
  }

  const itemCount = items.reduce((s: number, i: any) => s + i.quantity, 0);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            {store && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{store.name}</div>}
            <div className="font-display text-xl font-bold">
              Mesa {table.number}
              {table.name && <span className="ml-2 text-xs text-muted-foreground">· {table.name}</span>}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => call("waiter")} disabled={sent === "waiter"}>
            {sent === "waiter" ? <Check className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            <span className="ml-1 text-xs">Garçom</span>
          </Button>
        </div>

        {session && (
          <div className="mx-auto mt-3 flex max-w-2xl gap-1 rounded-full border bg-muted/40 p-1">
            <button
              onClick={() => setTab("menu")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-smooth ${
                tab === "menu" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Cardápio
            </button>
            <button
              onClick={() => setTab("comanda")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-smooth ${
                tab === "comanda" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Comanda {itemCount > 0 && <span className="ml-1 rounded-full bg-background/20 px-1.5 text-[10px]">{itemCount}</span>}
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 p-4 pb-24">
        {!session ? (
          /* Sem comanda aberta — só ações */
          <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
            <p className="text-sm text-muted-foreground">A comanda ainda não foi aberta pelo garçom.</p>
            <p className="mt-1 text-xs text-muted-foreground">Toque para chamar:</p>
            <div className="mt-4 grid gap-3">
              <Button size="lg" onClick={() => call("waiter")} disabled={sent === "waiter"} className="h-14 text-base">
                {sent === "waiter" ? <><Check className="mr-2 h-5 w-5" />Garçom a caminho</> : <><Bell className="mr-2 h-5 w-5" />Chamar garçom</>}
              </Button>
              <Button size="lg" variant="outline" onClick={() => call("help")} disabled={sent === "help"} className="h-14 text-base">
                {sent === "help" ? <><Check className="mr-2 h-5 w-5" />Avisamos a equipe</> : <><HelpCircle className="mr-2 h-5 w-5" />Preciso de ajuda</>}
              </Button>
            </div>
          </div>
        ) : tab === "menu" ? (
          <>
            <div className="sticky top-[112px] z-10 -mx-4 mb-3 bg-gradient-to-b from-background to-background/80 px-4 py-2 backdrop-blur">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-full pl-9"
                  placeholder="Buscar no cardápio…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold transition-smooth ${
                      category === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {c === "all" ? "Todos" : c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setConfirmProduct(p);
                    setConfirmQty(1);
                    setConfirmNotes("");
                  }}
                  className="group flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-smooth hover:border-primary hover:shadow-soft"
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-2xl">🍽️</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-bold">{p.name}</div>
                    {p.description && <div className="line-clamp-1 text-[11px] text-muted-foreground">{p.description}</div>}
                    <div className="mt-1 text-sm font-bold text-primary">{brl(Number(p.price))}</div>
                  </div>
                  <div className="rounded-full bg-primary p-2 text-primary-foreground transition-smooth group-hover:scale-110">
                    <Plus className="h-4 w-4" />
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full rounded-2xl border-2 border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado
                </div>
              )}
            </div>
          </>
        ) : (
          /* COMANDA */
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed bg-card p-10 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 font-display text-lg font-bold">Comanda vazia</p>
                <p className="text-xs text-muted-foreground">Volte ao cardápio e adicione itens</p>
                <Button onClick={() => setTab("menu")} className="mt-3" size="sm">Ver cardápio</Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {items.map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between rounded-2xl border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{it.quantity}x</span>
                          <span className="line-clamp-1 text-sm">{it.product_name}</span>
                        </div>
                        {it.notes && <div className="text-[11px] text-muted-foreground">📝 {it.notes}</div>}
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              it.kitchen_status === "pending"
                                ? "bg-muted text-muted-foreground"
                                : it.kitchen_status === "preparing"
                                ? "bg-amber-500/10 text-amber-700"
                                : it.kitchen_status === "ready"
                                ? "bg-blue-500/10 text-blue-700"
                                : it.kitchen_status === "delivered"
                                ? "bg-green-500/10 text-green-700"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {it.kitchen_status === "pending"
                              ? "Aguardando"
                              : it.kitchen_status === "preparing"
                              ? "Preparando"
                              : it.kitchen_status === "ready"
                              ? "Pronto"
                              : it.kitchen_status === "delivered"
                              ? "Entregue"
                              : "Cancelado"}
                          </span>
                          {it.customer_requested && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              Você
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold">{brl(Number(it.total))}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border bg-card p-4 text-sm shadow-soft">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-bold">{brl(Number(session.subtotal))}</span>
                  </div>
                  {Number(session.service_fee) > 0 && (
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">Serviço ({session.service_fee_percent}%)</span>
                      <span className="font-bold">{brl(Number(session.service_fee))}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-baseline justify-between border-t pt-2">
                    <span className="font-bold">Total</span>
                    <span className="font-display text-2xl font-bold text-primary">{brl(Number(session.total))}</span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    size="lg"
                    className="h-14 w-full text-base"
                    onClick={payWithPix}
                    disabled={pixLoading}
                  >
                    <QrCode className="mr-2 h-5 w-5" />
                    {pixLoading ? "Gerando…" : "Pagar com PIX"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 w-full text-base"
                    onClick={() => call("bill")}
                    disabled={sent === "bill"}
                  >
                    {sent === "bill" ? (
                      <><Check className="mr-2 h-5 w-5" />Aviso enviado</>
                    ) : (
                      <><Receipt className="mr-2 h-5 w-5" />Chamar garçom</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Carrinho flutuante quando está no menu */}
      {session && tab === "menu" && itemCount > 0 && (
        <button
          onClick={() => setTab("comanda")}
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg transition-smooth hover:scale-105"
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="text-sm font-bold">Ver comanda · {brl(Number(session.total))}</span>
          <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs font-bold">{itemCount}</span>
        </button>
      )}

      {/* Modal de confirmação de item */}
      <Dialog open={!!confirmProduct} onOpenChange={(o) => !o && setConfirmProduct(null)}>
        <DialogContent className="max-w-md">
          {confirmProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{confirmProduct.name}</DialogTitle>
              </DialogHeader>
              {confirmProduct.image_url && (
                <img src={confirmProduct.image_url} alt={confirmProduct.name} className="h-40 w-full rounded-xl object-cover" />
              )}
              {confirmProduct.description && (
                <p className="text-sm text-muted-foreground">{confirmProduct.description}</p>
              )}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observações</label>
                <Textarea
                  placeholder="Ex: sem cebola, ponto da carne…"
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setConfirmQty(Math.max(1, confirmQty - 1))}
                  className="rounded-full border p-2 hover:bg-muted"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-display text-2xl font-bold">{confirmQty}</span>
                <button
                  onClick={() => setConfirmQty(confirmQty + 1)}
                  className="rounded-full border p-2 hover:bg-muted"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmProduct(null)}>Cancelar</Button>
                <Button onClick={sendOrder} className="flex-1">
                  Pedir · {brl(Number(confirmProduct.price) * confirmQty)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal PIX */}
      <Dialog open={pixOpen} onOpenChange={(o) => { if (!o) { setPixOpen(false); setPixTxn(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /> Pagar com PIX</DialogTitle>
          </DialogHeader>
          {pixLoading || !pixTxn ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Gerando QR Code…</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Escaneie com o app do seu banco
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-xs text-muted-foreground">Valor:</span>
                <span className="font-display text-2xl font-bold text-primary">{brl(Number(pixTxn.amount))}</span>
              </div>
              {pixTxn.qr_code_base64 && (
                <img
                  src={`data:image/png;base64,${pixTxn.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="mx-auto h-56 w-56 rounded-xl border"
                />
              )}
              {pixTxn.qr_code_payload && (
                <div className="rounded-xl border-2 border-dashed bg-muted/30 p-3">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Pix copia-e-cola</div>
                  <div className="mt-1 break-all text-[11px] font-mono">{pixTxn.qr_code_payload.slice(0, 80)}…</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(pixTxn.qr_code_payload);
                      toast.success("Código copiado");
                    }}
                  >
                    <Copy className="mr-1 h-4 w-4" /> Copiar código
                  </Button>
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                ⏳ Aguardando confirmação… A tela atualiza sozinha.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mesa;
