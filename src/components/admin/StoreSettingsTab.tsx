import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Store as StoreIcon,
  Clock,
  Truck,
  CreditCard,
  Upload,
  Plus,
  Trash2,
  CalendarDays,
  Plane,
  MapPin,
  Loader2,
  Link2,
  Copy,
  ExternalLink,
  QrCode,
  Share2,
  Bot,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { ChatbotSection } from "./ChatbotSection";

type Section = "profile" | "hours" | "delivery" | "payment" | "chatbot";

const WEEK = [
  { key: "mon", label: "Segunda" },
  { key: "tue", label: "Terça" },
  { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" },
  { key: "fri", label: "Sexta" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
] as const;

type DayKey = (typeof WEEK)[number]["key"];
type Shift = { open: string; close: string };
type DayHours = { enabled: boolean; shifts: Shift[] };
type HoursMap = Record<DayKey, DayHours>;

const defaultDay = (): DayHours => ({ enabled: true, shifts: [{ open: "11:00", close: "23:00" }] });
const defaultHours = (): HoursMap =>
  WEEK.reduce((acc, d) => ({ ...acc, [d.key]: defaultDay() }), {} as HoursMap);

const PAYMENT_METHODS = [
  { id: "pix_online", label: "Pix online (no app)", needsPix: true },
  { id: "pix_delivery", label: "Pix na entrega" },
  { id: "credit_online", label: "Crédito online", hasInstallments: true },
  { id: "credit_link", label: "Cartão de crédito — link de pagamento", needsLink: true },
  { id: "credit_delivery", label: "Crédito (maquininha)" },
  { id: "debit_delivery", label: "Débito (maquininha)" },
  { id: "cash", label: "Dinheiro (com troco)" },
] as const;

export const StoreSettingsTab = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("profile");

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2">
        {(
          [
            { id: "profile", label: "Perfil & Identidade", icon: StoreIcon },
            { id: "hours", label: "Horários", icon: Clock },
            { id: "delivery", label: "Entrega", icon: Truck },
            { id: "payment", label: "Pagamento", icon: CreditCard },
            { id: "chatbot", label: "Chatbot WhatsApp", icon: Bot },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-smooth ${
              section === s.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </nav>

      {section === "profile" && <ProfileSection storeId={storeId} qc={qc} />}
      {section === "hours" && <HoursSection storeId={storeId} qc={qc} />}
      {section === "delivery" && <DeliverySection storeId={storeId} qc={qc} />}
      {section === "payment" && <PaymentSection storeId={storeId} qc={qc} />}
      {section === "chatbot" && <ChatbotSection storeId={storeId} />}
    </div>
  );
};

/* ---------- 8.1 Perfil ---------- */
const ProfileSection = ({ storeId, qc }: { storeId: string; qc: ReturnType<typeof useQueryClient> }) => {
  const { data: store } = useQuery({
    queryKey: ["store-profile", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").eq("id", storeId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({});
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [cuisineInput, setCuisineInput] = useState("");

  useEffect(() => {
    if (store) {
      setForm(store);
    }
  }, [store]);

  const upload = async (kind: "logo" | "cover", file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem deve ter até 5MB");
    setUploading(kind);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${storeId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file, { upsert: true });
    if (error) {
      setUploading(null);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
    setForm((f: any) => ({ ...f, [kind === "logo" ? "logo" : "cover_url"]: data.publicUrl }));
    setUploading(null);
    toast.success("Imagem enviada");
  };

  const save = async () => {
    const payload = {
      name: form.name,
      short_description: form.short_description,
      tagline: form.tagline,
      logo: form.logo,
      cover_url: form.cover_url,
      categories: form.categories ?? [],
      phone: form.phone,
      whatsapp_phone: form.whatsapp_phone,
      instagram: form.instagram,
      website: form.website,
      address_cep: form.address_cep,
      address_street: form.address_street,
      address_number: form.address_number,
      address_complement: form.address_complement,
      address_neighborhood: form.address_neighborhood,
      city: form.city,
      address_state: form.address_state,
      lat: form.lat,
      lng: form.lng,
    };
    const { error } = await supabase.from("stores").update(payload).eq("id", storeId);
    if (error) return toast.error(error.message);
    toast.success("Perfil salvo");
    qc.invalidateQueries({ queryKey: ["store-profile", storeId] });
    qc.invalidateQueries({ queryKey: ["admin-stores"] });
  };

  const lookupCep = async () => {
    const cep = (form.address_cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return toast.error("CEP inválido");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) return toast.error("CEP não encontrado");
      setForm((f: any) => ({
        ...f,
        address_street: data.logradouro || f.address_street,
        address_neighborhood: data.bairro || f.address_neighborhood,
        city: data.localidade || f.city,
        address_state: data.uf || f.address_state,
      }));
    } catch {
      toast.error("Falha ao buscar CEP");
    }
  };

  if (!store) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card title="Identidade visual" icon={StoreIcon}>
          <div className="max-w-xs">
            <ImageDropper
              label="Logo (quadrado, 200x200+)"
              value={form.logo}
              uploading={uploading === "logo"}
              onPick={(f) => upload("logo", f)}
              aspect="square"
            />
          </div>
        </Card>

        <Card title="Dados públicos" icon={StoreIcon}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome da loja *">
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Tagline (chamada curta)">
              <Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} maxLength={60} />
            </Field>
            <Field label={`Descrição curta (${(form.short_description ?? "").length}/150)`} full>
              <Textarea
                value={form.short_description ?? ""}
                maxLength={150}
                rows={2}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
              />
            </Field>
            <Field label="Categorias (Enter para adicionar)" full>
              <div className="flex flex-wrap gap-1.5 rounded-md border bg-background p-2">
                {(form.categories ?? []).map((c: string) => (
                  <span key={c} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    {c}
                    <button
                      onClick={() =>
                        setForm({ ...form, categories: form.categories.filter((x: string) => x !== c) })
                      }
                      className="text-primary/60 hover:text-primary"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={cuisineInput}
                  onChange={(e) => setCuisineInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && cuisineInput.trim()) {
                      e.preventDefault();
                      const v = cuisineInput.trim();
                      if (!(form.categories ?? []).includes(v)) {
                        setForm({ ...form, categories: [...(form.categories ?? []), v] });
                      }
                      setCuisineInput("");
                    }
                  }}
                  placeholder="Ex: Hamburgueria"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Contato e redes" icon={StoreIcon}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefone *">
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp_phone ?? ""} onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="Instagram">
              <Input value={form.instagram ?? ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@minhaloja" />
            </Field>
            <Field label="Site">
              <Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
            </Field>
          </div>
        </Card>

        <Card title="Endereço" icon={MapPin}>
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="CEP *" cls="sm:col-span-2">
              <div className="flex gap-2">
                <Input
                  value={form.address_cep ?? ""}
                  onChange={(e) => setForm({ ...form, address_cep: e.target.value })}
                  placeholder="00000-000"
                />
                <Button type="button" size="sm" variant="outline" onClick={lookupCep}>Buscar</Button>
              </div>
            </Field>
            <Field label="Rua *" cls="sm:col-span-3">
              <Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
            </Field>
            <Field label="Número *" cls="sm:col-span-1">
              <Input value={form.address_number ?? ""} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
            </Field>
            <Field label="Complemento" cls="sm:col-span-2">
              <Input value={form.address_complement ?? ""} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
            </Field>
            <Field label="Bairro" cls="sm:col-span-2">
              <Input value={form.address_neighborhood ?? ""} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} />
            </Field>
            <Field label="Cidade" cls="sm:col-span-1">
              <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="UF" cls="sm:col-span-1">
              <Input value={form.address_state ?? ""} onChange={(e) => setForm({ ...form, address_state: e.target.value })} maxLength={2} />
            </Field>
            <Field label="Latitude" cls="sm:col-span-2">
              <Input
                type="number"
                step="0.000001"
                value={form.lat ?? ""}
                onChange={(e) => setForm({ ...form, lat: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Longitude" cls="sm:col-span-2">
              <Input
                type="number"
                step="0.000001"
                value={form.lng ?? ""}
                onChange={(e) => setForm({ ...form, lng: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Localização" cls="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!navigator.geolocation) {
                    return toast.error("Navegador sem suporte a GPS");
                  }
                  toast.loading("Buscando sua localização...", { id: "geo" });
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setForm((f: any) => ({
                        ...f,
                        lat: Number(pos.coords.latitude.toFixed(6)),
                        lng: Number(pos.coords.longitude.toFixed(6)),
                      }));
                      toast.success("Coordenadas preenchidas!", { id: "geo" });
                    },
                    (err) => {
                      toast.error(
                        err.code === 1
                          ? "Permissão negada — habilite o GPS nas configurações do navegador"
                          : "Não foi possível obter localização",
                        { id: "geo" },
                      );
                    },
                    { enableHighAccuracy: true, timeout: 10000 },
                  );
                }}
              >
                <MapPin className="mr-2 h-4 w-4" /> Usar minha localização
              </Button>
            </Field>
            {form.lat && form.lng && (
              <div className="sm:col-span-6">
                <a
                  href={`https://www.google.com/maps?q=${form.lat},${form.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <MapPin className="h-3 w-3" /> Ver no Google Maps
                </a>
              </div>
            )}
          </div>
        </Card>

        <PublicLinkCard storeId={storeId} slug={form.slug} name={form.name} />

        <Button onClick={save} className="w-full gradient-primary font-bold" size="lg">
          Salvar perfil
        </Button>
      </div>

      <aside className="space-y-3">
        <div className="sticky top-24 overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="relative h-32 bg-muted">
            {form.cover_url && <img src={form.cover_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="-mt-10 flex items-end gap-3 px-4">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-card bg-muted text-3xl flex items-center justify-center">
              {form.logo?.startsWith("http") ? (
                <img src={form.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{form.logo || "🏪"}</span>
              )}
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-display text-lg font-bold">{form.name || "Nome da loja"}</h3>
            <p className="text-xs text-muted-foreground">{form.short_description || "Descrição curta..."}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(form.categories ?? []).slice(0, 3).map((c: string) => (
                <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

/* ---------- 8.2 Horários ---------- */
const HoursSection = ({ storeId, qc }: { storeId: string; qc: ReturnType<typeof useQueryClient> }) => {
  const { data: store } = useQuery({
    queryKey: ["store-hours", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("opening_hours, vacation_mode, vacation_message, vacation_until, max_orders_per_hour, preorder_minutes")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["store-holidays", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_holidays")
        .select("*")
        .eq("store_id", storeId)
        .order("date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [hours, setHours] = useState<HoursMap>(defaultHours());
  const [vacation, setVacation] = useState({ mode: false, message: "", until: "" });
  const [maxOrders, setMaxOrders] = useState<number | "">("");
  const [preorder, setPreorder] = useState<number | "">(0);

  useEffect(() => {
    if (!store) return;
    const oh = store.opening_hours as any;
    const next: HoursMap = defaultHours();
    if (oh && typeof oh === "object") {
      WEEK.forEach((d) => {
        const v = oh[d.key];
        if (!v) {
          next[d.key] = { enabled: false, shifts: [{ open: "10:00", close: "22:00" }] };
        } else if (Array.isArray(v.shifts)) {
          next[d.key] = { enabled: v.enabled !== false, shifts: v.shifts };
        } else if (v.open && v.close) {
          next[d.key] = { enabled: true, shifts: [{ open: v.open, close: v.close }] };
        }
      });
    }
    setHours(next);
    setVacation({
      mode: !!store.vacation_mode,
      message: store.vacation_message ?? "",
      until: store.vacation_until ?? "",
    });
    setMaxOrders(store.max_orders_per_hour ?? "");
    setPreorder(store.preorder_minutes ?? 0);
  }, [store]);

  const updateDay = (key: DayKey, patch: Partial<DayHours>) =>
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));

  const addShift = (key: DayKey) =>
    setHours((h) => ({ ...h, [key]: { ...h[key], shifts: [...h[key].shifts, { open: "18:00", close: "23:00" }] } }));

  const removeShift = (key: DayKey, idx: number) =>
    setHours((h) => ({ ...h, [key]: { ...h[key], shifts: h[key].shifts.filter((_, i) => i !== idx) } }));

  const updateShift = (key: DayKey, idx: number, patch: Partial<Shift>) =>
    setHours((h) => ({
      ...h,
      [key]: { ...h[key], shifts: h[key].shifts.map((s, i) => (i === idx ? { ...s, ...patch } : s)) },
    }));

  const save = async () => {
    const payload: any = {
      opening_hours: hours,
      vacation_mode: vacation.mode,
      vacation_message: vacation.message || null,
      vacation_until: vacation.until || null,
      max_orders_per_hour: maxOrders === "" ? null : Number(maxOrders),
      preorder_minutes: preorder === "" ? 0 : Number(preorder),
    };
    const { error } = await supabase.from("stores").update(payload).eq("id", storeId);
    if (error) return toast.error(error.message);
    toast.success("Horários salvos");
    qc.invalidateQueries({ queryKey: ["store-hours", storeId] });
  };

  const [newHoliday, setNewHoliday] = useState({ date: "", label: "", closed: true, open_time: "11:00", close_time: "16:00" });
  const addHoliday = async () => {
    if (!newHoliday.date) return toast.error("Escolha a data");
    const { error } = await supabase.from("store_holidays").insert({
      store_id: storeId,
      date: newHoliday.date,
      label: newHoliday.label || null,
      closed: newHoliday.closed,
      open_time: newHoliday.closed ? null : newHoliday.open_time,
      close_time: newHoliday.closed ? null : newHoliday.close_time,
    });
    if (error) return toast.error(error.message);
    setNewHoliday({ date: "", label: "", closed: true, open_time: "11:00", close_time: "16:00" });
    qc.invalidateQueries({ queryKey: ["store-holidays", storeId] });
  };
  const delHoliday = async (id: string) => {
    const { error } = await supabase.from("store_holidays").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["store-holidays", storeId] });
  };

  return (
    <div className="space-y-5">
      <Card title="Horários por dia" icon={Clock}>
        <div className="space-y-3">
          {WEEK.map((d) => (
            <div key={d.key} className="rounded-xl border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch checked={hours[d.key].enabled} onCheckedChange={(v) => updateDay(d.key, { enabled: v })} />
                  <span className={`font-bold ${hours[d.key].enabled ? "" : "text-muted-foreground line-through"}`}>{d.label}</span>
                </div>
                {hours[d.key].enabled && (
                  <Button size="sm" variant="outline" onClick={() => addShift(d.key)}>
                    <Plus className="h-3.5 w-3.5" /> Turno
                  </Button>
                )}
              </div>
              {hours[d.key].enabled && (
                <div className="mt-3 space-y-2">
                  {hours[d.key].shifts.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" value={s.open} onChange={(e) => updateShift(d.key, i, { open: e.target.value })} className="w-32" />
                      <span className="text-muted-foreground">até</span>
                      <Input type="time" value={s.close} onChange={(e) => updateShift(d.key, i, { close: e.target.value })} className="w-32" />
                      {hours[d.key].shifts.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeShift(d.key, i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Modo férias" icon={Plane}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">Pausar a loja</p>
            <p className="text-xs text-muted-foreground">A loja aparece como fechada até a data definida.</p>
          </div>
          <Switch checked={vacation.mode} onCheckedChange={(v) => setVacation((x) => ({ ...x, mode: v }))} />
        </div>
        {vacation.mode && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Reabre em">
              <Input type="date" value={vacation.until} onChange={(e) => setVacation((x) => ({ ...x, until: e.target.value }))} />
            </Field>
            <Field label="Mensagem ao cliente" full>
              <Textarea
                rows={2}
                value={vacation.message}
                onChange={(e) => setVacation((x) => ({ ...x, message: e.target.value }))}
                placeholder="Estamos de férias até o dia X. Voltamos em breve!"
              />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Capacidade & antecipação" icon={Clock}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Máx. pedidos por hora (vazio = sem limite)">
            <Input
              type="number"
              min={0}
              value={maxOrders}
              onChange={(e) => setMaxOrders(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
          <Field label="Aceitar pedidos X min antes de abrir">
            <Input
              type="number"
              min={0}
              value={preorder}
              onChange={(e) => setPreorder(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
        </div>
      </Card>

      <Card title="Feriados e datas especiais" icon={CalendarDays}>
        <div className="space-y-2">
          {holidays.length === 0 && <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>}
          {holidays.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
              <div>
                <span className="font-bold">{new Date(h.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                {h.label && <span className="ml-2 text-muted-foreground">— {h.label}</span>}
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                  {h.closed ? "Fechado" : `${h.open_time} - ${h.close_time}`}
                </span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => delHoliday(h.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-6">
          <Input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} className="sm:col-span-2" />
          <Input placeholder="Etiqueta (ex: Natal)" value={newHoliday.label} onChange={(e) => setNewHoliday({ ...newHoliday, label: e.target.value })} className="sm:col-span-2" />
          <label className="flex items-center gap-2 text-xs font-bold sm:col-span-1">
            <Switch checked={newHoliday.closed} onCheckedChange={(v) => setNewHoliday({ ...newHoliday, closed: v })} />
            Fechado
          </label>
          <Button onClick={addHoliday} className="sm:col-span-1"><Plus className="h-4 w-4" /> Add</Button>
          {!newHoliday.closed && (
            <>
              <Input type="time" value={newHoliday.open_time} onChange={(e) => setNewHoliday({ ...newHoliday, open_time: e.target.value })} className="sm:col-span-3" />
              <Input type="time" value={newHoliday.close_time} onChange={(e) => setNewHoliday({ ...newHoliday, close_time: e.target.value })} className="sm:col-span-3" />
            </>
          )}
        </div>
      </Card>

      <Button onClick={save} className="w-full gradient-primary font-bold" size="lg">
        Salvar horários
      </Button>
    </div>
  );
};

/* ---------- 8.3 Entrega ---------- */
const DeliverySection = ({ storeId, qc }: { storeId: string; qc: ReturnType<typeof useQueryClient> }) => {
  const { data: store } = useQuery({
    queryKey: ["store-delivery", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(
          "delivery_mode, delivery_radius_km, delivery_fee, delivery_fee_per_km, free_shipping_threshold, min_order, delivery_time, courier_mode, pickup_enabled, pickup_prep_time_min, logistics_pickup_enabled, logistics_pickup_release_when_ready, logistics_pickup_notify_customer, logistics_pickup_require_code, logistics_pickup_require_confirm, logistics_pickup_instructions, courier_gps_alert_min, courier_gps_reassign_min",
        )
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: hoods = [] } = useQuery({
    queryKey: ["store-hoods", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_neighborhoods")
        .select("*")
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (store) setForm(store);
  }, [store]);

  const save = async () => {
    const { error } = await supabase.from("stores").update(form).eq("id", storeId);
    if (error) return toast.error(error.message);
    toast.success("Entrega salva");
    qc.invalidateQueries({ queryKey: ["store-delivery", storeId] });
  };

  const [newHood, setNewHood] = useState({ name: "", fee: 0, estimated_time_min: 30 });
  const addHood = async () => {
    if (!newHood.name.trim()) return toast.error("Nome do bairro");
    const { error } = await supabase.from("store_neighborhoods").insert({ ...newHood, store_id: storeId });
    if (error) return toast.error(error.message);
    setNewHood({ name: "", fee: 0, estimated_time_min: 30 });
    qc.invalidateQueries({ queryKey: ["store-hoods", storeId] });
  };
  const delHood = async (id: string) => {
    const { error } = await supabase.from("store_neighborhoods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["store-hoods", storeId] });
  };

  if (!store) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-5">
      <Card title="Modo de entrega" icon={Truck}>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { id: "radius", label: "Raio em km", desc: "Atende um círculo a partir do endereço" },
            { id: "neighborhoods", label: "Bairros", desc: "Atende uma lista de bairros específicos" },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setForm({ ...form, delivery_mode: opt.id })}
              className={`rounded-xl border-2 p-4 text-left transition-smooth ${
                form.delivery_mode === opt.id ? "border-primary bg-primary/5" : "border-border bg-background"
              }`}
            >
              <p className="font-bold">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      {form.delivery_mode === "radius" ? (
        <Card title="Raio e taxa" icon={MapPin}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Raio (km)">
              <Input
                type="number"
                step="0.5"
                value={form.delivery_radius_km ?? ""}
                onChange={(e) => setForm({ ...form, delivery_radius_km: Number(e.target.value) })}
              />
            </Field>
            <Field label="Taxa fixa (R$)">
              <Input
                type="number"
                step="0.5"
                value={form.delivery_fee ?? ""}
                onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })}
              />
            </Field>
            <Field label="Taxa por km extra (R$)">
              <Input
                type="number"
                step="0.5"
                value={form.delivery_fee_per_km ?? ""}
                onChange={(e) => setForm({ ...form, delivery_fee_per_km: Number(e.target.value) })}
              />
            </Field>
          </div>
        </Card>
      ) : (
        <Card title="Bairros atendidos" icon={MapPin}>
          <div className="space-y-2">
            {hoods.length === 0 && <p className="text-sm text-muted-foreground">Nenhum bairro cadastrado.</p>}
            {hoods.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{h.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">R$ {Number(h.fee).toFixed(2)}</span>
                  {h.estimated_time_min && <span className="text-xs text-muted-foreground">{h.estimated_time_min} min</span>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => delHood(h.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-6">
            <Input placeholder="Bairro" value={newHood.name} onChange={(e) => setNewHood({ ...newHood, name: e.target.value })} className="sm:col-span-2" />
            <Input type="number" step="0.5" placeholder="Taxa" value={newHood.fee} onChange={(e) => setNewHood({ ...newHood, fee: Number(e.target.value) })} className="sm:col-span-1" />
            <Input type="number" placeholder="Min" value={newHood.estimated_time_min} onChange={(e) => setNewHood({ ...newHood, estimated_time_min: Number(e.target.value) })} className="sm:col-span-1" />
            <Button onClick={addHood} className="sm:col-span-2"><Plus className="h-4 w-4" /> Adicionar</Button>
          </div>
        </Card>
      )}

      <Card title="Pedido & tempo" icon={Clock}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Pedido mínimo (R$)">
            <Input
              type="number"
              step="0.5"
              value={form.min_order ?? ""}
              onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })}
            />
          </Field>
          <Field label="Frete grátis acima de (R$)">
            <Input
              type="number"
              step="0.5"
              value={form.free_shipping_threshold ?? ""}
              onChange={(e) => setForm({ ...form, free_shipping_threshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Tempo estimado (texto)">
            <Input
              value={form.delivery_time ?? ""}
              onChange={(e) => setForm({ ...form, delivery_time: e.target.value })}
              placeholder="30-45 min"
            />
          </Field>
        </div>
      </Card>

      <Card title="Entregador & retirada" icon={Truck}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-background p-3">
            <p className="mb-2 text-sm font-bold">Quem entrega?</p>
            <div className="flex gap-2">
              {(["own", "marketplace"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setForm({ ...form, courier_mode: m })}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-smooth ${
                    form.courier_mode === m ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  {m === "own" ? "Entrega própria" : "Marketplace"}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Retirada no local</p>
              <Switch checked={!!form.pickup_enabled} onCheckedChange={(v) => setForm({ ...form, pickup_enabled: v })} />
            </div>
            {form.pickup_enabled && (
              <div className="mt-2">
                <Label className="text-xs">Tempo de preparo (min)</Label>
                <Input
                  type="number"
                  value={form.pickup_prep_time_min ?? ""}
                  onChange={(e) => setForm({ ...form, pickup_prep_time_min: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">📦 Retirada por app de logística</p>
              <p className="text-[11px] text-muted-foreground">
                Cliente faz o pedido, a loja prepara e o cliente chama um entregador no app que preferir
                (Uber, Lalamove, 99, iFood Pegue&amp;Leve). O cliente cola o link de rastreio e a loja acompanha a rota.
              </p>
            </div>
            <Switch
              checked={!!form.logistics_pickup_enabled}
              onCheckedChange={(v) => setForm({ ...form, logistics_pickup_enabled: v })}
            />
          </div>

          {form.logistics_pickup_enabled && (
            <div className="mt-3 space-y-2 border-t border-primary/10 pt-3">
              <ToggleRow
                label="Liberar retirada somente quando o pedido estiver pronto"
                hint="Cliente só vê os botões de chamar Uber/99 após o status virar 'Pronto'."
                checked={!!form.logistics_pickup_release_when_ready}
                onChange={(v) => setForm({ ...form, logistics_pickup_release_when_ready: v })}
              />
              <ToggleRow
                label="Enviar notificação automática ao cliente"
                hint="Avisa o cliente assim que o pedido ficar pronto para retirada."
                checked={!!form.logistics_pickup_notify_customer}
                onChange={(v) => setForm({ ...form, logistics_pickup_notify_customer: v })}
              />
              <ToggleRow
                label="Exigir código de retirada"
                hint="Gera um código de 4 dígitos que o motorista deve informar no balcão."
                checked={!!form.logistics_pickup_require_code}
                onChange={(v) => setForm({ ...form, logistics_pickup_require_code: v })}
              />
              <ToggleRow
                label="Solicitar confirmação da loja antes da entrega"
                hint="A loja precisa confirmar a entrega ao motorista antes de o pedido sair."
                checked={!!form.logistics_pickup_require_confirm}
                onChange={(v) => setForm({ ...form, logistics_pickup_require_confirm: v })}
              />
              <Field label="Instruções personalizadas para o cliente (opcional)">
                <textarea
                  rows={3}
                  placeholder="Ex.: Retirada no balcão de entregas dos fundos. Motorista deve informar o nome do cliente."
                  value={form.logistics_pickup_instructions ?? ""}
                  onChange={(e) => setForm({ ...form, logistics_pickup_instructions: e.target.value })}
                  className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card title="Monitoramento de GPS dos entregadores" icon={MapPin}>
        <p className="mb-3 text-xs text-muted-foreground">
          Define quando o painel deve alertar sobre entregadores que pararam de enviar a localização e quando o sistema pode liberar o pedido automaticamente para reatribuição.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="⚠️ Alerta após (minutos sem GPS)">
            <Input
              type="number"
              min={1}
              value={form.courier_gps_alert_min ?? 5}
              onChange={(e) => setForm({ ...form, courier_gps_alert_min: Number(e.target.value) })}
            />
          </Field>
          <Field label="🔁 Reatribuir automaticamente após (minutos)">
            <Input
              type="number"
              min={1}
              value={form.courier_gps_reassign_min ?? 10}
              onChange={(e) => setForm({ ...form, courier_gps_reassign_min: Number(e.target.value) })}
            />
          </Field>
        </div>
      </Card>

      <Button onClick={save} className="w-full gradient-primary font-bold" size="lg">
        Salvar entrega
      </Button>
    </div>
  );
};

/* ---------- 8.4 Pagamento ---------- */
const PaymentSection = ({ storeId, qc }: { storeId: string; qc: ReturnType<typeof useQueryClient> }) => {
  const { data: store } = useQuery({
    queryKey: ["store-pix", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("pix_key").eq("id", storeId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: methods = [] } = useQuery({
    queryKey: ["store-payments", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_payment_methods").select("*").eq("store_id", storeId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [pixKey, setPixKey] = useState("");
  useEffect(() => {
    if (store) setPixKey(store.pix_key ?? "");
  }, [store]);

  const map = useMemo(() => {
    const m = new Map<string, any>();
    methods.forEach((x: any) => m.set(x.method, x));
    return m;
  }, [methods]);

  const upsert = async (method: string, patch: any) => {
    const existing = map.get(method);
    if (existing) {
      const { error } = await supabase.from("store_payment_methods").update(patch).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("store_payment_methods")
        .insert({ store_id: storeId, method, enabled: true, ...patch });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["store-payments", storeId] });
  };

  const savePix = async () => {
    const { error } = await supabase.from("stores").update({ pix_key: pixKey || null }).eq("id", storeId);
    if (error) return toast.error(error.message);
    toast.success("Chave Pix salva");
    qc.invalidateQueries({ queryKey: ["store-pix", storeId] });
  };

  return (
    <div className="space-y-5">
      <Card title="Chave Pix da loja" icon={CreditCard}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
          <Button onClick={savePix} variant="outline">Salvar</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Usada para gerar QR Code no checkout quando o cliente escolher Pix online.
        </p>
      </Card>

      <Card title="Formas de pagamento aceitas" icon={CreditCard}>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((pm) => {
            const cur = map.get(pm.id);
            const enabled = cur?.enabled ?? false;
            return (
              <div key={pm.id} className="rounded-xl border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{pm.label}</p>
                    {pm.id === "pix_online" && !pixKey && enabled && (
                      <p className="text-xs text-amber-600">⚠ Cadastre uma chave Pix para ativar.</p>
                    )}
                    {"needsLink" in pm && pm.needsLink && enabled && !cur?.notes && (
                      <p className="text-xs text-amber-600">⚠ Cadastre o link de pagamento abaixo.</p>
                    )}
                  </div>
                  <Switch checked={enabled} onCheckedChange={(v) => upsert(pm.id, { enabled: v })} />
                </div>
                {enabled && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {"hasInstallments" in pm && pm.hasInstallments && (
                      <Field label="Máx. parcelas">
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={cur?.installments ?? 1}
                          onChange={(e) => upsert(pm.id, { installments: Number(e.target.value) })}
                        />
                      </Field>
                    )}
                    {"needsLink" in pm && pm.needsLink && (
                      <Field label="Link de pagamento (use {valor} no lugar do valor)" full cls="sm:col-span-3">
                        <Input
                          type="url"
                          placeholder="https://link.infinitepay.io/seu-usuario/{valor}"
                          value={cur?.notes ?? ""}
                          onChange={(e) => upsert(pm.id, { notes: e.target.value })}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Ex.: <code className="rounded bg-muted px-1">https://link.infinitepay.io/lucassiles/{"{valor}"}</code> — o sistema substitui <code className="rounded bg-muted px-1">{"{valor}"}</code> pelo total do pedido (formato BR, ex.: 12,50).
                        </p>
                      </Field>
                    )}
                    <Field label="Disponível das">
                      <Input
                        type="time"
                        value={cur?.active_from ?? ""}
                        onChange={(e) => upsert(pm.id, { active_from: e.target.value || null })}
                      />
                    </Field>
                    <Field label="Até">
                      <Input
                        type="time"
                        value={cur?.active_to ?? ""}
                        onChange={(e) => upsert(pm.id, { active_to: e.target.value || null })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

/* ---------- helpers ---------- */
const Card = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <section className="rounded-2xl bg-card p-5 shadow-soft">
    <header className="mb-4 flex items-center gap-2">
      <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
    </header>
    {children}
  </section>
);

const Field = ({
  label,
  children,
  full,
  cls,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  cls?: string;
}) => (
  <div className={`${full ? "sm:col-span-2" : ""} ${cls ?? ""}`}>
    <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const ImageDropper = ({
  label,
  value,
  uploading,
  onPick,
  aspect,
}: {
  label: string;
  value?: string;
  uploading: boolean;
  onPick: (f: File) => void;
  aspect: "square" | "banner";
}) => (
  <label
    className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 transition-smooth hover:border-primary ${
      aspect === "square" ? "aspect-square" : "aspect-[3/1]"
    }`}
  >
    {value && value.startsWith("http") ? (
      <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
    ) : (
      <div className="text-center">
        <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p>
      </div>
    )}
    {uploading && (
      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )}
    <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-bold opacity-0 group-hover:opacity-100">
      Trocar
    </span>
    <input
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onPick(f);
        e.target.value = "";
      }}
    />
  </label>
);

/* ---------- Link público da loja ---------- */
export const PublicLinkCard = ({ slug, name, title = "Link público do cardápio", description = "Compartilhe este link para que clientes acessem o cardápio direto." }: { storeId: string; slug?: string; name?: string; title?: string; description?: string }) => {
  const [showQr, setShowQr] = useState(false);
  if (!slug) return null;
  const url = `${window.location.origin}/loja/${slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Falha ao copiar");
    }
  };
  const shareWa = () => {
    const msg = `Confira o cardápio de *${name ?? "nossa loja"}* 🍔\n${url}`;
    const a = document.createElement("a");
    a.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const downloadQr = () => {
    const svg = document.getElementById("store-qr") as unknown as SVGSVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `qrcode-${slug}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Card title={title} icon={Link2}>
      <p className="mb-3 text-xs text-muted-foreground">
        {description}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">
          {url}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copy}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const a = document.createElement("a");
              a.href = url;
              a.target = "_blank";
              a.rel = "noopener noreferrer";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowQr((v) => !v)}>
            <QrCode className="mr-1.5 h-3.5 w-3.5" /> QR Code
          </Button>
          <Button type="button" size="sm" className="gradient-primary text-primary-foreground" onClick={shareWa}>
            <Share2 className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
          </Button>
        </div>
      </div>
      {showQr && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border bg-background p-4">
          <QRCodeSVG id="store-qr" value={url} size={180} level="M" includeMargin />
          <Button type="button" size="sm" variant="outline" onClick={downloadQr}>
            Baixar QR Code
          </Button>
        </div>
      )}
    </Card>
  );
};
