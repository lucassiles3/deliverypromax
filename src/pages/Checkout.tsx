import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  Store as StoreIcon,
  MapPin,
  Tag,
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
// LocationPicker carrega Leaflet (~150KB). Mantemos lazy para não pesar o caminho
// crítico do checkout — só baixa quando o cliente escolhe "Entrega".
const LocationPicker = lazy(() =>
  import("@/components/LocationPicker").then((m) => ({ default: m.LocationPicker })),
);
import { useCart } from "@/context/CartContext";
import { useStoreBySlug, useCoupons } from "@/hooks/useStores";
import type { Coupon } from "@/data/stores";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { isStoreOpen } from "@/lib/storeHours";
import { lookupCep, geocodeAddress, formatCep, reverseGeocode } from "@/lib/cep";
import { distanceKm, formatDistance } from "@/lib/distance";
import { toast } from "sonner";

type Method = "delivery" | "pickup" | "logistics";
type PaymentMethod = "pix" | "cash" | "credit" | "debit" | "credit_link" | "crypto";
type CryptoCoin = "btc" | "eth" | "usdc" | "usdt";

const CRYPTO_COIN_META: Record<CryptoCoin, { label: string; network: string }> = {
  btc: { label: "Bitcoin (BTC)", network: "Bitcoin" },
  eth: { label: "Ethereum (ETH)", network: "ERC-20" },
  usdc: { label: "USDC", network: "ERC-20 / Polygon" },
  usdt: { label: "USDT (Tether)", network: "ERC-20 / TRC-20" },
};

const PIX_TYPE_LABEL: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Celular",
  random: "Chave aleatória",
};

const Checkout = () => {
  const { items, subtotal, storeSlug, clear } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: store, isLoading } = useStoreBySlug(storeSlug ?? "");
  const { data: coupons = [] } = useCoupons();

  const [method, setMethod] = useState<Method>("delivery");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoCoin | null>(null);
  const [storePixInfo, setStorePixInfo] = useState<{
    key: string; type: string; name: string; bank: string;
  }>({ key: "", type: "random", name: "", bank: "" });
  const [storeWallets, setStoreWallets] = useState<Record<string, string>>({});
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

  // Dados Pix estruturados + carteiras de cripto da loja (mostrados ao cliente)
  useEffect(() => {
    if (!store?.id) return;
    let cancelled = false;
    supabase
      .from("stores")
      .select("pix_key, pix_key_type, pix_beneficiary_name, pix_beneficiary_bank, crypto_wallets")
      .eq("id", store.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const d: any = data;
        setStorePixInfo({
          key: d.pix_key ?? "",
          type: d.pix_key_type ?? "random",
          name: d.pix_beneficiary_name ?? "",
          bank: d.pix_beneficiary_bank ?? "",
        });
        const w = (d.crypto_wallets ?? {}) as Record<string, string>;
        setStoreWallets(w);
        // pré-seleciona a primeira cripto disponível
        const firstCoin = (["btc", "eth", "usdc", "usdt"] as const).find((c) => w[c]);
        if (firstCoin) setSelectedCrypto(firstCoin);
      });
    return () => { cancelled = true; };
  }, [store?.id]);

  // Verifica se a loja tem gateway PIX ativo (Mercado Pago / Asaas).
  // Se NÃO houver gateway, o PIX é manual: o pedido cai direto em "received".
  const [pixGatewayActive, setPixGatewayActive] = useState(false);
  useEffect(() => {
    if (!store?.id) return;
    let cancelled = false;
    supabase
      .from("payment_gateways")
      .select("id")
      .eq("store_id", store.id)
      .eq("active", true)
      .in("provider", ["mercadopago", "asaas"])
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setPixGatewayActive((data?.length ?? 0) > 0);
      });
    return () => { cancelled = true; };
  }, [store?.id]);

  // Métodos de recebimento habilitados pela loja
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [logisticsEnabled, setLogisticsEnabled] = useState(false);
  useEffect(() => {
    if (!store?.id) return;
    let cancelled = false;
    supabase
      .from("stores")
      .select("delivery_enabled, pickup_enabled, logistics_pickup_enabled")
      .eq("id", store.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const d = data as any;
        setDeliveryEnabled(d.delivery_enabled !== false);
        setPickupEnabled(d.pickup_enabled !== false);
        setLogisticsEnabled(!!d.logistics_pickup_enabled);
      });
    return () => { cancelled = true; };
  }, [store?.id]);

  // Garante que o método selecionado esteja habilitado pela loja
  useEffect(() => {
    const available: Method[] = [];
    if (deliveryEnabled) available.push("delivery");
    if (pickupEnabled) available.push("pickup");
    if (logisticsEnabled) available.push("logistics");
    if (available.length === 0) return;
    if (!available.includes(method)) setMethod(available[0]);
  }, [deliveryEnabled, pickupEnabled, logisticsEnabled, method]);

  const creditLinkTemplate = enabledMethods["credit_link"]?.notes ?? null;
  const creditLinkEnabled = !!enabledMethods["credit_link"]?.enabled && !!creditLinkTemplate;

  const cryptoEnabled = !!enabledMethods["crypto"]?.enabled && Object.values(storeWallets).some((v) => !!v);

  // Se o método selecionado não estiver habilitado pela loja, seleciona o primeiro disponível
  useEffect(() => {
    const keys = Object.keys(enabledMethods);
    if (keys.length === 0) return;
    const available: PaymentMethod[] = (["pix", "cash", "credit", "debit"] as const).filter(
      (k) => enabledMethods[k]?.enabled
    );
    if (creditLinkEnabled) available.push("credit_link");
    if (cryptoEnabled) available.push("crypto");
    if (available.length > 0 && !available.includes(payment)) {
      setPayment(available[0]);
    }
  }, [enabledMethods, creditLinkEnabled, cryptoEnabled, payment]);

  useEffect(() => {
    document.title = "Checkout • Itchat Brasil";
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
      syncRef.current = "pin"; // suprime o forward-geocode disparado pela atualização abaixo
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

  // Sincronização bidirecional pino <-> campos de endereço.
  // syncRef garante que uma atualização programática de um lado
  // não dispare a sincronização reversa no outro (evita loop).
  const syncRef = useRef<"none" | "pin" | "address">("none");

  const applyReverseToAddress = async (lat: number, lng: number) => {
    const rev = await reverseGeocode(lat, lng);
    if (!rev) return;
    syncRef.current = "pin"; // suprime o forward-geocode disparado por esta atualização
    setAddress((a) => ({
      cep: rev.cep || a.cep,
      street: rev.street || a.street,
      number: rev.number || a.number,
      complement: a.complement,
      neighborhood: rev.neighborhood || a.neighborhood,
      city: rev.city || a.city,
    }));
  };

  // Handler para o LocationPicker — usuário arrastou o pino ou clicou no mapa
  const handlePinChange = (c: { lat: number; lng: number }) => {
    if (syncRef.current === "address") {
      // mudança veio do forward-geocode; não reverter
      syncRef.current = "none";
      setCoords(c);
      return;
    }
    syncRef.current = "pin";
    setCoords(c);
    void applyReverseToAddress(c.lat, c.lng);
  };

  // Forward-geocode com debounce quando o cliente edita os campos manualmente
  useEffect(() => {
    if (syncRef.current === "pin") {
      // a atualização veio do reverse-geocode; consumir e ignorar
      syncRef.current = "none";
      return;
    }
    const street = address.street.trim();
    const city = address.city.trim();
    const neighborhood = address.neighborhood.trim();
    if (!street || (!city && !neighborhood)) return;
    const t = window.setTimeout(async () => {
      const parts = [
        address.number ? `${street}, ${address.number}` : street,
        neighborhood,
        city,
        "Brasil",
      ].filter(Boolean);
      const c = await geocodeAddress(parts.join(", "));
      if (c) {
        syncRef.current = "address";
        setCoords(c);
      }
    }, 700);
    return () => window.clearTimeout(t);
  }, [address.street, address.number, address.neighborhood, address.city]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("GPS não disponível neste navegador");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        syncRef.current = "pin";
        setCoords(c);
        const rev = await reverseGeocode(c.lat, c.lng);
        if (rev) {
          syncRef.current = "pin";
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
      : method !== "delivery"
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

  const total = Math.max(0, subtotal + fee - couponDiscount);

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
    crypto: "Criptomoeda",
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

    // (Horário de funcionamento desabilitado: o cliente pode comprar a qualquer hora)

    // 3) Login obrigatório
    if (!user) {
      toast.error("Faça login para continuar", {
        description: "Você precisa estar logado para finalizar o pedido. Vamos te levar para o login.",
      });
      navigate("/auth");
      return;
    }
    // 4) Pedido mínimo
    if (subtotal < store.minOrder) {
      const falta = (store.minOrder - subtotal).toFixed(2).replace(".", ",");
      return toast.error("Pedido abaixo do mínimo", {
        description: `Pedido mínimo: R$ ${store.minOrder.toFixed(2).replace(".", ",")}. Faltam R$ ${falta} para fechar o pedido.`,
      });
    }
    // 5) Contato
    if (!name.trim() && !phone.trim()) {
      return toast.error("Informe seus dados de contato", {
        description: "Preencha seu nome completo e WhatsApp para a loja entrar em contato.",
      });
    }
    if (!name.trim()) {
      return toast.error("Nome obrigatório", {
        description: "Digite seu nome completo no campo 'Nome'.",
      });
    }
    if (!phone.trim()) {
      return toast.error("WhatsApp obrigatório", {
        description: "Digite um número de WhatsApp válido para confirmação do pedido.",
      });
    }
    if (phone.replace(/\D/g, "").length < 10) {
      return toast.error("WhatsApp inválido", {
        description: "Informe um número com DDD, ex: (11) 99999-9999.",
      });
    }

    // 6) Endereço (apenas entrega)
    if (method === "delivery") {
      if (!address.cep) {
        return toast.error("CEP obrigatório", {
          description: "Informe o CEP da entrega ou use o GPS para detectar sua localização.",
        });
      }
      if (address.cep.replace(/\D/g, "").length !== 8) {
        return toast.error("CEP inválido", {
          description: "O CEP deve conter 8 dígitos. Confira e tente novamente.",
        });
      }
      if (!address.street.trim()) {
        return toast.error("Rua obrigatória", {
          description: "Preencha o nome da rua para a entrega.",
        });
      }
      if (!address.number.trim()) {
        return toast.error("Número obrigatório", {
          description: "Informe o número da residência (ou 'S/N' se não houver).",
        });
      }
      if (!address.neighborhood.trim()) {
        return toast.error("Bairro obrigatório", {
          description: "Preencha o bairro para a entrega.",
        });
      }
      if (!coords) {
        return toast.error("Marque sua localização no mapa", {
          description: "Toque em 'Usar minha localização' ou ajuste o pino no mapa para confirmar o endereço.",
        });
      }
      if (outOfDeliveryRange) {
        return toast.error("Fora da área de entrega", {
          description: `Seu endereço está a ${formatDistance(deliveryDistance!)} da loja. Máximo permitido: ${deliveryRadius} km. Tente retirar na loja.`,
        });
      }
    }

    // 7) Forma de pagamento
    if (!payment) {
      return toast.error("Escolha a forma de pagamento", {
        description: "Selecione uma das formas de pagamento disponíveis para continuar.",
      });
    }
    if (!enabledMethods[payment === "credit_link" ? "credit_link" : payment]) {
      return toast.error("Forma de pagamento indisponível", {
        description: "A loja não aceita esta forma de pagamento. Escolha outra opção.",
      });
    }
    if (payment === "credit_link" && !creditLinkEnabled) {
      return toast.error("Link de pagamento indisponível", {
        description: "A loja não configurou o link de pagamento. Escolha outra forma.",
      });
    }
    if (payment === "crypto") {
      if (!cryptoEnabled) {
        return toast.error("Cripto indisponível", {
          description: "A loja não cadastrou nenhuma carteira ativa.",
        });
      }
      if (!selectedCrypto || !storeWallets[selectedCrypto]) {
        return toast.error("Escolha a criptomoeda", {
          description: "Selecione uma das criptomoedas disponíveis para continuar.",
        });
    }
    if (payment === "cash" && changeFor) {
      const v = parseFloat(changeFor.replace(",", "."));
      if (isNaN(v)) {
        return toast.error("Valor de troco inválido", {
          description: "Informe um valor numérico para o troco, ex: 50,00.",
        });
      }
      if (v < total) {
        return toast.error("Troco insuficiente", {
          description: `O valor para troco (R$ ${v.toFixed(2).replace(".", ",")}) deve ser maior ou igual ao total do pedido (R$ ${total.toFixed(2).replace(".", ",")}).`,
        });
      }
    }

    // Tudo certo — segue o fluxo.
    // QR Code Pix só faz sentido quando há gateway integrado.
    if (payment === "pix" && pixGatewayActive) {
      setStep("pix");
    } else {
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
    lines.push(`*Tipo:* ${method === "delivery" ? "Entrega 🛵" : method === "logistics" ? "Retirada por app de logística 📦" : "Retirada na loja 🏪"}`);
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
      const dbPaymentMethod: "pix" | "cash" | "credit" | "debit" | "crypto" =
        payment === "credit_link" ? "credit" : payment;
      const cryptoNote =
        payment === "crypto" && selectedCrypto
          ? `[CRYPTO ${selectedCrypto.toUpperCase()}] ${storeWallets[selectedCrypto] ?? ""}`
          : null;
      const orderNotes =
        payment === "credit_link" && paymentLink
          ? `[LINK_PAGAMENTO] ${paymentLink}`
          : cryptoNote;

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
          total,
          notes: orderNotes,
          // PIX só fica em "pending_payment" se a loja tiver gateway integrado (MP/Asaas).
          // Sem gateway, o PIX é confirmado manualmente — entra direto como "received".
          status: payment === "pix" && pixGatewayActive ? "pending_payment" : "received",
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
      toast.success("Pedido confirmado! 🎉");
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
        .padStart(6, "0")}5802BR5913Itchat Brasil6009Sao Paulo62070503***6304ABCD`,
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
                {(() => {
                  const enabledCount = (deliveryEnabled ? 1 : 0) + (pickupEnabled ? 1 : 0) + (logisticsEnabled ? 1 : 0);
                  if (enabledCount === 0) {
                    return (
                      <p className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                        A loja não habilitou nenhuma forma de recebimento no momento.
                      </p>
                    );
                  }
                  const gridCls = enabledCount === 3 ? "grid-cols-3" : enabledCount === 2 ? "grid-cols-2" : "grid-cols-1";
                  return (
                    <div className={`grid gap-2 ${gridCls}`}>
                      {deliveryEnabled && (
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
                      )}
                      {pickupEnabled && (
                        <button
                          onClick={() => setMethod("pickup")}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-smooth ${
                            method === "pickup" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                          }`}
                        >
                          <StoreIcon className="h-5 w-5 text-primary" />
                          <span className="text-sm font-bold">Retirar na loja</span>
                          <span className="text-xs text-success">Sem taxa</span>
                        </button>
                      )}
                      {logisticsEnabled && (
                        <button
                          onClick={() => setMethod("logistics")}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-smooth ${
                            method === "logistics" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                          }`}
                        >
                          <Bike className="h-5 w-5 text-primary" />
                          <span className="text-center text-sm font-bold leading-tight">Retirada por app</span>
                          <span className="text-[10px] text-muted-foreground">Uber/Lalamove/99</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
                {method === "logistics" && (
                  <p className="mt-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                    📦 Você fará o pedido normalmente. Quando a loja marcar como <strong>pronto</strong>, você
                    chama um entregador no aplicativo de logística que preferir e cola o link de rastreio
                    na tela do pedido para a loja acompanhar.
                  </p>
                )}
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
                    <Suspense
                      fallback={
                        <div className="flex h-64 w-full items-center justify-center rounded-xl bg-muted">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      }
                    >
                      <LocationPicker value={coords} onChange={handlePinChange} />
                    </Suspense>
                  </div>
                </section>
              )}

              {/* Payment method */}
              <section className="rounded-2xl bg-card p-5 shadow-soft">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  <CreditCard className="h-5 w-5 text-primary" /> Forma de pagamento
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(() => {
                    const hasConfig = Object.keys(enabledMethods).length > 0;
                    const isOn = (k: string) => (hasConfig ? !!enabledMethods[k]?.enabled : true);
                    const items = [
                      { v: "pix" as const, label: "Pix", icon: QrCode, hint: "Aprovação instantânea", show: isOn("pix") },
                      { v: "cash" as const, label: "Dinheiro", icon: Banknote, hint: "Na entrega", show: isOn("cash") },
                      { v: "credit" as const, label: "Crédito", icon: CreditCard, hint: "Maquininha", show: isOn("credit") },
                      { v: "debit" as const, label: "Débito", icon: CreditCard, hint: "Maquininha", show: isOn("debit") },
                      { v: "credit_link" as const, label: "Crédito (link)", icon: CreditCard, hint: "Pague online agora", show: creditLinkEnabled },
                      { v: "crypto" as const, label: "Cripto", icon: Copy, hint: "BTC, ETH, USDC, USDT", show: cryptoEnabled },
                    ].filter((o) => o.show);
                    if (items.length === 0) {
                      return (
                        <p className="col-span-full rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                          A loja ainda não habilitou formas de pagamento.
                        </p>
                      );
                    }
                    return items.map((opt) => {
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
                    });
                  })()}
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

                {payment === "pix" && storePixInfo.key && (
                  <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                    <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
                      <QrCode className="h-4 w-4" /> Dados do beneficiário Pix
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase text-muted-foreground">
                            Chave {PIX_TYPE_LABEL[storePixInfo.type] ?? ""}
                          </p>
                          <p className="truncate font-mono font-bold text-foreground">{storePixInfo.key}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(storePixInfo.key);
                            toast.success("Chave Pix copiada!");
                          }}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copiar
                        </button>
                      </div>
                      {storePixInfo.name && (
                        <div>
                          <p className="text-[11px] uppercase text-muted-foreground">Beneficiário</p>
                          <p className="font-semibold text-foreground">{storePixInfo.name}</p>
                        </div>
                      )}
                      {storePixInfo.bank && (
                        <div>
                          <p className="text-[11px] uppercase text-muted-foreground">Banco</p>
                          <p className="font-semibold text-foreground">{storePixInfo.bank}</p>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Confira os dados antes de pagar. Após confirmar o pedido, envie o comprovante para a loja.
                    </p>
                  </div>
                )}

                {payment === "crypto" && cryptoEnabled && (
                  <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                    <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
                      <Copy className="h-4 w-4" /> Pagamento em criptomoeda
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(["btc", "eth", "usdc", "usdt"] as const)
                        .filter((c) => !!storeWallets[c])
                        .map((c) => {
                          const active = selectedCrypto === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setSelectedCrypto(c)}
                              className={`rounded-xl border-2 p-2 text-xs font-bold transition-smooth ${
                                active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                              }`}
                            >
                              {c.toUpperCase()}
                            </button>
                          );
                        })}
                    </div>
                    {selectedCrypto && storeWallets[selectedCrypto] && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="text-[11px] uppercase text-muted-foreground">
                            {CRYPTO_COIN_META[selectedCrypto].label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Rede: {CRYPTO_COIN_META[selectedCrypto].network}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-background p-2">
                          <p className="min-w-0 break-all font-mono text-xs">{storeWallets[selectedCrypto]}</p>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(storeWallets[selectedCrypto]!);
                              toast.success("Endereço copiado!");
                            }}
                            className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copiar
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Envie o valor equivalente a <strong>R$ {total.toFixed(2).replace(".", ",")}</strong> para a carteira acima
                          usando a rede correta. Após confirmar, envie o hash da transação para a loja.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>


              {/* Coupon */}
              <section className="rounded-2xl bg-card p-5 shadow-soft">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  <Tag className="h-5 w-5 text-primary" /> Cupom
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
                </div>
                <div className="flex justify-between border-t pt-3 font-display text-xl font-bold">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Pagamento: <strong className="text-foreground">{paymentLabel[payment]}</strong>
                </p>
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
