import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  Store as StoreIcon,
  MapPin,
  Tag,
  Sparkles,
  CheckCircle2,
  Copy,
  QrCode,
  Banknote,
  CreditCard,
  Loader2,
  Crosshair,
  Pencil,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "@/components/LocationPicker";
import { useCart } from "@/context/CartContext";
import { useStoreBySlug, useCoupons } from "@/hooks/useStores";
import type { Coupon } from "@/data/stores";
import { useLoyalty, CASHBACK_RATE } from "@/hooks/useLoyalty";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { isStoreOpen } from "@/lib/storeHours";
import { lookupCep, geocodeAddress, formatCep, reverseGeocode } from "@/lib/cep";
import { distanceKm, formatDistance } from "@/lib/distance";
import { toast } from "sonner";

type Method = "delivery" | "pickup";
type PaymentMethod = "pix" | "cash" | "credit" | "debit" | "credit_link";

const Checkout = () => {
  const { items, subtotal, storeSlug, clear } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const loyalty = useLoyalty();
  const { data: store, isLoading } = useStoreBySlug(storeSlug ?? "");
  const { data: coupons = [] } = useCoupons();

  const [method, setMethod] = useState<Method>("delivery");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const [address, setAddress] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressMode, setAddressMode] = useState<"gps" | "manual">("gps");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saveContact, setSaveContact] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [useCashback, setUseCashback] = useState(false);
  const [step, setStep] = useState<"form" | "pix" | "done">("form");
  const [submitting, setSubmitting] = useState(false);
  const [paidLinkUrl, setPaidLinkUrl] = useState<string | null>(null);

  // Métodos de pagamento configurados pela loja (apenas habilitados)
  const [enabledMethods, setEnabledMethods] = useState<Record<string, { enabled: boolean; notes?: string | null }>>({});
  useEffect(() => {
    if (!store?.id) return;
    let cancelled = false;
    supabase
      .from("store_payment_methods")
      .select("method, enabled, notes")
      .eq("store_id", store.id)
      .eq("enabled", true)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, { enabled: boolean; notes?: string | null }> = {};
        data.forEach((m: any) => (map[m.method] = { enabled: m.enabled, notes: m.notes }));
        setEnabledMethods(map);
      });
    return () => {
      cancelled = true;
    };
  }, [store?.id]);

  const creditLinkTemplate = enabledMethods["credit_link"]?.notes ?? null;
  const creditLinkEnabled = !!enabledMethods["credit_link"]?.enabled && !!creditLinkTemplate;

  useEffect(() => {
    document.title = "Checkout • FoodFlash";
  }, []);

  // Pré-preenche nome/telefone: perfil do usuário > último contato salvo
  useEffect(() => {
    if (name || phone) return;
    const profileName = profile?.display_name?.trim() ?? "";
    const profilePhone = profile?.phone?.trim() ?? "";
    if (profileName || profilePhone) {
      if (profileName) setName(profileName);
      if (profilePhone) setPhone(profilePhone);
      return;
    }
    try {
      const raw = localStorage.getItem("ff_last_contact");
      if (raw) {
        const c = JSON.parse(raw);
        if (c.name) setName(c.name);
        if (c.phone) setPhone(c.phone);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.display_name, profile?.phone]);

  // Auto-lookup on CEP complete
  useEffect(() => {
    const digits = address.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    lookupCep(digits).then(async (res) => {
      if (cancelled) return;
      if (!res) {
        setCepLoading(false);
        toast.error("CEP não encontrado");
        return;
      }
      setAddress((a) => ({
        ...a,
        street: res.street || a.street,
        neighborhood: res.neighborhood || a.neighborhood,
        city: res.city || a.city,
      }));
      // Geocode to center the map
      const q = `${res.street}, ${res.city}, ${res.state}, Brasil`;
      const geo = await geocodeAddress(q);
      if (!cancelled && geo) setCoords(geo);
      setCepLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [address.cep]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("GPS não disponível neste navegador");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        const rev = await reverseGeocode(c.lat, c.lng);
        if (rev) {
          setAddress((a) => ({
            cep: rev.cep || a.cep,
            street: rev.street || a.street,
            number: rev.number || a.number,
            complement: a.complement,
            neighborhood: rev.neighborhood || a.neighborhood,
            city: rev.city || a.city,
          }));
          toast.success("Localização detectada — confira o número");
        } else {
          toast.success("Localização capturada — preencha os campos");
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada"
            : "Não foi possível obter sua localização",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30_000 },
    );
  };

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

  // Verificação de raio de entrega
  const deliveryDistance =
    coords && store?.lat && store?.lng
      ? distanceKm(coords, { lat: store.lat, lng: store.lng })
      : null;
  const deliveryRadius = store?.deliveryRadiusKm ?? null;
  const outOfDeliveryRange =
    method === "delivery" &&
    deliveryDistance !== null &&
    deliveryRadius !== null &&
    deliveryDistance > deliveryRadius;

  const applyCoupon = () => {
    const c = coupons.find((x) => x.code === couponCode.trim().toUpperCase());
    if (!c) return toast.error("Cupom inválido");
    if (c.minOrder && subtotal < c.minOrder)
      return toast.error(`Pedido mínimo de R$ ${c.minOrder.toFixed(2).replace(".", ",")}`);
    setAppliedCoupon(c);
    toast.success(`Cupom aplicado: ${c.label}`);
  };

  const paymentLabel: Record<PaymentMethod, string> = {
    pix: "Pix",
    cash: "Dinheiro",
    credit: "Cartão de crédito (na entrega)",
    debit: "Cartão de débito (na entrega)",
    credit_link: "Cartão de crédito (link de pagamento)",
  };

  // Adiciona o valor formatado no final do link (ex: /12,50)
  const buildPaymentLink = (amount: number): string | null => {
    if (!creditLinkTemplate) return null;
    const formatted = amount.toFixed(2).replace(".", ",");
    // Remove {valor} se existir, remove trailing slash, e adiciona /valor
    const base = creditLinkTemplate
      .replace(/\{valor\}/gi, "")
      .replace(/\/$/, "");
    return `${base}/${formatted}`;
  };

  const proceed = () => {
    if (!store) return;
    if (!store.open) {
      return toast.error("A loja está temporariamente fechada pelo lojista. Tente novamente em alguns minutos.");
    }
    if (!isStoreOpen(store.openingHours)) {
      return toast.error("A loja está fechada no momento. Tente novamente no horário de funcionamento.");
    }
    if (!user) {
      toast.error("Faça login para finalizar o pedido");
      navigate("/auth");
      return;
    }
    if (subtotal < store.minOrder)
      return toast.error(`Pedido mínimo: R$ ${store.minOrder.toFixed(2).replace(".", ",")}`);
    if (!name.trim() || !phone.trim()) return toast.error("Preencha nome e telefone");
    if (method === "delivery") {
      if (!address.cep || !address.street || !address.number)
        return toast.error("Preencha o endereço");
      if (!coords) return toast.error("Marque sua localização no mapa");
      if (outOfDeliveryRange)
        return toast.error(
          `Endereço fora da área de entrega (${formatDistance(deliveryDistance!)} — máx. ${deliveryRadius} km)`,
        );
    }
    if (payment === "cash" && changeFor) {
      const v = parseFloat(changeFor.replace(",", "."));
      if (isNaN(v) || v < total) return toast.error("Troco deve ser maior ou igual ao total");
    }
    if (payment === "pix") {
      setStep("pix");
    } else {
      // Cash / card on delivery → confirm directly
      void confirmPayment();
    }
  };

  const buildWhatsappUrl = (orderId: string): string | null => {
    if (!store?.whatsappPhone) return null;
    const waPhone = store.whatsappPhone.replace(/\D/g, "");
    if (!waPhone) return null;
    const lines: string[] = [];
    lines.push(`*🛵 Novo pedido — ${store.name}*`);
    lines.push(`Pedido #${orderId.slice(0, 8).toUpperCase()}`);
    lines.push("");
    lines.push(`*Cliente:* ${name}`);
    lines.push(`*WhatsApp:* ${phone}`);
    lines.push(`*Tipo:* ${method === "delivery" ? "Entrega 🛵" : "Retirada na loja 🏪"}`);
    if (method === "delivery") {
      lines.push(
        `*Endereço:* ${address.street}, ${address.number}${
          address.complement ? ` — ${address.complement}` : ""
        } — ${address.neighborhood}${address.city ? ` — ${address.city}` : ""} — CEP ${address.cep}`,
      );
      if (coords) {
        lines.push(
          `*📍 Mapa:* https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
        );
      }
    }
    lines.push("");
    lines.push("*🍔 Itens:*");
    items.forEach((it) => {
      lines.push(`• ${it.quantity}× ${it.product.name} — R$ ${(it.unitPrice * it.quantity).toFixed(2).replace(".", ",")}`);
      it.customizations.forEach((c) => {
        const sels = c.selections.map((s) => s.name).join(", ");
        if (sels) lines.push(`   ↳ ${c.groupName}: ${sels}`);
      });
      if (it.notes) lines.push(`   📝 ${it.notes}`);
    });
    lines.push("");
    lines.push(`Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}`);
    if (fee > 0) lines.push(`Entrega: R$ ${fee.toFixed(2).replace(".", ",")}`);
    if (couponDiscount > 0)
      lines.push(`Cupom (${appliedCoupon?.code}): -R$ ${couponDiscount.toFixed(2).replace(".", ",")}`);
    if (cashbackUsed > 0) lines.push(`Cashback: -R$ ${cashbackUsed.toFixed(2).replace(".", ",")}`);
    lines.push(`*Total: R$ ${total.toFixed(2).replace(".", ",")}*`);
    lines.push("");
    lines.push(`💳 *Pagamento:* ${paymentLabel[payment]}${
      payment === "pix" ? " (já confirmado pelo app)" : ""
    }`);
    if (payment === "cash" && changeFor) {
      const v = parseFloat(changeFor.replace(",", "."));
      const troco = Math.max(0, v - total);
      lines.push(`💵 Troco para R$ ${v.toFixed(2).replace(".", ",")} (devolver R$ ${troco.toFixed(2).replace(".", ",")})`);
    }
    return `https://wa.me/55${waPhone}?text=${encodeURIComponent(lines.join("\n"))}`;
  };

  const confirmPayment = async () => {
    if (!store || !user) return;
    setSubmitting(true);
    try {
      // Para "credit_link" persistimos como "credit" (enum do banco) e marcamos via notes.
      const paymentLink = payment === "credit_link" ? buildPaymentLink(total) : null;
      const dbPaymentMethod: "pix" | "cash" | "credit" | "debit" =
        payment === "credit_link" ? "credit" : payment;
      const orderNotes =
        payment === "credit_link" && paymentLink
          ? `[LINK_PAGAMENTO] ${paymentLink}`
          : null;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          store_id: store.id,
          customer_name: name,
          customer_phone: phone,
          method,
          payment_method: dbPaymentMethod,
          change_for: payment === "cash" && changeFor ? parseFloat(changeFor.replace(",", ".")) : null,
          address: method === "delivery" ? address : null,
          delivery_lat: method === "delivery" ? coords?.lat ?? null : null,
          delivery_lng: method === "delivery" ? coords?.lng ?? null : null,
          subtotal,
          delivery_fee: fee,
          coupon_code: appliedCoupon?.code ?? null,
          coupon_discount: couponDiscount,
          cashback_used: cashbackUsed,
          cashback_earned: earned,
          total,
          notes: orderNotes,
          status: payment === "pix" ? "received" : "pending_payment",
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

      // Salva contato para próximos pedidos
      if (saveContact) {
        try {
          localStorage.setItem("ff_last_contact", JSON.stringify({ name, phone }));
        } catch {}
        const profileNeedsUpdate =
          (!profile?.display_name && name) || (!profile?.phone && phone);
        if (profileNeedsUpdate) {
          updateProfile.mutate({
            display_name: profile?.display_name || name,
            phone: profile?.phone || phone,
          });
        }
      }

      const waUrl = buildWhatsappUrl(order.id);
      if (waUrl) {
        // Use anchor click to avoid popup blockers / iframe restrictions
        const a = document.createElement("a");
        a.href = waUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Abre o link de pagamento (Cartão crédito - link)
      if (paymentLink) {
        setPaidLinkUrl(paymentLink);
        const a = document.createElement("a");
        a.href = paymentLink;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setStep("done");
      toast.success(`Pedido confirmado! Você ganhou R$ ${earned.toFixed(2).replace(".", ",")} de cashback 🎉`);
      // Não redireciona automaticamente quando há link de pagamento, para o cliente poder reabrir
      if (!paymentLink) {
        setTimeout(() => {
          clear();
          navigate("/");
        }, 3500);
      }
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

  const ctaLabel =
    payment === "pix"
      ? `Pagar com Pix • R$ ${total.toFixed(2).replace(".", ",")}`
      : payment === "credit_link"
        ? `Confirmar e pagar online • R$ ${total.toFixed(2).replace(".", ",")}`
        : `Confirmar pedido • R$ ${total.toFixed(2).replace(".", ",")}`;

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
          <div className="mx-auto max-w-md rounded-2xl bg-card p-6 text-center shadow-float animate-float-in">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" strokeWidth={1.5} />
            <h2 className="mt-3 font-display text-xl font-bold sm:text-2xl">Pedido confirmado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tempo estimado: <strong className="text-foreground">{store.deliveryTime}</strong>
            </p>
            {paidLinkUrl ? (
              <div className="mt-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-left">
                <p className="text-sm font-bold text-foreground">
                  💳 Falta pagar: R$ {total.toFixed(2).replace(".", ",")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Abrimos o link de pagamento em outra aba. Caso não tenha aberto, clique abaixo:
                </p>
                <a
                  href={paidLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-bold text-primary-foreground shadow-glow"
                >
                  <CreditCard className="h-4 w-4" /> Pagar agora
                </a>
                {store?.whatsappPhone && (
                  <a
                    href={`https://wa.me/55${store.whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Olá! Segue o comprovante do meu pagamento de R$ ${total.toFixed(2).replace(".", ",")} referente ao meu pedido na ${store.name}. 📎`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-success text-sm font-bold text-success-foreground shadow-card hover:opacity-90"
                  >
                    📱 Enviar comprovante no WhatsApp
                  </a>
                )}
                <button
                  onClick={() => {
                    clear();
                    navigate("/");
                  }}
                  className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Já paguei — voltar para a home
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm">Você receberá atualizações no WhatsApp 📱</p>
            )}
          </div>
        ) : step === "pix" ? (
          <div className="mx-auto max-w-md rounded-2xl bg-card p-5 shadow-float animate-float-in">
            <div className="text-center">
              <QrCode className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl">Pague com Pix</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Total: <strong className="text-foreground">R$ {total.toFixed(2).replace(".", ",")}</strong>
              </p>
            </div>

            <div className="mx-auto mt-4 flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-dashed bg-background sm:h-52 sm:w-52">
              <svg viewBox="0 0 100 100" className="h-36 w-36 sm:h-44 sm:w-44">
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
              className="mt-4 h-12 w-full rounded-xl gradient-primary text-sm font-bold shadow-glow"
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMethod("delivery")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-smooth ${
                      method === "delivery" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <Bike className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold">Entrega</span>
                    <span className="text-xs text-muted-foreground">{store.deliveryTime}</span>
                  </button>
                  <button
                    onClick={() => setMethod("pickup")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-smooth ${
                      method === "pickup" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <StoreIcon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold">Retirar na loja</span>
                    <span className="text-xs text-success">Sem taxa de entrega</span>
                  </button>
                </div>
              </section>

              {/* Personal */}
              <section className="rounded-2xl bg-card p-5 shadow-soft">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold">Para quem é o pedido?</h2>
                  {(name || phone) && (
                    <button
                      type="button"
                      onClick={() => { setName(""); setPhone(""); }}
                      className="text-xs font-semibold text-muted-foreground hover:text-primary hover:underline"
                    >
                      Trocar
                    </button>
                  )}
                </div>
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
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={saveContact}
                    onChange={(e) => setSaveContact(e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                  Salvar nome e telefone para próximos pedidos
                </label>
              </section>

              {/* Address + Map */}
              {method === "delivery" && (
                <section className="rounded-2xl bg-card p-5 shadow-soft">
                  <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold sm:text-lg">
                    <MapPin className="h-4 w-4 text-primary" /> Endereço de entrega
                  </h2>

                  {/* Primary action: GPS */}
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={gpsLoading}
                    className="group flex w-full items-center gap-3 rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-3 text-left transition-smooth hover:border-primary hover:shadow-glow disabled:opacity-60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
                      {gpsLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Crosshair className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-display text-sm font-bold text-foreground">
                        {gpsLoading ? "Detectando localização..." : "Usar minha localização atual"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Mais rápido — preenchemos o endereço automaticamente
                      </p>
                    </div>
                  </button>

                  {/* Toggle: enviar para outro endereço */}
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Quer enviar para outro endereço?
                    </p>
                    <button
                      type="button"
                      onClick={() => setAddressMode((m) => (m === "manual" ? "gps" : "manual"))}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {addressMode === "manual" ? "Ocultar" : "Digitar endereço"}
                    </button>
                  </div>

                  {/* Manual fields — appear when GPS used (to confirm number) or user opted in */}
                  {(addressMode === "manual" || coords || address.cep) && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="relative">
                        <input
                          placeholder="CEP"
                          value={address.cep}
                          onChange={(e) => setAddress({ ...address, cep: formatCep(e.target.value) })}
                          maxLength={9}
                          className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
                        />
                        {cepLoading && (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                        )}
                      </div>
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
                  )}

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      📍 Ajuste o pino no mapa para localização exata
                    </p>
                    <LocationPicker value={coords} onChange={setCoords} />
                  </div>
                </section>
              )}

              {/* Payment method */}
              <section className="rounded-2xl bg-card p-5 shadow-soft">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  <CreditCard className="h-5 w-5 text-primary" /> Forma de pagamento
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    { v: "pix" as const, label: "Pix", icon: QrCode, hint: "Aprovação instantânea", show: true },
                    { v: "cash" as const, label: "Dinheiro", icon: Banknote, hint: "Na entrega", show: true },
                    { v: "credit" as const, label: "Crédito", icon: CreditCard, hint: "Maquininha", show: true },
                    { v: "debit" as const, label: "Débito", icon: CreditCard, hint: "Maquininha", show: true },
                    { v: "credit_link" as const, label: "Crédito (link)", icon: CreditCard, hint: "Pague online agora", show: creditLinkEnabled },
                  ]).filter((o) => o.show).map((opt) => {
                    const Icon = opt.icon;
                    const active = payment === opt.v;
                    return (
                      <button
                        key={opt.v}
                        onClick={() => setPayment(opt.v)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-smooth ${
                          active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm font-bold">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>

                {payment === "cash" && (
                  <div className="mt-4 rounded-xl border-2 border-dashed border-warning/40 bg-warning/5 p-3">
                    <label className="text-xs font-bold text-foreground">
                      Precisa de troco? Para quanto?
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={`Ex: ${(Math.ceil(total / 10) * 10).toFixed(2).replace(".", ",")} (deixe vazio se não precisa)`}
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      className="mt-2 w-full rounded-lg border-2 border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
                    />
                  </div>
                )}
              </section>

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
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Pagamento: <strong className="text-foreground">{paymentLabel[payment]}</strong>
                </p>
                {earned > 0 && (
                  <p className="mt-1 text-center text-xs font-semibold text-success">
                    Você vai ganhar R$ {earned.toFixed(2).replace(".", ",")} de cashback ✨
                  </p>
                )}
                {outOfDeliveryRange && (
                  <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
                    <p className="font-bold text-destructive">Fora da área de entrega</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Você está a <strong>{formatDistance(deliveryDistance!)}</strong> da loja —
                      ela entrega em até <strong>{deliveryRadius} km</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMethod("pickup");
                        toast.success("Trocamos para retirada na loja — seu carrinho foi preservado ✅");
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background transition-smooth hover:opacity-90"
                    >
                      <StoreIcon className="h-3.5 w-3.5" />
                      Trocar para retirada na loja
                    </button>
                  </div>
                )}
                <Button
                  onClick={proceed}
                  disabled={submitting || outOfDeliveryRange}
                  className="mt-4 h-12 w-full rounded-xl gradient-primary text-sm font-bold shadow-glow transition-bounce hover:scale-[1.01]"
                >
                  {submitting ? "Enviando..." : outOfDeliveryRange ? "Endereço fora do raio" : ctaLabel}
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
