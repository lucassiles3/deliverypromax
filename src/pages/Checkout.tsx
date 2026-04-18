import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Bike, Store as StoreIcon, MapPin, Tag, Sparkles, CheckCircle2, Copy, QrCode } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useStoreBySlug, useCoupons } from "@/hooks/useStores";
import type { Coupon } from "@/data/stores";
import { useLoyalty, CASHBACK_RATE } from "@/hooks/useLoyalty";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Method = "delivery" | "pickup";

const Checkout = () => {
  const { items, subtotal, storeSlug, clear } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const loyalty = useLoyalty();
  const { data: store, isLoading } = useStoreBySlug(storeSlug ?? "");
  const { data: coupons = [] } = useCoupons();

  const [method, setMethod] = useState<Method>("delivery");
  const [address, setAddress] = useState({ cep: "", street: "", number: "", complement: "", neighborhood: "" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [useCashback, setUseCashback] = useState(false);
  const [step, setStep] = useState<"form" | "pix" | "done">("form");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Checkout • FoodFlash";
  }, []);

  const fee =
    !store
      ? 0
      : method === "pickup"
        ? 0
        : subtotal >= store.freeShippingThreshold
          ? 0
          : store.deliveryFee;

  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.minOrder && subtotal < appliedCoupon.minOrder) return 0;
    if (appliedCoupon.type === "free_shipping") return method === "delivery" ? fee : 0;
    if (appliedCoupon.type === "percent") return Math.round(subtotal * (appliedCoupon.value / 100) * 100) / 100;
    return appliedCoupon.value;
  }, [appliedCoupon, subtotal, fee, method]);

  const cashbackAvail = Math.min(loyalty.cashback, Math.max(0, subtotal - couponDiscount));
  const cashbackUsed = useCashback ? cashbackAvail : 0;

  const total = Math.max(0, subtotal + fee - couponDiscount - cashbackUsed);
  const earned = Math.round(Math.max(0, total) * CASHBACK_RATE * 100) / 100;

  const applyCoupon = () => {
    const c = coupons.find((x) => x.code === couponCode.trim().toUpperCase());
    if (!c) return toast.error("Cupom inválido");
    if (c.minOrder && subtotal < c.minOrder)
      return toast.error(`Pedido mínimo de R$ ${c.minOrder.toFixed(2).replace(".", ",")}`);
    setAppliedCoupon(c);
    toast.success(`Cupom aplicado: ${c.label}`);
  };

  const goPix = () => {
    if (!store) return;
    if (!user) {
      toast.error("Faça login para finalizar o pedido");
      navigate("/auth");
      return;
    }
    if (subtotal < store.minOrder)
      return toast.error(`Pedido mínimo: R$ ${store.minOrder.toFixed(2).replace(".", ",")}`);
    if (!name.trim() || !phone.trim()) return toast.error("Preencha nome e telefone");
    if (method === "delivery" && (!address.cep || !address.street || !address.number))
      return toast.error("Preencha o endereço");
    setStep("pix");
  };

  const confirmPayment = async () => {
    if (!store || !user) return;
    setSubmitting(true);
    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          store_id: store.id,
          customer_name: name,
          customer_phone: phone,
          method,
          address: method === "delivery" ? address : null,
          subtotal,
          delivery_fee: fee,
          coupon_code: appliedCoupon?.code ?? null,
          coupon_discount: couponDiscount,
          cashback_used: cashbackUsed,
          cashback_earned: earned,
          total,
          status: "received",
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const itemsPayload = items.map((it) => ({
        order_id: order.id,
        product_id: it.product.id,
        product_name: it.product.name,
        unit_price: it.unitPrice,
        quantity: it.quantity,
        notes: it.notes ?? null,
        customizations: it.customizations as any,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      const { error: loyaltyErr } = await supabase.rpc("apply_order_loyalty", {
        _order_total: total,
        _cashback_used: cashbackUsed,
      });
      if (loyaltyErr) throw loyaltyErr;

      setStep("done");
      toast.success(`Pedido confirmado! Você ganhou R$ ${earned.toFixed(2).replace(".", ",")} de cashback 🎉`);
      setTimeout(() => {
        clear();
        navigate("/");
      }, 3500);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const pixCode = useMemo(
    () =>
      `00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${total
        .toFixed(2)
        .padStart(6, "0")}5802BR5913FoodFlash6009Sao Paulo62070503***6304ABCD`,
    [total],
  );

  const qrCells = useMemo(() => {
    const cells: { k: string; x: number; y: number }[] = [];
    const t = Math.floor(total);
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        const seed = (i * 31 + j * 17 + t) % 7;
        if (seed < 3) cells.push({ k: `${i}-${j}`, x: i * 5, y: j * 5 });
      }
    }
    return cells;
  }, [total]);

  if (isLoading) return <div className="min-h-screen" />;
  if (!store || items.length === 0) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-muted/40 pb-24">
      <Header />
      <div className="container py-6">
        <Link
          to={`/loja/${store.slug}`}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a loja
        </Link>

        {step === "done" ? (
          <div className="mx-auto max-w-md rounded-3xl bg-card p-8 text-center shadow-float animate-float-in">
            <CheckCircle2 className="mx-auto h-20 w-20 text-success" strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-2xl font-bold">Pedido confirmado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tempo estimado: <strong className="text-foreground">{store.deliveryTime}</strong>
            </p>
            <p className="mt-4 text-sm">Você receberá atualizações no WhatsApp 📱</p>
          </div>
        ) : step === "pix" ? (
          <div className="mx-auto max-w-md rounded-3xl bg-card p-6 shadow-float animate-float-in">
            <div className="text-center">
              <QrCode className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-2 font-display text-2xl font-bold">Pague com Pix</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Total: <strong className="text-foreground">R$ {total.toFixed(2).replace(".", ",")}</strong>
              </p>
            </div>

            <div className="mx-auto mt-5 flex h-56 w-56 items-center justify-center rounded-2xl border-2 border-dashed bg-background">
              <svg viewBox="0 0 100 100" className="h-48 w-48">
                {qrCells.map((c) => (
                  <rect key={c.k} x={c.x} y={c.y} width="5" height="5" fill="hsl(var(--foreground))" />
                ))}
                <rect x="0" y="0" width="25" height="25" fill="none" stroke="hsl(var(--foreground))" strokeWidth="3" />
                <rect x="75" y="0" width="25" height="25" fill="none" stroke="hsl(var(--foreground))" strokeWidth="3" />
                <rect x="0" y="75" width="25" height="25" fill="none" stroke="hsl(var(--foreground))" strokeWidth="3" />
              </svg>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(pixCode);
                toast.success("Código Pix copiado!");
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3 text-sm font-bold text-primary hover:bg-primary/10"
            >
              <Copy className="h-4 w-4" /> Copiar código Pix
            </button>

            <Button
              onClick={confirmPayment}
              disabled={submitting}
              size="lg"
              className="mt-4 h-14 w-full rounded-xl gradient-primary text-base font-bold shadow-glow"
            >
              {submitting ? "Salvando..." : "Já paguei • Confirmar pedido"}
            </Button>
            <button
              onClick={() => setStep("form")}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Voltar e revisar
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* LEFT: Form */}
            <div className="space-y-5">
              {/* Method */}
              <section className="rounded-2xl bg-card p-5 shadow-soft">
                <h2 className="mb-3 font-display text-lg font-bold">Como você quer receber?</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMethod("delivery")}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-smooth ${
                      method === "delivery" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <Bike className="h-6 w-6 text-primary" />
                    <span className="font-bold">Entrega</span>
                    <span className="text-xs text-muted-foreground">{store.deliveryTime}</span>
                  </button>
                  <button
                    onClick={() => setMethod("pickup")}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-smooth ${
                      method === "pickup" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <StoreIcon className="h-6 w-6 text-primary" />
                    <span className="font-bold">Retirar na loja</span>
                    <span className="text-xs text-success">Sem taxa de entrega</span>
                  </button>
                </div>
              </section>

              {/* Personal */}
              <section className="rounded-2xl bg-card p-5 shadow-soft">
                <h2 className="mb-3 font-display text-lg font-bold">Seus dados</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    placeholder="Nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
                  />
                  <input
                    placeholder="WhatsApp (11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
                  />
                </div>
              </section>

              {/* Address */}
              {method === "delivery" && (
                <section className="rounded-2xl bg-card p-5 shadow-soft">
                  <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                    <MapPin className="h-5 w-5 text-primary" /> Endereço de entrega
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      placeholder="CEP"
                      value={address.cep}
                      onChange={(e) => setAddress({ ...address, cep: e.target.value })}
                      className="rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
                    />
                    <input
                      placeholder="Rua"
                      value={address.street}
                      onChange={(e) => setAddress({ ...address, street: e.target.value })}
                      className="rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary sm:col-span-2"
                    />
                    <input
                      placeholder="Número"
                      value={address.number}
                      onChange={(e) => setAddress({ ...address, number: e.target.value })}
                      className="rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
                    />
                    <input
                      placeholder="Complemento (opcional)"
                      value={address.complement}
                      onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                      className="rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
                    />
                    <input
                      placeholder="Bairro"
                      value={address.neighborhood}
                      onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                      className="rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </section>
              )}

              {/* Coupon + cashback */}
              <section className="rounded-2xl bg-card p-5 shadow-soft">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  <Tag className="h-5 w-5 text-primary" /> Cupom & Cashback
                </h2>
                <div className="flex gap-2">
                  <input
                    placeholder="Digite o cupom (ex: BEMVINDO20)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 rounded-xl border-2 border-border bg-background p-3 text-sm font-mono uppercase outline-none focus:border-primary"
                  />
                  <Button onClick={applyCoupon} variant="secondary" className="rounded-xl">
                    Aplicar
                  </Button>
                </div>
                {appliedCoupon && (
                  <p className="mt-2 text-xs text-success">
                    ✓ {appliedCoupon.label} — desconto de R$ {couponDiscount.toFixed(2).replace(".", ",")}
                  </p>
                )}

                {coupons.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground">Tente:</span>
                    {coupons.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => setCouponCode(c.code)}
                        className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono font-bold hover:bg-primary/10"
                      >
                        {c.code}
                      </button>
                    ))}
                  </div>
                )}

                {loyalty.cashback > 0 && (
                  <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border-2 border-dashed border-success/40 bg-success/5 p-3">
                    <div>
                      <p className="flex items-center gap-1.5 font-bold text-success">
                        <Sparkles className="h-4 w-4" /> Usar meu cashback
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo disponível: R$ {loyalty.cashback.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={useCashback}
                      onChange={(e) => setUseCashback(e.target.checked)}
                      className="h-5 w-5 accent-success"
                    />
                  </label>
                )}
              </section>
            </div>

            {/* RIGHT: Summary */}
            <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-2xl bg-card p-5 shadow-card">
                <h3 className="mb-3 font-display text-lg font-bold">Resumo do pedido</h3>
                <ul className="space-y-2 border-b pb-3 text-sm">
                  {items.map((it) => (
                    <li key={it.lineId} className="flex justify-between gap-2">
                      <span>
                        <strong>{it.quantity}×</strong> {it.product.name}
                      </span>
                      <span className="shrink-0">R$ {(it.unitPrice * it.quantity).toFixed(2).replace(".", ",")}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-1.5 py-3 text-sm">
                  <Row label="Subtotal" value={subtotal} />
                  <Row label={method === "pickup" ? "Entrega (retirada)" : "Entrega"} value={fee} highlight={fee === 0} />
                  {couponDiscount > 0 && <Row label="Cupom" value={-couponDiscount} highlight />}
                  {cashbackUsed > 0 && <Row label="Cashback" value={-cashbackUsed} highlight />}
                </div>
                <div className="flex justify-between border-t pt-3 font-display text-xl font-bold">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
                {earned > 0 && (
                  <p className="mt-2 text-center text-xs font-semibold text-success">
                    Você vai ganhar R$ {earned.toFixed(2).replace(".", ",")} de cashback ✨
                  </p>
                )}
                <Button
                  onClick={goPix}
                  size="lg"
                  className="mt-4 h-14 w-full rounded-xl gradient-primary text-base font-bold shadow-glow transition-bounce hover:scale-[1.02]"
                >
                  Pagar com Pix • R$ {total.toFixed(2).replace(".", ",")}
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Pagamento seguro • SSL criptografado
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) => (
  <div className="flex justify-between text-muted-foreground">
    <span>{label}</span>
    <span className={highlight ? "font-semibold text-success" : ""}>
      {value === 0 ? "Grátis" : `${value < 0 ? "-" : ""}R$ ${Math.abs(value).toFixed(2).replace(".", ",")}`}
    </span>
  </div>
);

export default Checkout;
